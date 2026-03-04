use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::ipc::Channel;

use crate::utils::error::AppError;
use super::args::{build_args, CompressionConfig};
use super::encoder::EncoderInfo;
use super::progress::{ProgressAccumulator, ProgressEvent, parse_progress_line};

#[cfg(unix)]
extern crate libc;

/// Handle for a running FFmpeg process
pub struct FfmpegProcess {
    child: Option<Child>,
    cancelled: Arc<AtomicBool>,
}

impl FfmpegProcess {
    /// Spawn a new FFmpeg compression process and stream progress via Channel
    pub fn spawn(
        ffmpeg_path: &Path,
        input: &str,
        output: &str,
        config: &CompressionConfig,
        encoder: &EncoderInfo,
        duration_secs: f64,
        task_id: &str,
        channel: &Channel<ProgressEvent>,
    ) -> Result<Self, AppError> {
        let args = build_args(input, output, config, encoder, duration_secs);

        let mut child = Command::new(ffmpeg_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .spawn()?;

        let cancelled = Arc::new(AtomicBool::new(false));
        let cancelled_clone = cancelled.clone();

        let stdout = child.stdout.take().ok_or_else(|| {
            AppError::FfmpegError("Failed to capture stdout".into())
        })?;

        let task_id_owned = task_id.to_string();
        let channel_clone = channel.clone();
        let total_duration_us = (duration_secs * 1_000_000.0) as u64;

        // Send started event
        let _ = channel.send(ProgressEvent::Started {
            task_id: task_id_owned.clone(),
        });

        // Spawn reader thread for stdout progress
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            let mut acc = ProgressAccumulator::default();
            let start_time = std::time::Instant::now();

            for line in reader.lines() {
                if cancelled_clone.load(Ordering::Relaxed) {
                    let _ = channel_clone.send(ProgressEvent::Cancelled {
                        task_id: task_id_owned.clone(),
                    });
                    return;
                }

                let line = match line {
                    Ok(l) => l,
                    Err(_) => continue,
                };

                if let Some((key, value)) = parse_progress_line(&line) {
                    acc.feed(key, value);

                    if acc.is_frame_complete() {
                        let percent = acc.calc_percent(total_duration_us);
                        let eta = acc.calc_eta(duration_secs);

                        let _ = channel_clone.send(ProgressEvent::Progress {
                            task_id: task_id_owned.clone(),
                            percent,
                            fps: acc.fps.unwrap_or(0.0),
                            speed: acc.speed.unwrap_or(0.0),
                            time_elapsed: start_time.elapsed().as_secs_f64(),
                            eta,
                            current_size: acc.total_size.unwrap_or(0),
                        });

                        acc.reset();
                    }
                }
            }
        });

        Ok(Self {
            child: Some(child),
            cancelled,
        })
    }

    /// Wait for the FFmpeg process to finish
    pub fn wait(&mut self) -> Result<bool, AppError> {
        if let Some(ref mut child) = self.child {
            let status = child.wait()?;
            Ok(status.success())
        } else {
            Ok(false)
        }
    }

    /// Cancel the FFmpeg process
    pub fn cancel(&mut self) {
        self.cancelled.store(true, Ordering::Relaxed);
        if let Some(ref mut child) = self.child {
            #[cfg(unix)]
            {
                unsafe {
                    libc::kill(child.id() as i32, libc::SIGTERM);
                }
            }
            #[cfg(not(unix))]
            {
                let _ = child.kill();
            }
        }
    }

    /// Check if process was cancelled
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }
}

impl Drop for FfmpegProcess {
    fn drop(&mut self) {
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
