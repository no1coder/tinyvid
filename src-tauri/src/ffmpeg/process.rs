use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader, Read};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const PROCESS_TIMEOUT: Duration = Duration::from_secs(3600); // 1 hour max

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
    finished: bool,
    stderr_tail: Arc<Mutex<Vec<String>>>,
}

impl FfmpegProcess {
    /// Spawn a new FFmpeg compression process and stream progress via Channel.
    /// If an external cancel flag is provided, it will be used instead of creating a new one.
    pub fn spawn(
        ffmpeg_path: &Path,
        input: &str,
        output: &str,
        config: &CompressionConfig,
        encoder: &EncoderInfo,
        duration_secs: f64,
        task_id: &str,
        channel: &Channel<ProgressEvent>,
        external_cancel: Option<Arc<AtomicBool>>,
    ) -> Result<Self, AppError> {
        let args = build_args(input, output, config, encoder, duration_secs);

        log::debug!("FFmpeg args: {:?}", args);

        let mut child = Command::new(ffmpeg_path)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .spawn()?;

        let cancelled = external_cancel.unwrap_or_else(|| Arc::new(AtomicBool::new(false)));
        let cancelled_clone = cancelled.clone();

        let stdout = child.stdout.take().ok_or_else(|| {
            AppError::FfmpegError("Failed to capture stdout".into())
        })?;

        // Collect stderr tail in a background thread to prevent buffer deadlock
        // and preserve last 20 lines for error diagnostics.
        let stderr = child.stderr.take();
        let stderr_tail = Arc::new(Mutex::new(Vec::<String>::new()));
        let stderr_tail_clone = stderr_tail.clone();
        std::thread::spawn(move || {
            if let Some(stderr) = stderr {
                let reader = BufReader::new(stderr);
                let mut tail: Vec<String> = Vec::new();
                for line in reader.lines() {
                    if let Ok(line) = line {
                        tail.push(line);
                        if tail.len() > 20 {
                            tail.remove(0);
                        }
                    }
                }
                if let Ok(mut lock) = stderr_tail_clone.lock() {
                    *lock = tail;
                }
            }
        });

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
                if cancelled_clone.load(Ordering::Acquire) {
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
            finished: false,
            stderr_tail,
        })
    }

    /// Wait for the FFmpeg process to finish
    pub fn wait(&mut self) -> Result<bool, AppError> {
        if let Some(ref mut child) = self.child {
            let start = Instant::now();
            loop {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        self.finished = true;
                        return Ok(status.success());
                    }
                    Ok(None) => {
                        if start.elapsed() > PROCESS_TIMEOUT {
                            log::error!("FFmpeg process timed out after {:?}", PROCESS_TIMEOUT);
                            let _ = child.kill();
                            let _ = child.wait();
                            self.finished = true;
                            return Err(AppError::FfmpegError(
                                "Process timed out after 1 hour".into(),
                            ));
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => {
                        self.finished = true;
                        return Err(AppError::Io(e));
                    }
                }
            }
        } else {
            Ok(false)
        }
    }

    /// Cancel the FFmpeg process
    pub fn cancel(&mut self) {
        self.cancelled.store(true, Ordering::Release);
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
        self.cancelled.load(Ordering::Acquire)
    }

    /// Get the last lines of stderr output (useful for error diagnostics)
    pub fn stderr_output(&self) -> String {
        self.stderr_tail
            .lock()
            .map(|lines| lines.join("\n"))
            .unwrap_or_default()
    }
}

impl Drop for FfmpegProcess {
    fn drop(&mut self) {
        // Only kill the process if it hasn't been waited on yet
        if !self.finished {
            if let Some(ref mut child) = self.child {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
