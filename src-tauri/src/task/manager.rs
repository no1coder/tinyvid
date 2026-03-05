use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;

use crate::ffmpeg::args::CompressionConfig;
use crate::ffmpeg::encoder::EncoderInfo;
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::progress::ProgressEvent;
use crate::utils::error::{safe_lock, AppError};
use crate::utils::path::generate_output_path;

use super::types::{TaskInfo, TaskStatus};
use super::worker::run_task;

struct TaskEntry {
    info: TaskInfo,
    video: VideoInfo,
    cancel_flag: Arc<AtomicBool>,
}

pub struct TaskManager {
    tasks: Arc<Mutex<HashMap<String, TaskEntry>>>,
    task_order: Arc<Mutex<Vec<String>>>,
    next_id: Arc<Mutex<u32>>,
    is_running: Arc<Mutex<bool>>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            task_order: Arc::new(Mutex::new(Vec::new())),
            next_id: Arc::new(Mutex::new(1)),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Add videos to the task queue, returning their task IDs
    pub fn add_tasks(&self, videos: Vec<VideoInfo>, output_dir: Option<&str>) -> Vec<TaskInfo> {
        let mut tasks = safe_lock(&self.tasks);
        let mut order = safe_lock(&self.task_order);
        let mut next_id = safe_lock(&self.next_id);
        let mut result = Vec::new();

        for video in videos {
            let id = format!("task_{}", *next_id);
            *next_id += 1;

            let output_path = generate_output_path(std::path::Path::new(&video.path), output_dir);
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
                video,
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
            // On Apple Silicon, chips with multiple Media Engines (Ultra/Max)
            // can handle more concurrent HW encode tasks
            let hw_limit = Self::detect_hw_concurrency_limit();
            hw_limit.min(num_cpus::get())
        } else {
            (num_cpus::get() / 2).max(1)
        }
    }

    /// Detect optimal hardware encoding concurrency based on chip capabilities.
    /// Apple Silicon Ultra chips have dual Media Engines and can handle more tasks.
    fn detect_hw_concurrency_limit() -> usize {
        #[cfg(target_os = "macos")]
        {
            // Check CPU brand string via sysctl for Ultra/Max chips
            if let Ok(output) = std::process::Command::new("sysctl")
                .args(["-n", "machdep.cpu.brand_string"])
                .output()
            {
                let brand = String::from_utf8_lossy(&output.stdout);
                let brand = brand.trim().to_lowercase();
                if brand.contains("ultra") {
                    return 4; // Dual Media Engine
                }
                if brand.contains("max") {
                    return 3; // Powerful single Media Engine + more GPU cores
                }
            }
        }
        2 // Default for standard chips (M1/M2/M3/M4, Intel, etc.)
    }

    /// Start processing all pending tasks in parallel (up to concurrency limit)
    pub fn start_all(
        &self,
        ffmpeg_path: PathBuf,
        config: CompressionConfig,
        encoders: Vec<EncoderInfo>,
        channel: Channel<ProgressEvent>,
    ) {
        let tasks = self.tasks.clone();
        let order = self.task_order.clone();
        let is_running = self.is_running.clone();

        let max_concurrent = Self::max_concurrency(&config, &encoders);

        std::thread::spawn(move || {
            *safe_lock(&is_running) = true;

            // Collect pending task IDs and their cancel flags
            let pending: Vec<(String, VideoInfo, Arc<AtomicBool>)> = {
                let tasks_guard = safe_lock(&tasks);
                let order_guard = safe_lock(&order);
                order_guard
                    .iter()
                    .filter_map(|id| {
                        tasks_guard.get(id).and_then(|entry| {
                            if entry.info.status == TaskStatus::Pending {
                                Some((id.clone(), entry.video.clone(), entry.cancel_flag.clone()))
                            } else {
                                None
                            }
                        })
                    })
                    .collect()
            };

            // Use a simple semaphore via Arc<Mutex<usize>> + Condvar
            let active_count = Arc::new((Mutex::new(0_usize), std::sync::Condvar::new()));
            let mut handles = Vec::new();

            for (task_id, video, cancel_flag) in pending {
                // Mark as running
                {
                    let mut tasks_guard = safe_lock(&tasks);
                    if let Some(entry) = tasks_guard.get_mut(&task_id) {
                        entry.info.status = TaskStatus::Running;
                        entry.info.progress = 0.0;
                    }
                }

                // Wait for a slot
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

                    // Update task status based on result
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

                    // Release semaphore slot
                    let (ref count_mutex, ref cvar) = *active_count;
                    let mut count = safe_lock(count_mutex);
                    *count -= 1;
                    cvar.notify_one();
                });

                handles.push(handle);
            }

            // Wait for all tasks to finish
            for handle in handles {
                let _ = handle.join();
            }

            *safe_lock(&is_running) = false;
        });
    }

    /// Cancel a specific task
    pub fn cancel_task(&self, task_id: &str) -> Result<(), AppError> {
        let mut tasks = safe_lock(&self.tasks);
        if let Some(entry) = tasks.get_mut(task_id) {
            entry.cancel_flag.store(true, Ordering::Relaxed);
            if entry.info.status == TaskStatus::Pending {
                entry.info.status = TaskStatus::Cancelled;
            }
            Ok(())
        } else {
            Err(AppError::TaskNotFound(task_id.to_string()))
        }
    }

    /// Cancel all pending/running tasks
    pub fn cancel_all(&self) {
        let mut tasks = safe_lock(&self.tasks);
        for entry in tasks.values_mut() {
            if entry.info.status == TaskStatus::Pending
                || entry.info.status == TaskStatus::Running
            {
                entry.cancel_flag.store(true, Ordering::Relaxed);
                if entry.info.status == TaskStatus::Pending {
                    entry.info.status = TaskStatus::Cancelled;
                }
            }
        }
    }

    /// Get all task infos
    pub fn get_tasks(&self) -> Vec<TaskInfo> {
        let tasks = safe_lock(&self.tasks);
        let order = safe_lock(&self.task_order);
        order
            .iter()
            .filter_map(|id| tasks.get(id).map(|e| e.info.clone()))
            .collect()
    }

    /// Remove completed/cancelled/failed tasks
    pub fn clear_completed(&self) {
        let mut tasks = safe_lock(&self.tasks);
        let mut order = safe_lock(&self.task_order);

        let to_remove: Vec<String> = tasks
            .iter()
            .filter(|(_, e)| {
                matches!(
                    e.info.status,
                    TaskStatus::Completed | TaskStatus::Cancelled | TaskStatus::Failed
                )
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in &to_remove {
            tasks.remove(id);
        }
        order.retain(|id| !to_remove.contains(id));
    }

    /// Reset failed tasks back to pending so they can be retried
    pub fn retry_failed(&self) -> Vec<TaskInfo> {
        let mut tasks = safe_lock(&self.tasks);
        let order = safe_lock(&self.task_order);
        let mut retried = Vec::new();

        for id in order.iter() {
            if let Some(entry) = tasks.get_mut(id) {
                if entry.info.status == TaskStatus::Failed {
                    entry.info.status = TaskStatus::Pending;
                    entry.info.progress = 0.0;
                    entry.info.error = None;
                    entry.info.output_size = None;
                    entry.cancel_flag = Arc::new(AtomicBool::new(false));
                    retried.push(entry.info.clone());
                }
            }
        }

        retried
    }

    /// Cancel all tasks and wait for running threads to finish.
    /// Called during app shutdown to prevent zombie processes.
    pub fn shutdown(&self) {
        self.cancel_all();
        // Give running tasks a moment to clean up
        // The actual waiting is handled by the thread handles in start_all
    }

    /// Remove a specific task
    pub fn remove_task(&self, task_id: &str) -> Result<(), AppError> {
        let mut tasks = safe_lock(&self.tasks);
        let mut order = safe_lock(&self.task_order);

        if tasks.remove(task_id).is_some() {
            order.retain(|id| id != task_id);
            Ok(())
        } else {
            Err(AppError::TaskNotFound(task_id.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        let videos = vec![
            make_video("/video1.mp4"),
            make_video("/video2.mp4"),
        ];
        let tasks = mgr.add_tasks(videos, None);

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].id, "task_1");
        assert_eq!(tasks[1].id, "task_2");
    }

    #[test]
    fn test_add_tasks_increments_ids() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/v1.mp4")], None);
        let tasks = mgr.add_tasks(vec![make_video("/v2.mp4")], None);

        assert_eq!(tasks[0].id, "task_2");
    }

    #[test]
    fn test_add_tasks_sets_pending_status() {
        let mgr = TaskManager::new();
        let tasks = mgr.add_tasks(vec![make_video("/v.mp4")], None);

        assert_eq!(tasks[0].status, TaskStatus::Pending);
        assert_eq!(tasks[0].progress, 0.0);
        assert!(tasks[0].output_size.is_none());
        assert!(tasks[0].error.is_none());
    }

    #[test]
    fn test_add_tasks_sets_output_path() {
        let mgr = TaskManager::new();
        let tasks = mgr.add_tasks(vec![make_video("/videos/test.mp4")], None);

        assert_eq!(tasks[0].output_path, "/videos/test_compressed.mp4");
    }

    #[test]
    fn test_add_tasks_sets_file_name() {
        let mgr = TaskManager::new();
        let tasks = mgr.add_tasks(vec![make_video("/dir/my_video.mp4")], None);

        assert_eq!(tasks[0].file_name, "my_video.mp4");
    }

    #[test]
    fn test_add_tasks_sets_input_size() {
        let mgr = TaskManager::new();
        let tasks = mgr.add_tasks(vec![make_video("/v.mp4")], None);

        assert_eq!(tasks[0].input_size, 1024 * 1024);
    }

    #[test]
    fn test_get_tasks_preserves_order() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![
            make_video("/a.mp4"),
            make_video("/b.mp4"),
            make_video("/c.mp4"),
        ], None);

        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].id, "task_1");
        assert_eq!(tasks[1].id, "task_2");
        assert_eq!(tasks[2].id, "task_3");
    }

    #[test]
    fn test_cancel_task_pending() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/v.mp4")], None);

        let result = mgr.cancel_task("task_1");
        assert!(result.is_ok());

        let tasks = mgr.get_tasks();
        assert_eq!(tasks[0].status, TaskStatus::Cancelled);
    }

    #[test]
    fn test_cancel_task_not_found() {
        let mgr = TaskManager::new();

        let result = mgr.cancel_task("nonexistent");
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::TaskNotFound(id) => assert_eq!(id, "nonexistent"),
            e => panic!("Expected TaskNotFound, got: {:?}", e),
        }
    }

    #[test]
    fn test_cancel_all_pending_tasks() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![
            make_video("/a.mp4"),
            make_video("/b.mp4"),
        ], None);

        mgr.cancel_all();

        let tasks = mgr.get_tasks();
        assert!(tasks.iter().all(|t| t.status == TaskStatus::Cancelled));
    }

    #[test]
    fn test_clear_completed() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![
            make_video("/a.mp4"),
            make_video("/b.mp4"),
            make_video("/c.mp4"),
        ], None);

        // Cancel task_1 (becomes Cancelled)
        mgr.cancel_task("task_1").unwrap();

        mgr.clear_completed();

        let tasks = mgr.get_tasks();
        // task_1 was cancelled → removed
        assert_eq!(tasks.len(), 2);
        assert!(tasks.iter().all(|t| t.status == TaskStatus::Pending));
    }

    #[test]
    fn test_remove_task() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![
            make_video("/a.mp4"),
            make_video("/b.mp4"),
        ], None);

        mgr.remove_task("task_1").unwrap();

        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, "task_2");
    }

    #[test]
    fn test_remove_task_not_found() {
        let mgr = TaskManager::new();

        let result = mgr.remove_task("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_max_concurrency_hw() {
        let config = CompressionConfig {
            codec: "h265".into(),
            use_hardware: true,
            ..CompressionConfig::default()
        };
        let encoders = vec![EncoderInfo {
            name: "hevc_videotoolbox".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 10,
        }];

        let max = TaskManager::max_concurrency(&config, &encoders);
        // HW: 2-4 depending on chip (Ultra=4, Max=3, default=2)
        assert!(max >= 1);
        assert!(max <= num_cpus::get());
    }

    #[test]
    fn test_max_concurrency_sw() {
        let config = CompressionConfig {
            codec: "h265".into(),
            use_hardware: false,
            ..CompressionConfig::default()
        };
        let encoders = vec![EncoderInfo {
            name: "libx265".into(),
            codec: "h265".into(),
            is_hardware: false,
            priority: 100,
        }];

        let max = TaskManager::max_concurrency(&config, &encoders);
        assert!(max >= 1); // SW: at least 1
    }

    #[test]
    fn test_max_concurrency_hw_disabled() {
        let config = CompressionConfig {
            codec: "h265".into(),
            use_hardware: false, // disabled
            ..CompressionConfig::default()
        };
        let encoders = vec![
            EncoderInfo {
                name: "hevc_videotoolbox".into(),
                codec: "h265".into(),
                is_hardware: true,
                priority: 10,
            },
            EncoderInfo {
                name: "libx265".into(),
                codec: "h265".into(),
                is_hardware: false,
                priority: 100,
            },
        ];

        let max = TaskManager::max_concurrency(&config, &encoders);
        // use_hardware=false → SW path → num_cpus/2
        assert!(max >= 1);
    }

    #[test]
    fn test_empty_add_tasks() {
        let mgr = TaskManager::new();
        let tasks = mgr.add_tasks(vec![], None);
        assert!(tasks.is_empty());
        assert!(mgr.get_tasks().is_empty());
    }

    #[test]
    fn test_clear_completed_no_effect_on_pending() {
        let mgr = TaskManager::new();
        mgr.add_tasks(vec![make_video("/a.mp4"), make_video("/b.mp4")], None);

        mgr.clear_completed(); // nothing completed

        assert_eq!(mgr.get_tasks().len(), 2);
    }

    #[test]
    fn test_max_concurrency_user_override() {
        let config = CompressionConfig {
            max_concurrency: Some(5),
            ..CompressionConfig::default()
        };
        let encoders = vec![EncoderInfo {
            name: "hevc_videotoolbox".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 10,
        }];
        let max = TaskManager::max_concurrency(&config, &encoders);
        assert_eq!(max, 5);
    }

    #[test]
    fn test_max_concurrency_user_override_minimum_1() {
        let config = CompressionConfig {
            max_concurrency: Some(0),
            ..CompressionConfig::default()
        };
        let max = TaskManager::max_concurrency(&config, &[]);
        assert_eq!(max, 1);
    }
}
