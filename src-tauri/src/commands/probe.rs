use std::path::Path;

use tauri::State;

use crate::ffmpeg::probe::{probe_video, VideoInfo};
use crate::state::AppState;
use crate::utils::error::AppError;
use crate::utils::path::is_supported_video;

#[tauri::command]
pub fn probe_videos(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<VideoInfo>, AppError> {
    let ffprobe_path = state.ffprobe_path.lock().unwrap();
    let ffprobe = ffprobe_path
        .as_ref()
        .ok_or(AppError::FfmpegNotFound)?;

    let mut results = Vec::new();

    for path_str in &paths {
        let path = Path::new(path_str);
        if !is_supported_video(path) {
            continue;
        }
        match probe_video(ffprobe, path) {
            Ok(info) => results.push(info),
            Err(e) => {
                log::warn!("Failed to probe {}: {}", path_str, e);
            }
        }
    }

    Ok(results)
}
