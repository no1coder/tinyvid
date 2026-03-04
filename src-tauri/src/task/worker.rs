use std::path::Path;

use tauri::ipc::Channel;

use crate::ffmpeg::args::{select_encoder, CompressionConfig};
use crate::ffmpeg::encoder::EncoderInfo;
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::process::FfmpegProcess;
use crate::ffmpeg::progress::ProgressEvent;
use crate::utils::error::AppError;
use crate::utils::path::generate_output_path;

/// Execute a single compression task
pub fn run_task(
    ffmpeg_path: &Path,
    video: &VideoInfo,
    config: &CompressionConfig,
    encoders: &[EncoderInfo],
    task_id: &str,
    channel: &Channel<ProgressEvent>,
) -> Result<(String, u64), AppError> {
    let encoder = select_encoder(encoders, &config.codec, config.use_hardware);
    let input_path = &video.path;
    let output_path = generate_output_path(Path::new(input_path));
    let output_str = output_path.to_string_lossy().to_string();

    let mut process = FfmpegProcess::spawn(
        ffmpeg_path,
        input_path,
        &output_str,
        config,
        &encoder,
        video.duration,
        task_id,
        channel,
    )?;

    let success = process.wait()?;

    if process.is_cancelled() {
        // Clean up partial output
        let _ = std::fs::remove_file(&output_path);
        return Err(AppError::Cancelled);
    }

    if !success {
        let _ = std::fs::remove_file(&output_path);
        return Err(AppError::FfmpegError("FFmpeg exited with error".into()));
    }

    let output_size = std::fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let _ = channel.send(ProgressEvent::Completed {
        task_id: task_id.to_string(),
        output_path: output_str.clone(),
        output_size,
    });

    Ok((output_str, output_size))
}
