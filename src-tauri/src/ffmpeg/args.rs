use serde::{Deserialize, Serialize};

use super::encoder::EncoderInfo;
use super::quality::{add_audio_args, add_hwaccel_args, add_quality_args, add_resolution_args};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressionConfig {
    pub codec: String,       // "h265" or "h264"
    pub crf: u32,            // 18-28
    pub use_hardware: bool,
    pub resolution: String,  // "original", "1080p", "720p", "480p"
    pub audio_bitrate: String, // "copy", "320k", "256k", "128k", "96k"
    #[serde(default)]
    pub output_dir: Option<String>, // Custom output directory (None = same as input)
    #[serde(default)]
    pub max_concurrency: Option<usize>, // Custom parallel limit (None = auto)
}

impl Default for CompressionConfig {
    fn default() -> Self {
        Self {
            codec: "h265".into(),
            crf: 23,
            use_hardware: true,
            resolution: "original".into(),
            audio_bitrate: "copy".into(),
            output_dir: None,
            max_concurrency: None,
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
    let mut args = vec!["-y".to_string()];

    // Hardware-accelerated decoding (BEFORE -i)
    add_hwaccel_args(&mut args, encoder);

    // Multi-threaded decoding
    args.push("-threads".into());
    args.push("0".into());

    // Input file
    args.push("-i".into());
    args.push(input.to_string());

    // Video encoder
    args.push("-c:v".into());
    args.push(encoder.name.clone());

    // Quality settings - varies by encoder type
    add_quality_args(&mut args, config, encoder);

    // Pixel format (software encoders only; HW encoders handle it internally)
    if !encoder.is_hardware {
        args.push("-pix_fmt".into());
        args.push("yuv420p".into());
    }

    // HEVC tag for Apple/browser compatibility
    if config.codec == "h265" {
        args.push("-tag:v".into());
        args.push("hvc1".into());
    }

    // Resolution scaling (use GPU filter when HW encoder is active)
    add_resolution_args(&mut args, &config.resolution, encoder);

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

    fn vt_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_videotoolbox".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 10,
        }
    }

    fn nvenc_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_nvenc".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 10,
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
        // Should not have hwaccel for software encoder
        assert!(!args.contains(&"-hwaccel".to_string()));
    }

    #[test]
    fn test_build_args_videotoolbox() {
        let config = CompressionConfig::default();
        let encoder = vt_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"hevc_videotoolbox".to_string()));
        assert!(args.contains(&"-q:v".to_string()));
        assert!(!args.contains(&"-crf".to_string()));
        // VideoToolbox should NOT use -hwaccel (SW decode is faster)
        assert!(!args.contains(&"-hwaccel".to_string()));
        // Realtime disabled for max throughput
        assert!(args.contains(&"-realtime".to_string()));
        assert!(args.contains(&"0".to_string()));
        // Speed priority
        assert!(args.contains(&"-prio_speed".to_string()));
    }

    #[test]
    fn test_build_args_videotoolbox_with_scaling() {
        let config = CompressionConfig {
            resolution: "720p".into(),
            ..CompressionConfig::default()
        };
        let encoder = vt_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        // VideoToolbox uses SW decode, so CPU scale filter
        assert!(args.contains(&"-vf".to_string()));
        assert!(args.contains(&"scale=-2:720".to_string()));
    }

    #[test]
    fn test_build_args_nvenc() {
        let config = CompressionConfig {
            codec: "h265".into(),
            crf: 23,
            use_hardware: true,
            resolution: "original".into(),
            audio_bitrate: "copy".into(),
            ..CompressionConfig::default()
        };
        let encoder = nvenc_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-rc".to_string()));
        assert!(args.contains(&"constqp".to_string()));
        assert!(args.contains(&"-qp".to_string()));
        // Hardware decode with output format to keep frames on GPU
        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"cuda".to_string()));
        assert!(args.contains(&"-hwaccel_output_format".to_string()));
        // Fast preset
        assert!(args.contains(&"-preset".to_string()));
        assert!(args.contains(&"p1".to_string()));
        // B-frames and lookahead
        assert!(args.contains(&"-bf".to_string()));
        assert!(args.contains(&"4".to_string()));
        assert!(args.contains(&"-rc-lookahead".to_string()));
        assert!(args.contains(&"32".to_string()));
    }

    #[test]
    fn test_build_args_nvenc_with_scaling() {
        let config = CompressionConfig {
            resolution: "720p".into(),
            ..CompressionConfig::default()
        };
        let encoder = nvenc_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"scale_cuda=-2:720".to_string()));
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
    fn test_hwaccel_before_input_nvenc() {
        let config = CompressionConfig::default();
        let encoder = nvenc_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        let hwaccel_pos = args.iter().position(|a| a == "-hwaccel").unwrap();
        let input_pos = args.iter().position(|a| a == "-i").unwrap();
        // -hwaccel must come before -i
        assert!(hwaccel_pos < input_pos);
        // Must include -hwaccel_output_format
        assert!(args.contains(&"-hwaccel_output_format".to_string()));
        assert!(args.contains(&"cuda".to_string()));
    }

    #[test]
    fn test_videotoolbox_no_hwaccel() {
        let config = CompressionConfig::default();
        let encoder = vt_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        // VideoToolbox should NOT use -hwaccel (SW decode is faster)
        assert!(!args.contains(&"-hwaccel".to_string()));
        assert!(!args.contains(&"-hwaccel_output_format".to_string()));
    }

    #[test]
    fn test_threads_before_input() {
        let config = CompressionConfig::default();
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        let threads_pos = args.iter().position(|a| a == "-threads").unwrap();
        let input_pos = args.iter().position(|a| a == "-i").unwrap();
        assert!(threads_pos < input_pos);
    }

    // --- select_encoder tests ---

    #[test]
    fn test_select_encoder_hw_preferred() {
        let encoders = vec![vt_encoder(), default_encoder()];
        let result = select_encoder(&encoders, "h265", true);
        assert_eq!(result.name, "hevc_videotoolbox");
        assert!(result.is_hardware);
    }

    #[test]
    fn test_select_encoder_sw_when_hw_disabled() {
        let encoders = vec![vt_encoder(), default_encoder()];
        let result = select_encoder(&encoders, "h265", false);
        assert_eq!(result.name, "libx265");
        assert!(!result.is_hardware);
    }

    #[test]
    fn test_select_encoder_sw_fallback_when_no_hw() {
        let encoders = vec![default_encoder()];
        let result = select_encoder(&encoders, "h265", true);
        assert_eq!(result.name, "libx265");
        assert!(!result.is_hardware);
    }

    #[test]
    fn test_select_encoder_empty_list_fallback_h265() {
        let result = select_encoder(&[], "h265", true);
        assert_eq!(result.name, "libx265");
        assert_eq!(result.codec, "h265");
    }

    #[test]
    fn test_select_encoder_empty_list_fallback_h264() {
        let result = select_encoder(&[], "h264", true);
        assert_eq!(result.name, "libx264");
        assert_eq!(result.codec, "h264");
    }

    #[test]
    fn test_select_encoder_codec_mismatch() {
        let encoders = vec![vt_encoder()]; // h265 only
        let result = select_encoder(&encoders, "h264", true);
        assert_eq!(result.name, "libx264"); // fallback
    }

    // --- QSV encoder tests ---

    fn qsv_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_qsv".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 20,
        }
    }

    #[test]
    fn test_build_args_qsv() {
        let config = CompressionConfig::default();
        let encoder = qsv_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"qsv".to_string()));
        assert!(args.contains(&"-hwaccel_output_format".to_string()));
        assert!(args.contains(&"-global_quality".to_string()));
        assert!(args.contains(&"-preset".to_string()));
        assert!(args.contains(&"veryfast".to_string()));
    }

    #[test]
    fn test_build_args_qsv_with_scaling() {
        let config = CompressionConfig {
            resolution: "1080p".into(),
            ..CompressionConfig::default()
        };
        let encoder = qsv_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"scale_qsv=-2:1080".to_string()));
    }

    // --- AMF encoder tests ---

    fn amf_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_amf".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 30,
        }
    }

    #[test]
    fn test_build_args_amf() {
        let config = CompressionConfig::default();
        let encoder = amf_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"d3d11va".to_string()));
        assert!(args.contains(&"-hwaccel_output_format".to_string()));
        assert!(args.contains(&"d3d11".to_string()));
        assert!(args.contains(&"-rc".to_string()));
        assert!(args.contains(&"cqp".to_string()));
        assert!(args.contains(&"-qp_i".to_string()));
        assert!(args.contains(&"-quality".to_string()));
        assert!(args.contains(&"speed".to_string()));
    }

    #[test]
    fn test_build_args_amf_with_scaling() {
        let config = CompressionConfig {
            resolution: "480p".into(),
            ..CompressionConfig::default()
        };
        let encoder = amf_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        // AMF uses CPU scale
        assert!(args.contains(&"scale=-2:480".to_string()));
    }

    // --- VAAPI encoder tests ---

    fn vaapi_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_vaapi".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 20,
        }
    }

    #[test]
    fn test_build_args_vaapi() {
        let config = CompressionConfig::default();
        let encoder = vaapi_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"vaapi".to_string()));
        assert!(args.contains(&"-hwaccel_output_format".to_string()));
        assert!(args.contains(&"-qp".to_string()));
        assert!(args.contains(&"-compression_level".to_string()));
        assert!(args.contains(&"1".to_string()));
    }

    #[test]
    fn test_build_args_vaapi_with_scaling() {
        let config = CompressionConfig {
            resolution: "720p".into(),
            ..CompressionConfig::default()
        };
        let encoder = vaapi_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"scale_vaapi=-2:720".to_string()));
    }

    // --- Resolution tests ---

    #[test]
    fn test_build_args_1080p() {
        let config = CompressionConfig {
            resolution: "1080p".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"scale=-2:1080".to_string()));
    }

    #[test]
    fn test_build_args_480p() {
        let config = CompressionConfig {
            resolution: "480p".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"scale=-2:480".to_string()));
    }

    #[test]
    fn test_build_args_original_no_scale() {
        let config = CompressionConfig {
            resolution: "original".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(!args.contains(&"-vf".to_string()));
    }

    // --- H.264 software tests ---

    fn h264_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "libx264".into(),
            codec: "h264".into(),
            is_hardware: false,
            priority: 99,
        }
    }

    #[test]
    fn test_build_args_software_h264() {
        let config = CompressionConfig {
            codec: "h264".into(),
            ..CompressionConfig::default()
        };
        let encoder = h264_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"libx264".to_string()));
        assert!(args.contains(&"-crf".to_string()));
        assert!(args.contains(&"-preset".to_string()));
        assert!(args.contains(&"medium".to_string()));
        assert!(args.contains(&"-pix_fmt".to_string()));
        assert!(args.contains(&"yuv420p".to_string()));
        // H.264 should NOT have hvc1 tag
        assert!(!args.contains(&"hvc1".to_string()));
    }

    // --- H.264 VideoToolbox tests ---

    fn h264_vt_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "h264_videotoolbox".into(),
            codec: "h264".into(),
            is_hardware: true,
            priority: 11,
        }
    }

    #[test]
    fn test_build_args_h264_videotoolbox() {
        let config = CompressionConfig {
            codec: "h264".into(),
            ..CompressionConfig::default()
        };
        let encoder = h264_vt_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-q:v".to_string()));
        assert!(args.contains(&"-realtime".to_string()));
        assert!(args.contains(&"-prio_speed".to_string()));
        // No hwaccel for VT
        assert!(!args.contains(&"-hwaccel".to_string()));
        // No pix_fmt for hardware
        assert!(!args.contains(&"-pix_fmt".to_string()));
    }

    // --- Audio tests ---

    #[test]
    fn test_build_args_audio_copy() {
        let config = CompressionConfig {
            audio_bitrate: "copy".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"copy".to_string()));
        assert!(!args.contains(&"-b:a".to_string()));
    }

    // --- CompressionConfig defaults ---

    #[test]
    fn test_compression_config_default() {
        let config = CompressionConfig::default();
        assert_eq!(config.codec, "h265");
        assert_eq!(config.crf, 23);
        assert!(config.use_hardware);
        assert_eq!(config.resolution, "original");
        assert_eq!(config.audio_bitrate, "copy");
    }

    // --- Container format ---

    #[test]
    fn test_build_args_has_faststart() {
        let config = CompressionConfig::default();
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-movflags".to_string()));
        assert!(args.contains(&"+faststart".to_string()));
    }

    #[test]
    fn test_build_args_hevc_has_hvc1_tag() {
        let config = CompressionConfig {
            codec: "h265".into(),
            ..CompressionConfig::default()
        };
        let encoder = default_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-tag:v".to_string()));
        assert!(args.contains(&"hvc1".to_string()));
    }

    // --- NVENC H.264 ---

    fn h264_nvenc_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "h264_nvenc".into(),
            codec: "h264".into(),
            is_hardware: true,
            priority: 11,
        }
    }

    #[test]
    fn test_build_args_h264_nvenc() {
        let config = CompressionConfig {
            codec: "h264".into(),
            ..CompressionConfig::default()
        };
        let encoder = h264_nvenc_encoder();
        let args = build_args("/input.mp4", "/output.mp4", &config, &encoder, 60.0);

        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"cuda".to_string()));
        assert!(args.contains(&"-rc".to_string()));
        assert!(args.contains(&"constqp".to_string()));
        // H.264 codec should NOT have hvc1 tag
        assert!(!args.contains(&"hvc1".to_string()));
    }
}
