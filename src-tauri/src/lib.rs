mod commands;
mod ffmpeg;
mod state;
mod task;
mod utils;

use tauri::Manager;

use ffmpeg::encoder::detect_encoders;
use state::AppState;
use utils::error::safe_lock;
use utils::path::{resolve_ffmpeg, resolve_ffprobe};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::system::detect_hardware,
            commands::system::get_ffmpeg_version,
            commands::system::check_disk_space,
            commands::system::show_in_folder,
            commands::probe::probe_videos,
            commands::compression::start_compression,
            commands::compression::cancel_task,
            commands::compression::cancel_all,
            commands::compression::get_tasks,
            commands::compression::clear_completed,
            commands::compression::remove_task,
            commands::compression::retry_failed,
        ])
        .setup(|app| {
            let handle = app.handle();
            let state = handle.state::<AppState>();

            // Resolve FFmpeg/FFprobe: sidecar (bundled) → system PATH fallback
            let ffmpeg = resolve_ffmpeg(handle);
            let ffprobe = resolve_ffprobe(handle);

            log::info!("FFmpeg path: {:?}", ffmpeg);
            log::info!("FFprobe path: {:?}", ffprobe);

            if ffmpeg.is_none() {
                log::error!("FFmpeg not found!");
            }
            if ffprobe.is_none() {
                log::warn!("FFprobe not found.");
            }

            // Detect available encoders
            if let Some(ref ffmpeg_path) = ffmpeg {
                match detect_encoders(ffmpeg_path) {
                    Ok(encoders) => {
                        let hw: Vec<_> = encoders.iter().filter(|e| e.is_hardware).collect();
                        let sw: Vec<_> = encoders.iter().filter(|e| !e.is_hardware).collect();
                        log::info!(
                            "Detected {} encoders ({} hardware, {} software)",
                            encoders.len(), hw.len(), sw.len()
                        );
                        for e in &encoders {
                            log::debug!("  {} [{}] hw={} priority={}",
                                e.name, e.codec, e.is_hardware, e.priority);
                        }
                        *safe_lock(&state.encoders) = encoders;
                    }
                    Err(e) => {
                        log::error!("Failed to detect encoders: {}", e);
                    }
                }
            }

            *safe_lock(&state.ffmpeg_path) = ffmpeg;
            *safe_lock(&state.ffprobe_path) = ffprobe;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>();
                state.task_manager.shutdown();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
