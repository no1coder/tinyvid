use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use tauri::ipc::Channel;

use crate::ffmpeg::args::{select_encoder, CompressionConfig};
use crate::ffmpeg::encoder::EncoderInfo;
use crate::ffmpeg::probe::VideoInfo;
use crate::ffmpeg::process::FfmpegProcess;
use crate::ffmpeg::progress::ProgressEvent;
use crate::utils::error::AppError;
use crate::utils::path::generate_output_path;

/// Execute a single compression task with an external cancel flag.
/// If the selected hardware encoder fails, automatically retries with software fallback.
pub fn run_task(
    ffmpeg_path: &Path,
    video: &VideoInfo,
    config: &CompressionConfig,
    encoders: &[EncoderInfo],
    task_id: &str,
    channel: &Channel<ProgressEvent>,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(String, u64), AppError> {
    let encoder = select_encoder(encoders, &config.codec, config.use_hardware);
    let input_path = &video.path;
    let output_path = generate_output_path(Path::new(input_path), config.output_dir.as_deref());
    let output_str = output_path.to_string_lossy().to_string();

    let result = try_encode(
        ffmpeg_path, input_path, &output_str, config, &encoder,
        video.duration, task_id, channel, cancel_flag,
    );

    match result {
        Ok(val) => Ok(val),
        Err(AppError::Cancelled) => Err(AppError::Cancelled),
        Err(e) if encoder.is_hardware => {
            // Hardware encoder failed — retry with software fallback
            let sw_encoder = select_encoder(encoders, &config.codec, false);
            log::warn!(
                "[{}] Hardware encoder '{}' failed ({}), retrying with '{}'",
                task_id, encoder.name, e, sw_encoder.name
            );

            // Clean up partial output from failed attempt
            let _ = std::fs::remove_file(&output_path);

            // Re-send started event so frontend knows we're retrying
            let _ = channel.send(ProgressEvent::Started {
                task_id: task_id.to_string(),
            });

            try_encode(
                ffmpeg_path, input_path, &output_str, config, &sw_encoder,
                video.duration, task_id, channel, cancel_flag,
            )
        }
        Err(e) => Err(e),
    }
}

/// Attempt encoding with a specific encoder
fn try_encode(
    ffmpeg_path: &Path,
    input_path: &str,
    output_str: &str,
    config: &CompressionConfig,
    encoder: &EncoderInfo,
    duration: f64,
    task_id: &str,
    channel: &Channel<ProgressEvent>,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<(String, u64), AppError> {
    let output_path = Path::new(output_str);

    let mut process = FfmpegProcess::spawn(
        ffmpeg_path,
        input_path,
        output_str,
        config,
        encoder,
        duration,
        task_id,
        channel,
        Some(cancel_flag.clone()),
    )?;

    let success = process.wait()?;

    if process.is_cancelled() {
        let _ = std::fs::remove_file(output_path);
        return Err(AppError::Cancelled);
    }

    if !success {
        let _ = std::fs::remove_file(output_path);
        return Err(AppError::FfmpegError(format!(
            "Encoder '{}' exited with error", encoder.name
        )));
    }

    let output_size = match std::fs::metadata(output_path) {
        Ok(meta) if meta.len() > 0 => meta.len(),
        Ok(_) => {
            let _ = std::fs::remove_file(output_path);
            return Err(AppError::FfmpegError(
                "Output file is empty, encoding may have failed".into(),
            ));
        }
        Err(e) => {
            return Err(AppError::FfmpegError(
                format!("Cannot read output file: {}", e),
            ));
        }
    };

    let _ = channel.send(ProgressEvent::Completed {
        task_id: task_id.to_string(),
        output_path: output_str.to_string(),
        output_size,
    });

    Ok((output_str.to_string(), output_size))
}
