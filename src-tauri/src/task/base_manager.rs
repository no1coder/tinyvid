use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use crate::utils::error::{safe_lock, AppError};

use super::types::{TaskInfo, TaskStatus};

/// A single entry in the task queue, holding the task metadata,
/// the domain-specific payload (e.g. VideoInfo or ImageInfo),
/// and a cancel flag.
pub struct TaskEntry<P> {
    pub info: TaskInfo,
    pub payload: P,
    pub cancel_flag: Arc<AtomicBool>,
}

/// Generic task manager that provides shared queue management logic.
/// `P` is the domain-specific payload type (VideoInfo, ImageInfo, etc.).
pub struct BaseTaskManager<P> {
    pub tasks: Arc<Mutex<HashMap<String, TaskEntry<P>>>>,
    pub task_order: Arc<Mutex<Vec<String>>>,
    pub next_id: Arc<Mutex<u32>>,
    pub is_running: Arc<Mutex<bool>>,
}

impl<P: Clone + Send + 'static> BaseTaskManager<P> {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            task_order: Arc::new(Mutex::new(Vec::new())),
            next_id: Arc::new(Mutex::new(1)),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    /// Cancel a specific task
    pub fn cancel_task(&self, task_id: &str) -> Result<(), AppError> {
        let mut tasks = safe_lock(&self.tasks);
        if let Some(entry) = tasks.get_mut(task_id) {
            entry.cancel_flag.store(true, Ordering::Release);
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
                entry.cancel_flag.store(true, Ordering::Release);
                if entry.info.status == TaskStatus::Pending {
                    entry.info.status = TaskStatus::Cancelled;
                }
            }
        }
    }

    /// Get all task infos in insertion order
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

    /// Reset failed tasks back to pending for retry
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

    /// Cancel all tasks (called during app shutdown)
    pub fn shutdown(&self) {
        self.cancel_all();
    }

    /// Collect pending tasks as (task_id, payload, cancel_flag) tuples
    pub fn collect_pending(&self) -> Vec<(String, P, Arc<AtomicBool>)> {
        let tasks_guard = safe_lock(&self.tasks);
        let order_guard = safe_lock(&self.task_order);
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
    }

}
