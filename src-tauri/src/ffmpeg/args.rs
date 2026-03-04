use serde::{Deserialize, Serialize};

use super::encoder::EncoderInfo;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressionConfig {
    pub codec: String,       // "h265" or "h264"
    pub crf: u32,            // 18-28
    pub use_hardware: bool,
    pub resolution: String,  // "original", "1080p", "720p", "480p"
    pub audio_bitrate: String, // "copy", "320k", "256k", "128k", "96k"
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            codec: "h265".into(),
            crf: 23,
            use_hardware: true,
            resolution: "original".into(),
            audio_bitrate: "copy".into(),
        }
    }
}

/// Build FFmpeg command-line arguments from config and encoder info
pub fn build_args(
    input: &str,
    output: &str,
    config: &CompressionConfig,
    encoder: &EncoderInfo,
    duration_secs: f64,
) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input.to_string(),
    ];

    // Video encoder
    args.push("-c:v".into());
    args.push(encoder.name.clone());

    // Quality settings - varies by encoder type
    add_quality_args(&mut args, config, encoder);

    // Pixel format
    if !encoder.is_hardware {
        args.push("-pix_fmt".into());
        args.push("yuv420p".into());
    }

    // Resolution scaling
    add_resolution_args(&mut args, &config.resolution);

    // Audio settings
    add_audio_args(&mut args, &config.audio_bitrate);

    // Container format
    args.push("-movflags".into());
    args.push("+faststart".into());

    // Progress output for parsing
    args.push("-progress".into());
    args.push("pipe:1".into());

    // Output file
    args.push(output.to_string());

    let _ = duration_secs; // reserved for future bitrate calculations

    args
}

fn add_quality_args(args: &mut Vec<String>, config: &CompressionConfig, encoder: &EncoderInfo) {
    match encoder.name.as_str() {
        // VideoToolbox HEVC: no CRF support, use -q:v instead
        "hevc_videotoolbox" => {
            let qv = crf_to_videotoolbox_quality(config.crf);
            args.push("-q:v".into());
            args.push(qv.to_string());
        }
        // VideoToolbox H.264
        "h264_videotoolbox" => {
            let qv = crf_to_videotoolbox_quality(config.crf);
            args.push("-q:v".into());
            args.push(qv.to_string());
        }
        // NVENC: use -cq (constant quality) mode
        name if name.contains("nvenc") => {
            args.push("-rc".into());
            args.push("constqp".into());
            args.push("-qp".into());
            args.push(config.crf.to_string());
        }
        // QSV: use -global_quality
        name if name.contains("qsv") => {
            args.push("-global_quality".into());
            args.push(config.crf.to_string());
        }
        // AMF: use -quality and -rc
        name if name.contains("amf") => {
            args.push("-rc".into());
            args.push("cqp".into());
            args.push("-qp_i".into());
            args.push(config.crf.to_string());
            args.push("-qp_p".into());
            args.push(config.crf.to_string());
        }
        // Software encoders: standard CRF
        _ => {
            args.push("-crf".into());
            args.push(config.crf.to_string());
            if encoder.name == "libx265" {
                args.push("-preset".into());
                args.push("medium".into());
            } else if encoder.name == "libx264" {
                args.push("-preset".into());
                args.push("medium".into());
            }
        }
    }
}

/// Map CRF value (18-28) to VideoToolbox quality (0-100, higher = better)
/// CRF 18 ≈ q:v 80, CRF 23 ≈ q:v 65, CRF 28 ≈ q:v 50
fn crf_to_videotoolbox_quality(crf: u32) -> u32 {
    let crf = crf.clamp(18, 28) as f64;
    let quality = 80.0 - (crf - 18.0) * 3.0;
    quality.round() as u32
}

fn add_resolution_args(args: &mut Vec<String>, resolution: &str) {
    match resolution {
        "1080p" => {
            args.push("-vf".into());
            args.push("scale=-2:1080".into());
        }
        "720p" => {
            args.push("-vf".into());
            args.push("scale=-2:720".into());
        }
        "480p" => {
            args.push("-vf".into());
            args.push("scale=-2:480".into());
        }
        _ => {} // "original" - no scaling
    }
}

fn add_audio_args(args: &mut Vec<String>, audio_bitrate: &str) {
    match audio_bitrate {
        "copy" => {
            args.push("-c:a".into());
            args.push("copy".into());
        }
        bitrate => {
            args.push("-c:a".into());
            args.push("aac".into());
            args.push("-b:a".into());
            args.push(bitrate.into());
        }
    }
}

/// Select the best encoder for the given codec and config.
/// Returns a clone to avoid lifetime issues with fallback defaults.
pub fn select_encoder(
    encoders: &[EncoderInfo],
    codec: &str,
    use_hardware: bool,
) -> EncoderInfo {
    let matching: Vec<&EncoderInfo> = encoders
        .iter()
        .filter(|e| e.codec == codec)
        .collect();

    if use_hardware {
        if let Some(hw) = matching.iter().find(|e| e.is_hardware) {
            return (*hw).clone();
        }
    }

    matching
        .iter()
        .find(|e| !e.is_hardware)
        .cloned()
        .cloned()
        .unwrap_or_else(|| EncoderInfo {
            name: if codec == "h265" { "libx265".into() } else { "libx264".into() },
            codec: codec.into(),
            is_hardware: false,
            priority: 100,
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn default_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "libx265".into(),
            codec: "h265".into(),
            is_hardware: false,
            priority: 100,
        }
    }

    #[test]
    fn test_build_args_software_h265() {
        let config = CompressionConfig::default();
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"libx265".to_string()));
        assert!(args.contains(&"-crf".to_string()));
        assert!(args.contains(&"23".to_string()));
        assert!(args.contains(&"-progress".to_string()));
        assert!(args.contains(&"pipe:1".to_string()));
    }

    #[test]
    fn test_build_args_videotoolbox() {
        let config = CompressionConfig::default();
        let encoder = EncoderInfo {
            name: "hevc_videotoolbox".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 10,
        };
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"hevc_videotoolbox".to_string()));
        assert!(args.contains(&"-q:v".to_string()));
        assert!(!args.contains(&"-crf".to_string()));
    }

    #[test]
    fn test_build_args_nvenc() {
        let config = CompressionConfig {
            codec: "h265".into(),
            crf: 23,
            use_hardware: true,
            resolution: "original".into(),
            audio_bitrate: "copy".into(),
        };
        let encoder = EncoderInfo {
            name: "hevc_nvenc".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 10,
        };
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-rc".to_string()));
        assert!(args.contains(&"constqp".to_string()));
        assert!(args.contains(&"-qp".to_string()));
    }

    #[test]
    fn test_build_args_with_resolution() {
        let config = CompressionConfig {
            resolution: "720p".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-vf".to_string()));
        assert!(args.contains(&"scale=-2:720".to_string()));
    }

    #[test]
    fn test_build_args_audio_bitrate() {
        let config = CompressionConfig {
            audio_bitrate: "128k".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"aac".to_string()));
        assert!(args.contains(&"-b:a".to_string()));
        assert!(args.contains(&"128k".to_string()));
    }

    #[test]
    fn test_crf_to_videotoolbox_quality() {
        assert_eq!(crf_to_videotoolbox_quality(18), 80);
        assert_eq!(crf_to_videotoolbox_quality(23), 65);
        assert_eq!(crf_to_videotoolbox_quality(28), 50);
    }
}
