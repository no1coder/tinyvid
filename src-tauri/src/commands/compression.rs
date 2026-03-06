use tauri::ipc::Channel;
use tauri::State;

use crate::ffmpeg::args::{validate_config, CompressionConfig};
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::progress::ProgressEvent;
use crate::state::AppState;
use crate::task::types::TaskInfo;
use crate::utils::error::{safe_lock, AppError};
use crate::utils::path::validate_local_path;

#[tauri::command]
pub fn start_compression(
    videos: Vec<VideoInfo>,
    config: CompressionConfig,
    channel: Channel<ProgressEvent>,
    state: State<'_, AppState>,
) -> Result<Vec<TaskInfo>, AppError> {
    validate_config(&config)?;

    // Validate all input paths are safe local files
    for video in &videos {
        validate_local_path(std::path::Path::new(&video.path))?;
    }

    let ffmpeg_path = safe_lock(&state.ffmpeg_path);
    let ffmpeg = ffmpeg_path
        .clone()
        .ok_or(AppError::FfmpegNotFound)?;

    let encoders = safe_lock(&state.encoders).clone();

    let task_infos = state.task_manager.add_tasks(videos, &config);

    state.task_manager.start_all(ffmpeg, config, encoders, channel);

    Ok(task_infos)
}

#[tauri::command]
pub fn cancel_task(task_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    state.task_manager.cancel_task(&task_id)
}

#[tauri::command]
pub fn cancel_all(state: State<'_, AppState>) -> Result<(), AppError> {
    state.task_manager.cancel_all();
    Ok(())
}

#[tauri::command]
pub fn get_tasks(state: State<'_, AppState>) -> Result<Vec<TaskInfo>, AppError> {
    Ok(state.task_manager.get_tasks())
}

#[tauri::command]
pub fn clear_completed(state: State<'_, AppState>) -> Result<(), AppError> {
    state.task_manager.clear_completed();
    Ok(())
}

#[tauri::command]
pub fn remove_task(task_id: String, state: State<'_, AppState>) -> Result<(), AppError> {
    state.task_manager.remove_task(&task_id)
}

/// Retry all failed tasks with the same or updated config
#[tauri::command]
pub fn retry_failed(
    config: CompressionConfig,
    channel: Channel<ProgressEvent>,
    state: State<'_, AppState>,
) -> Result<Vec<TaskInfo>, AppError> {
    validate_config(&config)?;

    let ffmpeg_path = safe_lock(&state.ffmpeg_path);
    let ffmpeg = ffmpeg_path.clone().ok_or(AppError::FfmpegNotFound)?;
    let encoders = safe_lock(&state.encoders).clone();

    let task_infos = state.task_manager.retry_failed();

    if !task_infos.is_empty() {
        state
            .task_manager
            .start_all(ffmpeg, config, encoders, channel);
    }

    Ok(task_infos)
}
