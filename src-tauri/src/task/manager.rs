use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use tauri::ipc::Channel;

use crate::ffmpeg::args::CompressionConfig;
use crate::ffmpeg::encoder::EncoderInfo;
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::progress::ProgressEvent;
use crate::utils::error::{safe_lock, AppError};
use crate::utils::path::generate_output_path;

use super::base_manager::{BaseTaskManager, TaskEntry};
use super::types::{TaskInfo, TaskStatus};
use super::worker::run_task;

pub struct TaskManager {
    base: BaseTaskManager<VideoInfo>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            base: BaseTaskManager::new(),
        }
    }

    /// Add videos to the task queue, returning their task IDs
    pub fn add_tasks(&self, videos: Vec<VideoInfo>, config: &CompressionConfig) -> Vec<TaskInfo> {
        let mut tasks = safe_lock(&self.base.tasks);
        let mut order = safe_lock(&self.base.task_order);
        let mut next_id = safe_lock(&self.base.next_id);
        let mut result = Vec::new();

        for video in videos {
            let id = format!("task_{}", *next_id);
            *next_id += 1;

            let output_path = generate_output_path(
                std::path::Path::new(&video.path),
                config.output_dir.as_deref(),
                &config.output_format,
                &config.filename_template,
                &config.codec,
                &config.resolution,
            );
            let info = TaskInfo {
                id: id.clone(),
                input_path: video.path.clone(),
                output_path: output_path.to_string_lossy().to_string(),
                file_name: video.file_name.clone(),
                status: TaskStatus::Pending,
                progress: 0.0,
                input_size: video.size,
                output_size: None,
                error: None,
            };

            let entry = TaskEntry {
                info: info.clone(),
                payload: video,
                cancel_flag: Arc::new(AtomicBool::new(false)),
            };

            tasks.insert(id.clone(), entry);
            order.push(id);
            result.push(info);
        }

        result
    }

    /// Determine max concurrency based on encoder type or user override
    fn max_concurrency(config: &CompressionConfig, encoders: &[EncoderInfo]) -> usize {
        if let Some(user_max) = config.max_concurrency {
            return user_max.max(1);
        }

        let has_hw = encoders.iter().any(|e| e.codec == config.codec && e.is_hardware);
        let use_hw = config.use_hardware && has_hw;

        if use_hw {
            let hw_limit = Self::detect_hw_concurrency_limit();
            hw_limit.min(num_cpus::get())
        } else {
            (num_cpus::get() / 2).max(1)
        }
    }

    fn detect_hw_concurrency_limit() -> usize {
        #[cfg(target_os = "macos")]
        {
            if let Ok(output) = std::process::Command::new("sysctl")
                .args(["-n", "machdep.cpu.brand_string"])
                .output()
            {
                let brand = String::from_utf8_lossy(&output.stdout);
                let brand = brand.trim().to_lowercase();
                if brand.contains("ultra") {
                    return 4;
                }
                if brand.contains("max") {
                    return 3;
                }
            }
        }
        2
    }

    /// Start processing all pending tasks in parallel
    pub fn start_all(
        &self,
        ffmpeg_path: PathBuf,
        config: CompressionConfig,
        encoders: Vec<EncoderInfo>,
        channel: Channel<ProgressEvent>,
    ) {
        let tasks = self.base.tasks.clone();
        let order = self.base.task_order.clone();
        let is_running = self.base.is_running.clone();
        let max_concurrent = Self::max_concurrency(&config, &encoders);

        std::thread::spawn(move || {
            *safe_lock(&is_running) = true;

            let pending: Vec<(String, VideoInfo, Arc<AtomicBool>)> = {
                let tasks_guard = safe_lock(&tasks);
                let order_guard = safe_lock(&order);
                order_guard
                    .iter()
                    .filter_map(|id| {
                        tasks_guard.get(id).and_then(|entry| {
                            if entry.info.status == TaskStatus::Pending {
                                Some((id.clone(), entry.payload.clone(), entry.cancel_flag.clone()))
                            } else {
                                None
                            }
                        })
                    })
                    .collect()
            };

            let active_count = Arc::new((std::sync::Mutex::new(0_usize), std::sync::Condvar::new()));
            let mut handles = Vec::new();

            for (task_id, video, cancel_flag) in pending {
                {
                    let (ref count_mutex, ref cvar) = *active_count;
                    let mut count = safe_lock(count_mutex);
                    while *count >= max_concurrent {
                        count = match cvar.wait(count) {
                            Ok(c) => c,
                            Err(poisoned) => poisoned.into_inner(),
                        };
                    }
                    *count += 1;
                }

                {
                    let mut tasks_guard = safe_lock(&tasks);
                    if let Some(entry) = tasks_guard.get_mut(&task_id) {
                        entry.info.status = TaskStatus::Running;
                        entry.info.progress = 0.0;
                    }
                }

                let ffmpeg_path = ffmpeg_path.clone();
                let config = config.clone();
                let encoders = encoders.clone();
                let channel = channel.clone();
                let tasks = tasks.clone();
                let active_count = active_count.clone();

                let handle = std::thread::spawn(move || {
                    let result = run_task(
                        &ffmpeg_path,
                        &video,
                        &config,
                        &encoders,
                        &task_id,
                        &channel,
                        &cancel_flag,
                    );

                    match result {
                        Ok((output_path, output_size)) => {
                            let mut tasks_guard = safe_lock(&tasks);
                            if let Some(entry) = tasks_guard.get_mut(&task_id) {
                                entry.info.status = TaskStatus::Completed;
                                entry.info.progress = 100.0;
                                entry.info.output_path = output_path;
                                entry.info.output_size = Some(output_size);
                            }
                        }
                        Err(AppError::Cancelled) => {
                            let mut tasks_guard = safe_lock(&tasks);
                            if let Some(entry) = tasks_guard.get_mut(&task_id) {
                                entry.info.status = TaskStatus::Cancelled;
                            }
                        }
                        Err(e) => {
                            let _ = channel.send(ProgressEvent::Failed {
                                task_id: task_id.clone(),
                                error: e.to_string(),
                            });
                            let mut tasks_guard = safe_lock(&tasks);
                            if let Some(entry) = tasks_guard.get_mut(&task_id) {
                                entry.info.status = TaskStatus::Failed;
                                entry.info.error = Some(e.to_string());
                            }
                        }
                    }

                    let (ref count_mutex, ref cvar) = *active_count;
                    let mut count = safe_lock(count_mutex);
                    *count -= 1;
                    cvar.notify_one();
                });

                handles.push(handle);
            }

            for handle in handles {
                let _ = handle.join();
            }

            *safe_lock(&is_running) = false;
        });
    }

    // Delegate shared methods to base
    pub fn cancel_task(&self, task_id: &str) -> Result<(), AppError> {
        self.base.cancel_task(task_id)
    }

    pub fn cancel_all(&self) {
        self.base.cancel_all();
    }

    pub fn get_tasks(&self) -> Vec<TaskInfo> {
        self.base.get_tasks()
    }

    pub fn clear_completed(&self) {
        self.base.clear_completed();
    }

    pub fn retry_failed(&self) -> Vec<TaskInfo> {
        self.base.retry_failed()
    }

    pub fn shutdown(&self) {
        self.base.shutdown();
    }

    pub fn remove_task(&self, task_id: &str) -> Result<(), AppError> {
        self.base.remove_task(task_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_config() -> CompressionConfig {
        CompressionConfig::default()
    }

    fn make_video(path: &str) -> VideoInfo {
        VideoInfo {
            path: path.into(),
            file_name: path.split('/').last().unwrap_or("test.mp4").into(),
            size: 1024 * 1024,
            duration: 60.0,
            width: 1920,
            height: 1080,
            codec: "hevc".into(),
            bitrate: 5_000_000,
            fps: 30.0,
            audio_codec: Some("aac".into()),
            audio_bitrate: Some(128_000),
        }
    }

    #[test]
    fn test_add_tasks_generates_ids() {
        let mgr = TaskManager::new();
        let tasks = mgr.add_tasks(vec![make_video("/video1.mp4"), make_video("/video2.mp4")], &default_config());
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].id, "task_1");
        assert_eq!(tasks[1].id, "task_2");
    }

    #[test]
    fn test_add_tasks_increments_ids() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/v1.mp4")], &default_config());
        let tasks = mgr.add_tasks(vec![make_video("/v2.mp4")], &default_config());
        assert_eq!(tasks[0].id, "task_2");
    }

    #[test]
    fn test_cancel_task_pending() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/v.mp4")], &default_config());
        assert!(mgr.cancel_task("task_1").is_ok());
        assert_eq!(mgr.get_tasks()[0].status, TaskStatus::Cancelled);
    }

    #[test]
    fn test_cancel_task_not_found() {
        let mgr = TaskManager::new();
        assert!(mgr.cancel_task("nonexistent").is_err());
    }

    #[test]
    fn test_cancel_all_pending_tasks() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/a.mp4"), make_video("/b.mp4")], &default_config());
        mgr.cancel_all();
        assert!(mgr.get_tasks().iter().all(|t| t.status == TaskStatus::Cancelled));
    }

    #[test]
    fn test_clear_completed() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/a.mp4"), make_video("/b.mp4"), make_video("/c.mp4")], &default_config());
        mgr.cancel_task("task_1").unwrap();
        mgr.clear_completed();
        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 2);
        assert!(tasks.iter().all(|t| t.status == TaskStatus::Pending));
    }

    #[test]
    fn test_remove_task() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/a.mp4"), make_video("/b.mp4")], &default_config());
        mgr.remove_task("task_1").unwrap();
        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, "task_2");
    }

    #[test]
    fn test_max_concurrency_user_override() {
        let config = CompressionConfig { max_concurrency: Some(5), ..CompressionConfig::default() };
        let encoders = vec![EncoderInfo { name: "hevc_videotoolbox".into(), codec: "h265".into(), is_hardware: true, priority: 10 }];
        assert_eq!(TaskManager::max_concurrency(&config, &encoders), 5);
    }

    #[test]
    fn test_max_concurrency_user_override_minimum_1() {
        let config = CompressionConfig { max_concurrency: Some(0), ..CompressionConfig::default() };
        assert_eq!(TaskManager::max_concurrency(&config, &[]), 1);
    }

    #[test]
    fn test_empty_add_tasks() {
        let mgr = TaskManager::new();
        assert!(mgr.add_tasks(vec![], &default_config()).is_empty());
    }
}
