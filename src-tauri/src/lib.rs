mod commands;
mod ffmpeg;
mod state;
mod task;
mod utils;

use tauri::Manager;

use state::AppState;
use utils::path::{find_system_ffmpeg, find_system_ffprobe, get_ffmpeg_path, get_ffprobe_path};
use ffmpeg::encoder::detect_encoders;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::system::detect_hardware,
            commands::system::get_ffmpeg_version,
            commands::probe::probe_videos,
            commands::compression::start_compression,
            commands::compression::cancel_all,
            commands::compression::get_tasks,
            commands::compression::clear_completed,
            commands::compression::remove_task,
        ])
        .setup(|app| {
            let handle = app.handle();
            let state = handle.state::<AppState>();

            // Detect FFmpeg path: bundled first, then system PATH
            let ffmpeg = {
                let bundled = get_ffmpeg_path(handle);
                if bundled.exists() {
                    Some(bundled)
                } else {
                    find_system_ffmpeg()
                }
            };

            let ffprobe = {
                let bundled = get_ffprobe_path(handle);
                if bundled.exists() {
                    Some(bundled)
                } else {
                    find_system_ffprobe()
                }
            };

            // Detect available encoders
            if let Some(ref ffmpeg_path) = ffmpeg {
                if let Ok(encoders) = detect_encoders(ffmpeg_path) {
                    *state.encoders.lock().unwrap() = encoders;
                }
            }

            *state.ffmpeg_path.lock().unwrap() = ffmpeg;
            *state.ffprobe_path.lock().unwrap() = ffprobe;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
