use tauri::ipc::Channel;
use tauri::State;

use crate::ffmpeg::progress::ProgressEvent;
use crate::image::config::{validate_image_config, ImageCompressionConfig};
use crate::image::probe::{collect_images, ImageInfo};
use crate::state::AppState;
use crate::task::types::TaskInfo;
use crate::utils::error::AppError;

#[tauri::command]
pub fn probe_images(paths: Vec<String>) -> Result<Vec<ImageInfo>, AppError> {
    Ok(collect_images(&paths))
}

#[tauri::command]
pub fn add_image_tasks(
    images: Vec<ImageInfo>,
    config: ImageCompressionConfig,
    state: State<'_, AppState>,
) -> Result<Vec<TaskInfo>, AppError> {
    validate_image_config(&config)?;
    Ok(state.image_task_manager.add_tasks(images, &config))
}

#[tauri::command]
pub fn run_image_compression(
    config: ImageCompressionConfig,
    channel: Channel<ProgressEvent>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    validate_image_config(&config)?;
    state.image_task_manager.start_all(config, channel);
    Ok(())
}

#[tauri::command]
pub fn cancel_image_task(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.image_task_manager.cancel_task(&task_id)
}

#[tauri::command]
pub fn cancel_all_images(state: State<'_, AppState>) -> Result<(), AppError> {
    state.image_task_manager.cancel_all();
    Ok(())
}

#[tauri::command]
pub fn get_image_tasks(state: State<'_, AppState>) -> Result<Vec<TaskInfo>, AppError> {
    Ok(state.image_task_manager.get_tasks())
}

#[tauri::command]
pub fn clear_completed_images(state: State<'_, AppState>) -> Result<(), AppError> {
    state.image_task_manager.clear_completed();
    Ok(())
}

#[tauri::command]
pub fn remove_image_task(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.image_task_manager.remove_task(&task_id)
}

#[tauri::command]
pub fn retry_failed_images(
    state: State<'_, AppState>,
) -> Result<Vec<TaskInfo>, AppError> {
    Ok(state.image_task_manager.retry_failed())
}
