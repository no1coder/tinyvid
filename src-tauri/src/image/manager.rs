use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::ipc::Channel;

use super::compress::compress_image;
use super::config::ImageCompressionConfig;
use super::probe::ImageInfo;
use crate::ffmpeg::progress::ProgressEvent;
use crate::task::base_manager::{BaseTaskManager, TaskEntry};
use crate::task::types::{TaskInfo, TaskStatus};
use crate::utils::error::{safe_lock, AppError};
use crate::utils::path::generate_image_output_path;

pub struct ImageTaskManager {
    base: BaseTaskManager<ImageInfo>,
}

impl ImageTaskManager {
    pub fn new() -> Self {
        Self {
            base: BaseTaskManager::new(),
        }
    }

    /// Add images to the task queue, returning their task IDs
    pub fn add_tasks(
        &self,
        images: Vec<ImageInfo>,
        config: &ImageCompressionConfig,
    ) -> Vec<TaskInfo> {
        let mut tasks = safe_lock(&self.base.tasks);
        let mut order = safe_lock(&self.base.task_order);
        let mut next_id = safe_lock(&self.base.next_id);
        let mut result = Vec::new();

        for image in images {
            let id = format!("img_{}", *next_id);
            *next_id += 1;

            let output_path = generate_image_output_path(
                std::path::Path::new(&image.path),
                config.output_dir.as_deref(),
                &config.output_format,
                &config.filename_template,
            );

            let info = TaskInfo {
                id: id.clone(),
                input_path: image.path.clone(),
                output_path: output_path.to_string_lossy().to_string(),
                file_name: image.file_name.clone(),
                status: TaskStatus::Pending,
                progress: 0.0,
                input_size: image.size,
                output_size: None,
                error: None,
            };

            let entry = TaskEntry {
                info: info.clone(),
                payload: image,
                cancel_flag: Arc::new(AtomicBool::new(false)),
            };

            tasks.insert(id.clone(), entry);
            order.push(id);
            result.push(info);
        }

        result
    }

    /// Determine max concurrency (CPU-bound, default: num_cpus / 2)
    fn max_concurrency(config: &ImageCompressionConfig) -> usize {
        if let Some(user_max) = config.max_concurrency {
            return user_max.max(1);
        }
        (num_cpus::get() / 2).max(1)
    }

    /// Start processing all pending tasks in parallel
    pub fn start_all(
        &self,
        config: ImageCompressionConfig,
        channel: Channel<ProgressEvent>,
    ) {
        let tasks = self.base.tasks.clone();
        let is_running = self.base.is_running.clone();
        let max_concurrent = Self::max_concurrency(&config);
        let pending = self.base.collect_pending();

        std::thread::spawn(move || {
            *safe_lock(&is_running) = true;

            // Semaphore via Mutex + Condvar
            let active_count = Arc::new((std::sync::Mutex::new(0_usize), std::sync::Condvar::new()));
            let mut handles = Vec::new();

            for (task_id, image, cancel_flag) in pending {
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

                // Mark as running after acquiring slot
                {
                    let mut tasks_guard = safe_lock(&tasks);
                    if let Some(entry) = tasks_guard.get_mut(&task_id) {
                        entry.info.status = TaskStatus::Running;
                        entry.info.progress = 0.0;
                    }
                }

                // Send started event
                let _ = channel.send(ProgressEvent::Started {
                    task_id: task_id.clone(),
                });

                let config = config.clone();
                let channel = channel.clone();
                let tasks = tasks.clone();
                let active_count = active_count.clone();

                let handle = std::thread::spawn(move || {
                    let output_path = {
                        let tasks_guard = safe_lock(&tasks);
                        tasks_guard
                            .get(&task_id)
                            .map(|e| e.info.output_path.clone())
                            .unwrap_or_default()
                    };

                    // Simulated progress: caesium compresses in-memory then writes
                    // all at once, so we use time-based estimation instead.
                    let done_flag = Arc::new(AtomicBool::new(false));
                    let monitor_done = done_flag.clone();
                    let monitor_channel = channel.clone();
                    let monitor_task_id = task_id.clone();
                    let input_size = image.size;
                    let start_time = std::time::Instant::now();
                    let is_lossless = config.mode == "lossless";

                    let monitor_handle = std::thread::spawn(move || {
                        // Estimate total time based on file size and mode
                        let bytes_per_sec: f64 = if is_lossless {
                            1_000_000.0  // ~1 MB/s for lossless
                        } else {
                            3_000_000.0  // ~3 MB/s for lossy
                        };
                        let estimated_secs = (input_size as f64 / bytes_per_sec).max(0.5);

                        while !monitor_done.load(Ordering::Acquire) {
                            std::thread::sleep(std::time::Duration::from_millis(100));
                            if monitor_done.load(Ordering::Acquire) {
                                break;
                            }
                            let elapsed = start_time.elapsed().as_secs_f64();
                            // Asymptotic curve: approaches 95% but never reaches it
                            let percent = (1.0 - (-2.0 * elapsed / estimated_secs).exp()) * 95.0;
                            let eta = (estimated_secs - elapsed).max(0.0);
                            let _ = monitor_channel.send(ProgressEvent::Progress {
                                task_id: monitor_task_id.clone(),
                                percent,
                                fps: 0.0,
                                speed: 0.0,
                                time_elapsed: elapsed,
                                eta,
                                current_size: 0,
                            });
                        }
                    });

                    let result = compress_image(
                        &image.path,
                        &output_path,
                        &config,
                        &cancel_flag,
                    );

                    // Stop the monitor
                    done_flag.store(true, Ordering::Release);
                    let _ = monitor_handle.join();

                    match result {
                        Ok(output_size) => {
                            let _ = channel.send(ProgressEvent::Completed {
                                task_id: task_id.clone(),
                                output_path: output_path.clone(),
                                output_size,
                            });
                            let mut tasks_guard = safe_lock(&tasks);
                            if let Some(entry) = tasks_guard.get_mut(&task_id) {
                                entry.info.status = TaskStatus::Completed;
                                entry.info.progress = 100.0;
                                entry.info.output_size = Some(output_size);
                            }
                        }
                        Err(AppError::Cancelled) => {
                            let _ = channel.send(ProgressEvent::Cancelled {
                                task_id: task_id.clone(),
                            });
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

                    // Release slot
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

    fn default_config() -> ImageCompressionConfig {
        ImageCompressionConfig::default()
    }

    fn make_image(path: &str) -> ImageInfo {
        ImageInfo {
            path: path.into(),
            file_name: path.split('/').last().unwrap_or("test.png").into(),
            size: 1024 * 100,
            width: 1920,
            height: 1080,
            format: "png".into(),
        }
    }

    #[test]
    fn test_add_tasks_generates_ids() {
        let mgr = ImageTaskManager::new();
        let images = vec![make_image("/a.png"), make_image("/b.jpg")];
        let tasks = mgr.add_tasks(images, &default_config());

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].id, "img_1");
        assert_eq!(tasks[1].id, "img_2");
    }

    #[test]
    fn test_add_tasks_sets_pending_status() {
        let mgr = ImageTaskManager::new();
        let tasks = mgr.add_tasks(vec![make_image("/a.png")], &default_config());

        assert_eq!(tasks[0].status, TaskStatus::Pending);
        assert_eq!(tasks[0].progress, 0.0);
        assert!(tasks[0].output_size.is_none());
    }

    #[test]
    fn test_add_tasks_output_path() {
        let mgr = ImageTaskManager::new();
        let tasks = mgr.add_tasks(vec![make_image("/images/test.png")], &default_config());

        assert_eq!(tasks[0].output_path, "/images/test_compressed.png");
    }

    #[test]
    fn test_get_tasks_preserves_order() {
        let mgr = ImageTaskManager::new();
        mgr.add_tasks(
            vec![
                make_image("/a.png"),
                make_image("/b.jpg"),
                make_image("/c.webp"),
            ],
            &default_config(),
        );

        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 3);
        assert_eq!(tasks[0].id, "img_1");
        assert_eq!(tasks[1].id, "img_2");
        assert_eq!(tasks[2].id, "img_3");
    }

    #[test]
    fn test_cancel_task_pending() {
        let mgr = ImageTaskManager::new();
        mgr.add_tasks(vec![make_image("/a.png")], &default_config());

        let result = mgr.cancel_task("img_1");
        assert!(result.is_ok());

        let tasks = mgr.get_tasks();
        assert_eq!(tasks[0].status, TaskStatus::Cancelled);
    }

    #[test]
    fn test_cancel_task_not_found() {
        let mgr = ImageTaskManager::new();
        let result = mgr.cancel_task("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_cancel_all() {
        let mgr = ImageTaskManager::new();
        mgr.add_tasks(
            vec![make_image("/a.png"), make_image("/b.png")],
            &default_config(),
        );

        mgr.cancel_all();

        let tasks = mgr.get_tasks();
        assert!(tasks.iter().all(|t| t.status == TaskStatus::Cancelled));
    }

    #[test]
    fn test_clear_completed() {
        let mgr = ImageTaskManager::new();
        mgr.add_tasks(
            vec![
                make_image("/a.png"),
                make_image("/b.png"),
                make_image("/c.png"),
            ],
            &default_config(),
        );

        mgr.cancel_task("img_1").unwrap();
        mgr.clear_completed();

        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 2);
        assert!(tasks.iter().all(|t| t.status == TaskStatus::Pending));
    }

    #[test]
    fn test_remove_task() {
        let mgr = ImageTaskManager::new();
        mgr.add_tasks(
            vec![make_image("/a.png"), make_image("/b.png")],
            &default_config(),
        );

        mgr.remove_task("img_1").unwrap();

        let tasks = mgr.get_tasks();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, "img_2");
    }

    #[test]
    fn test_retry_failed() {
        let mgr = ImageTaskManager::new();
        mgr.add_tasks(vec![make_image("/a.png")], &default_config());

        // Simulate failure by manually setting status
        {
            let mut tasks = safe_lock(&mgr.base.tasks);
            if let Some(entry) = tasks.get_mut("img_1") {
                entry.info.status = TaskStatus::Failed;
                entry.info.error = Some("test error".into());
            }
        }

        let retried = mgr.retry_failed();
        assert_eq!(retried.len(), 1);
        assert_eq!(retried[0].status, TaskStatus::Pending);
        assert!(retried[0].error.is_none());
    }

    #[test]
    fn test_max_concurrency_default() {
        let config = ImageCompressionConfig::default();
        let max = ImageTaskManager::max_concurrency(&config);
        assert!(max >= 1);
    }

    #[test]
    fn test_max_concurrency_user_override() {
        let config = ImageCompressionConfig {
            max_concurrency: Some(8),
            ..Default::default()
        };
        let max = ImageTaskManager::max_concurrency(&config);
        assert_eq!(max, 8);
    }

    #[test]
    fn test_max_concurrency_minimum() {
        let config = ImageCompressionConfig {
            max_concurrency: Some(0),
            ..Default::default()
        };
        let max = ImageTaskManager::max_concurrency(&config);
        assert_eq!(max, 1);
    }

    #[test]
    fn test_empty_add_tasks() {
        let mgr = ImageTaskManager::new();
        let tasks = mgr.add_tasks(vec![], &default_config());
        assert!(tasks.is_empty());
        assert!(mgr.get_tasks().is_empty());
    }
}
