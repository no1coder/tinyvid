use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;

use crate::ffmpeg::args::CompressionConfig;
use crate::ffmpeg::encoder::EncoderInfo;
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::progress::ProgressEvent;
use crate::utils::error::AppError;
use crate::utils::path::generate_output_path;

use super::types::{TaskInfo, TaskStatus};
use super::worker::run_task;

#[derive(Debug)]
struct TaskEntry {
    info: TaskInfo,
    video: VideoInfo,
}

pub struct TaskManager {
    tasks: Arc<Mutex<HashMap<String, TaskEntry>>>,
    task_order: Arc<Mutex<Vec<String>>>,
    next_id: Arc<Mutex<u32>>,
    is_running: Arc<Mutex<bool>>,
    cancel_flag: Arc<Mutex<bool>>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            task_order: Arc::new(Mutex::new(Vec::new())),
            next_id: Arc::new(Mutex::new(1)),
            is_running: Arc::new(Mutex::new(false)),
            cancel_flag: Arc::new(Mutex::new(false)),
        }
    }

    /// Add videos to the task queue, returning their task IDs
    pub fn add_tasks(&self, videos: Vec<VideoInfo>) -> Vec<TaskInfo> {
        let mut tasks = self.tasks.lock().unwrap();
        let mut order = self.task_order.lock().unwrap();
        let mut next_id = self.next_id.lock().unwrap();
        let mut result = Vec::new();

        for video in videos {
            let id = format!("task_{}", *next_id);
            *next_id += 1;

            let output_path = generate_output_path(std::path::Path::new(&video.path));
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
            };

            tasks.insert(id.clone(), entry);
            order.push(id);
            result.push(info);
        }

        result
    }

    /// Start processing the task queue sequentially
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
        let cancel_flag = self.cancel_flag.clone();

        // Reset cancel flag
        *cancel_flag.lock().unwrap() = false;

        std::thread::spawn(move || {
            *is_running.lock().unwrap() = true;

            let task_ids: Vec<String> = order.lock().unwrap().clone();

            for task_id in &task_ids {
                // Check global cancel
                if *cancel_flag.lock().unwrap() {
                    break;
                }

                // Get task info
                let (video, should_run) = {
                    let tasks_guard = tasks.lock().unwrap();
                    if let Some(entry) = tasks_guard.get(task_id) {
                        (
                            entry.video.clone(),
                            entry.info.status == TaskStatus::Pending,
                        )
                    } else {
                        continue;
                    }
                };

                if !should_run {
                    continue;
                }

                // Mark as running
                {
                    let mut tasks_guard = tasks.lock().unwrap();
                    if let Some(entry) = tasks_guard.get_mut(task_id) {
                        entry.info.status = TaskStatus::Running;
                        entry.info.progress = 0.0;
                    }
                }

                // Run the task
                match run_task(
                    &ffmpeg_path,
                    &video,
                    &config,
                    &encoders,
                    task_id,
                    &channel,
                ) {
                    Ok((output_path, output_size)) => {
                        let mut tasks_guard = tasks.lock().unwrap();
                        if let Some(entry) = tasks_guard.get_mut(task_id) {
                            entry.info.status = TaskStatus::Completed;
                            entry.info.progress = 100.0;
                            entry.info.output_path = output_path;
                            entry.info.output_size = Some(output_size);
                        }
                    }
                    Err(AppError::Cancelled) => {
                        let mut tasks_guard = tasks.lock().unwrap();
                        if let Some(entry) = tasks_guard.get_mut(task_id) {
                            entry.info.status = TaskStatus::Cancelled;
                        }
                    }
                    Err(e) => {
                        let _ = channel.send(ProgressEvent::Failed {
                            task_id: task_id.clone(),
                            error: e.to_string(),
                        });
                        let mut tasks_guard = tasks.lock().unwrap();
                        if let Some(entry) = tasks_guard.get_mut(task_id) {
                            entry.info.status = TaskStatus::Failed;
                            entry.info.error = Some(e.to_string());
                        }
                    }
                }
            }

            *is_running.lock().unwrap() = false;
        });
    }

    /// Cancel all pending/running tasks
    pub fn cancel_all(&self) {
        *self.cancel_flag.lock().unwrap() = true;
        let mut tasks = self.tasks.lock().unwrap();
        for entry in tasks.values_mut() {
            if entry.info.status == TaskStatus::Pending
                || entry.info.status == TaskStatus::Running
            {
                entry.info.status = TaskStatus::Cancelled;
            }
        }
    }

    /// Get all task infos
    pub fn get_tasks(&self) -> Vec<TaskInfo> {
        let tasks = self.tasks.lock().unwrap();
        let order = self.task_order.lock().unwrap();
        order
            .iter()
            .filter_map(|id| tasks.get(id).map(|e| e.info.clone()))
            .collect()
    }

    /// Remove completed/cancelled/failed tasks
    pub fn clear_completed(&self) {
        let mut tasks = self.tasks.lock().unwrap();
        let mut order = self.task_order.lock().unwrap();

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

    /// Remove a specific task
    pub fn remove_task(&self, task_id: &str) -> Result<(), AppError> {
        let mut tasks = self.tasks.lock().unwrap();
        let mut order = self.task_order.lock().unwrap();

        if tasks.remove(task_id).is_some() {
            order.retain(|id| id != task_id);
            Ok(())
        } else {
            Err(AppError::TaskNotFound(task_id.to_string()))
        }
    }
}
