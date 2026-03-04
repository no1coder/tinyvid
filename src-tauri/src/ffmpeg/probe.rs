use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

use crate::utils::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoInfo {
    pub path: String,
    pub file_name: String,
    pub size: u64,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub codec: String,
    pub bitrate: u64,
    pub fps: f64,
    pub audio_codec: Option<String>,
    pub audio_bitrate: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    format: Option<FfprobeFormat>,
    streams: Option<Vec<FfprobeStream>>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
    size: Option<String>,
    bit_rate: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    bit_rate: Option<String>,
    r_frame_rate: Option<String>,
}

/// Probe a video file using ffprobe and return structured metadata
pub fn probe_video(ffprobe_path: &Path, video_path: &Path) -> Result<VideoInfo, AppError> {
    let output = Command::new(ffprobe_path)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(video_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::FfmpegError(format!(
            "ffprobe failed: {}",
            stderr
        )));
    }

    let probe: FfprobeOutput = serde_json::from_slice(&output.stdout)?;

    let format = probe
        .format
        .ok_or_else(|| AppError::InvalidFile("No format info".into()))?;
    let streams = probe.streams.unwrap_or_default();

    let video_stream = streams
        .iter()
        .find(|s| s.codec_type.as_deref() == Some("video"))
        .ok_or_else(|| AppError::InvalidFile("No video stream found".into()))?;

    let audio_stream = streams
        .iter()
        .find(|s| s.codec_type.as_deref() == Some("audio"));

    let duration = format
        .duration
        .as_deref()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);

    let size = format
        .size
        .as_deref()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or_else(|| {
            std::fs::metadata(video_path)
                .map(|m| m.len())
                .unwrap_or(0)
        });

    let bitrate = format
        .bit_rate
        .as_deref()
        .and_then(|b| b.parse::<u64>().ok())
        .unwrap_or(0);

    let fps = video_stream
        .r_frame_rate
        .as_deref()
        .and_then(parse_frame_rate)
        .unwrap_or(0.0);

    let file_name = video_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(VideoInfo {
        path: video_path.to_string_lossy().to_string(),
        file_name,
        size,
        duration,
        width: video_stream.width.unwrap_or(0),
        height: video_stream.height.unwrap_or(0),
        codec: video_stream
            .codec_name
            .clone()
            .unwrap_or_else(|| "unknown".into()),
        bitrate,
        fps,
        audio_codec: audio_stream.and_then(|s| s.codec_name.clone()),
        audio_bitrate: audio_stream
            .and_then(|s| s.bit_rate.as_deref())
            .and_then(|b| b.parse::<u64>().ok()),
    })
}

fn parse_frame_rate(rate: &str) -> Option<f64> {
    let parts: Vec<&str> = rate.split('/').collect();
    if parts.len() == 2 {
        let num = parts[0].parse::<f64>().ok()?;
        let den = parts[1].parse::<f64>().ok()?;
        if den > 0.0 {
            return Some(num / den);
        }
    }
    rate.parse::<f64>().ok()
}
