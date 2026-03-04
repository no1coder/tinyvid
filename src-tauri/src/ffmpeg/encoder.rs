use serde::Serialize;
use std::path::Path;
use std::process::Command;

use crate::utils::error::AppError;
use crate::utils::platform::{detect_platform, Platform};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EncoderInfo {
    pub name: String,
    pub codec: String,
    pub is_hardware: bool,
    pub priority: u32,
}

/// Detect available encoders by parsing `ffmpeg -encoders` output
pub fn detect_encoders(ffmpeg_path: &Path) -> Result<Vec<EncoderInfo>, AppError> {
    let output = Command::new(ffmpeg_path)
        .args(["-encoders", "-hide_banner"])
        .output()?;

    if !output.status.success() {
        return Err(AppError::FfmpegError("Failed to list encoders".into()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_encoders_output(&stdout))
}

pub fn parse_encoders_output(output: &str) -> Vec<EncoderInfo> {
    let platform = detect_platform();
    let mut encoders = Vec::new();

    let known_encoders = get_known_encoders(&platform);

    for line in output.lines() {
        let trimmed = line.trim();
        for (name, codec, is_hw, priority) in &known_encoders {
            if trimmed.contains(name) {
                encoders.push(EncoderInfo {
                    name: name.to_string(),
                    codec: codec.to_string(),
                    is_hardware: *is_hw,
                    priority: *priority,
                });
            }
        }
    }

    // Always add software encoders as fallback
    let has_h265_sw = encoders.iter().any(|e| e.name == "libx265");
    let has_h264_sw = encoders.iter().any(|e| e.name == "libx264");

    if !has_h265_sw {
        encoders.push(EncoderInfo {
            name: "libx265".into(),
            codec: "h265".into(),
            is_hardware: false,
            priority: 100,
        });
    }
    if !has_h264_sw {
        encoders.push(EncoderInfo {
            name: "libx264".into(),
            codec: "h264".into(),
            is_hardware: false,
            priority: 99,
        });
    }

    encoders.sort_by(|a, b| a.priority.cmp(&b.priority));
    encoders
}

fn get_known_encoders(platform: &Platform) -> Vec<(&'static str, &'static str, bool, u32)> {
    // (encoder_name, codec, is_hardware, priority - lower is better)
    match platform {
        Platform::MacOS => vec![
            ("hevc_videotoolbox", "h265", true, 10),
            ("h264_videotoolbox", "h264", true, 11),
            ("libx265", "h265", false, 100),
            ("libx264", "h264", false, 99),
        ],
        Platform::Windows => vec![
            ("hevc_nvenc", "h265", true, 10),
            ("h264_nvenc", "h264", true, 11),
            ("hevc_qsv", "h265", true, 20),
            ("h264_qsv", "h264", true, 21),
            ("hevc_amf", "h265", true, 30),
            ("h264_amf", "h264", true, 31),
            ("libx265", "h265", false, 100),
            ("libx264", "h264", false, 99),
        ],
        Platform::Linux => vec![
            ("hevc_nvenc", "h265", true, 10),
            ("h264_nvenc", "h264", true, 11),
            ("hevc_vaapi", "h265", true, 20),
            ("h264_vaapi", "h264", true, 21),
            ("libx265", "h265", false, 100),
            ("libx264", "h264", false, 99),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_encoders_output_finds_software() {
        let output = r#"Encoders:
 V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V..... libx265              libx265 H.265 / HEVC (codec hevc)
"#;
        let encoders = parse_encoders_output(output);
        assert!(encoders.iter().any(|e| e.name == "libx264"));
        assert!(encoders.iter().any(|e| e.name == "libx265"));
    }

    #[test]
    fn test_parse_encoders_output_adds_fallback() {
        let output = "Encoders:\n";
        let encoders = parse_encoders_output(output);
        assert!(encoders.iter().any(|e| e.name == "libx264"));
        assert!(encoders.iter().any(|e| e.name == "libx265"));
    }

    #[test]
    fn test_encoders_sorted_by_priority() {
        let output = r#"Encoders:
 V..... libx264              libx264 H.264
 V..... libx265              libx265 H.265
 V..... hevc_videotoolbox    VideoToolbox H.265
"#;
        let encoders = parse_encoders_output(output);
        let priorities: Vec<u32> = encoders.iter().map(|e| e.priority).collect();
        let mut sorted = priorities.clone();
        sorted.sort();
        assert_eq!(priorities, sorted);
    }
}
