use tauri::State;

use crate::state::AppState;
use crate::ffmpeg::encoder::EncoderInfo;
use crate::utils::error::AppError;

#[tauri::command]
pub fn detect_hardware(state: State<'_, AppState>) -> Result<Vec<EncoderInfo>, AppError> {
    let encoders = state.encoders.lock().unwrap();
    Ok(encoders.clone())
}

#[tauri::command]
pub fn get_ffmpeg_version(state: State<'_, AppState>) -> Result<String, AppError> {
    let ffmpeg_path = state.ffmpeg_path.lock().unwrap();
    let path = ffmpeg_path
        .as_ref()
        .ok_or(AppError::FfmpegNotFound)?;

    let output = std::process::Command::new(path)
        .arg("-version")
        .output()?;

    let version = String::from_utf8_lossy(&output.stdout);
    let first_line = version.lines().next().unwrap_or("unknown").to_string();
    Ok(first_line)
}
