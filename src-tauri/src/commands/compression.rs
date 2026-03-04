use tauri::ipc::Channel;
use tauri::State;

use crate::ffmpeg::args::CompressionConfig;
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::progress::ProgressEvent;
use crate::state::AppState;
use crate::task::types::TaskInfo;
use crate::utils::error::AppError;

#[tauri::command]
pub fn start_compression(
    videos: Vec<VideoInfo>,
    config: CompressionConfig,
    channel: Channel<ProgressEvent>,
    state: State<'_, AppState>,
) -> Result<Vec<TaskInfo>, AppError> {
    let ffmpeg_path = state.ffmpeg_path.lock().unwrap();
    let ffmpeg = ffmpeg_path
        .clone()
        .ok_or(AppError::FfmpegNotFound)?;

    let encoders = state.encoders.lock().unwrap().clone();

    let task_infos = state.task_manager.add_tasks(videos);

    state.task_manager.start_all(ffmpeg, config, encoders, channel);

    Ok(task_infos)
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
