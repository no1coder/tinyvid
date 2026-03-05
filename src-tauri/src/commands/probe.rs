use std::path::{Path, PathBuf};

use tauri::State;

use crate::ffmpeg::probe::{probe_video, VideoInfo};
use crate::state::AppState;
use crate::utils::error::AppError;
use crate::utils::path::is_supported_video;

/// Recursively collect all video files from a directory
fn collect_video_files(dir: &Path, files: &mut Vec<PathBuf>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            log::warn!("Failed to read directory {:?}: {}", dir, e);
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_video_files(&path, files);
        } else if is_supported_video(&path) {
            files.push(path);
        }
    }
}

#[tauri::command]
pub fn probe_videos(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<VideoInfo>, AppError> {
    let ffprobe_path = state.ffprobe_path.lock().unwrap();
    let ffprobe = ffprobe_path
        .as_ref()
        .ok_or(AppError::FfmpegNotFound)?;

    // Expand directories into individual video file paths
    let mut video_paths: Vec<PathBuf> = Vec::new();
    for path_str in &paths {
        let path = Path::new(path_str);
        if path.is_dir() {
            collect_video_files(path, &mut video_paths);
        } else if is_supported_video(path) {
            video_paths.push(path.to_path_buf());
        }
    }

    // Sort by file name for consistent ordering
    video_paths.sort_by(|a, b| {
        a.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase()
            .cmp(
                &b.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase(),
            )
    });

    let mut results = Vec::new();
    for path in &video_paths {
        match probe_video(ffprobe, path) {
            Ok(info) => results.push(info),
            Err(e) => {
                log::warn!("Failed to probe {:?}: {}", path, e);
            }
        }
    }

    Ok(results)
}
