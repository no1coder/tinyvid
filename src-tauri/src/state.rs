use std::path::PathBuf;
use std::sync::Mutex;

use crate::ffmpeg::encoder::EncoderInfo;
use crate::image::manager::ImageTaskManager;
use crate::task::manager::TaskManager;

pub struct AppState {
    pub ffmpeg_path: Mutex<Option<PathBuf>>,
    pub ffprobe_path: Mutex<Option<PathBuf>>,
    pub encoders: Mutex<Vec<EncoderInfo>>,
    pub task_manager: TaskManager,
    pub image_task_manager: ImageTaskManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            ffmpeg_path: Mutex::new(None),
            ffprobe_path: Mutex::new(None),
            encoders: Mutex::new(Vec::new()),
            task_manager: TaskManager::new(),
            image_task_manager: ImageTaskManager::new(),
        }
    }
}
