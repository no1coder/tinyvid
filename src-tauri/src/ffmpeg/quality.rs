use super::args::CompressionConfig;
use super::encoder::EncoderInfo;

/// Add hardware-accelerated decoding flags (must be before -i).
///
/// Note: VideoToolbox HW decoder is SLOWER than multithreaded SW decoder
/// for high-res content (4K HEVC: HW=180fps vs SW=350fps). The HW decoder
/// is single-threaded silicon with fixed throughput, while SW decoding
/// scales across all CPU cores via -threads 0. Since the VT encoder is
/// the real bottleneck (~200fps for 4K), feeding it faster via SW decode
/// yields ~10% better throughput. Therefore we skip -hwaccel for VT.
///
/// For NVENC/QSV/AMF, HW decode + hwaccel_output_format keeps frames in
/// GPU memory, avoiding costly PCIe transfers.
pub fn add_hwaccel_args(args: &mut Vec<String>, encoder: &EncoderInfo) {
    if !encoder.is_hardware {
        return;
    }

    match encoder.name.as_str() {
        // VideoToolbox: do NOT use -hwaccel; SW decode is faster
        name if name.contains("videotoolbox") => {}
        name if name.contains("nvenc") => {
            args.push("-hwaccel".into());
            args.push("cuda".into());
            args.push("-hwaccel_output_format".into());
            args.push("cuda".into());
        }
        name if name.contains("qsv") => {
            args.push("-hwaccel".into());
            args.push("qsv".into());
            args.push("-hwaccel_output_format".into());
            args.push("qsv".into());
        }
        name if name.contains("amf") => {
            args.push("-hwaccel".into());
            args.push("d3d11va".into());
            args.push("-hwaccel_output_format".into());
            args.push("d3d11".into());
        }
        name if name.contains("vaapi") => {
            args.push("-hwaccel".into());
            args.push("vaapi".into());
            args.push("-hwaccel_output_format".into());
            args.push("vaapi".into());
        }
        _ => {}
    }
}

pub fn add_quality_args(args: &mut Vec<String>, config: &CompressionConfig, encoder: &EncoderInfo) {
    match encoder.name.as_str() {
        // VideoToolbox HEVC
        "hevc_videotoolbox" => {
            let qv = crf_to_videotoolbox_quality(config.crf);
            args.push("-q:v".into());
            args.push(qv.to_string());
            // Allow maximum throughput (not capped to realtime)
            args.push("-realtime".into());
            args.push("0".into());
            // Prioritize speed
            args.push("-prio_speed".into());
            args.push("1".into());
        }
        // VideoToolbox H.264
        "h264_videotoolbox" => {
            let qv = crf_to_videotoolbox_quality(config.crf);
            args.push("-q:v".into());
            args.push(qv.to_string());
            args.push("-realtime".into());
            args.push("0".into());
            args.push("-prio_speed".into());
            args.push("1".into());
        }
        // NVENC: use constant quality mode with fastest preset
        name if name.contains("nvenc") => {
            args.push("-rc".into());
            args.push("constqp".into());
            args.push("-qp".into());
            args.push(config.crf.to_string());
            args.push("-preset".into());
            args.push("p1".into());
            args.push("-tune".into());
            args.push("hq".into());
            // B-frames for better compression
            args.push("-bf".into());
            args.push("4".into());
            // Lookahead for better quality decisions
            args.push("-rc-lookahead".into());
            args.push("32".into());
        }
        // QSV: use -global_quality with fastest preset
        name if name.contains("qsv") => {
            args.push("-global_quality".into());
            args.push(config.crf.to_string());
            args.push("-preset".into());
            args.push("veryfast".into());
        }
        // AMF: use -quality and -rc
        name if name.contains("amf") => {
            args.push("-rc".into());
            args.push("cqp".into());
            args.push("-qp_i".into());
            args.push(config.crf.to_string());
            args.push("-qp_p".into());
            args.push(config.crf.to_string());
            args.push("-quality".into());
            args.push("speed".into());
        }
        // VAAPI: use -qp with fastest compression_level
        name if name.contains("vaapi") => {
            args.push("-qp".into());
            args.push(config.crf.to_string());
            args.push("-compression_level".into());
            args.push("1".into());
        }
        // Software encoders: standard CRF + preset
        _ => {
            args.push("-crf".into());
            args.push(config.crf.to_string());
            if encoder.name == "libx265" || encoder.name == "libx264" {
                args.push("-preset".into());
                args.push("medium".into());
            }
        }
    }
}

/// Map CRF value (18-28) to VideoToolbox quality (0-100, higher = better)
/// CRF 18 ≈ q:v 80, CRF 23 ≈ q:v 65, CRF 28 ≈ q:v 50
pub fn crf_to_videotoolbox_quality(crf: u32) -> u32 {
    let crf = crf.clamp(18, 28) as f64;
    let quality = 80.0 - (crf - 18.0) * 3.0;
    quality.round() as u32
}

/// Add resolution scaling args, using GPU-accelerated filters when possible
pub fn add_resolution_args(args: &mut Vec<String>, resolution: &str, encoder: &EncoderInfo) {
    let target_height = match resolution {
        "1080p" => Some(1080),
        "720p" => Some(720),
        "480p" => Some(480),
        _ => None, // "original" - no scaling
    };

    let height = match target_height {
        Some(h) => h,
        None => return,
    };

    // Use GPU-accelerated scale filter when hwaccel is active.
    // VideoToolbox uses SW decode (no hwaccel), so use CPU scale.
    let filter = match encoder.name.as_str() {
        name if name.contains("nvenc") => {
            format!("scale_cuda=-2:{}", height)
        }
        name if name.contains("vaapi") => {
            format!("scale_vaapi=-2:{}", height)
        }
        name if name.contains("qsv") => {
            format!("scale_qsv=-2:{}", height)
        }
        _ => {
            // CPU scale for VideoToolbox (SW decode), AMF, and software encoders
            format!("scale=-2:{}", height)
        }
    };

    args.push("-vf".into());
    args.push(filter);
}

pub fn add_audio_args(args: &mut Vec<String>, audio_bitrate: &str) {
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

    fn qsv_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_qsv".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 20,
        }
    }

    fn amf_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_amf".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 30,
        }
    }

    fn vaapi_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "hevc_vaapi".into(),
            codec: "h265".into(),
            is_hardware: true,
            priority: 20,
        }
    }

    fn h264_vt_encoder() -> EncoderInfo {
        EncoderInfo {
            name: "h264_videotoolbox".into(),
            codec: "h264".into(),
            is_hardware: true,
            priority: 11,
        }
    }

    // --- CRF to VideoToolbox quality mapping ---

    #[test]
    fn test_crf_to_videotoolbox_quality() {
        assert_eq!(crf_to_videotoolbox_quality(18), 80);
        assert_eq!(crf_to_videotoolbox_quality(23), 65);
        assert_eq!(crf_to_videotoolbox_quality(28), 50);
    }

    #[test]
    fn test_crf_to_videotoolbox_quality_clamped_low() {
        // CRF below 18 should clamp to 18 -> quality 80
        assert_eq!(crf_to_videotoolbox_quality(10), 80);
    }

    #[test]
    fn test_crf_to_videotoolbox_quality_clamped_high() {
        // CRF above 28 should clamp to 28 -> quality 50
        assert_eq!(crf_to_videotoolbox_quality(40), 50);
    }

    // --- hwaccel args ---

    #[test]
    fn test_hwaccel_no_args_for_software() {
        let encoder = default_encoder();
        let mut args = vec![];
        add_hwaccel_args(&mut args, &encoder);
        assert!(args.is_empty());
    }

    #[test]
    fn test_hwaccel_no_args_for_videotoolbox() {
        let encoder = vt_encoder();
        let mut args = vec![];
        add_hwaccel_args(&mut args, &encoder);
        assert!(args.is_empty());
    }

    #[test]
    fn test_hwaccel_nvenc() {
        let encoder = nvenc_encoder();
        let mut args = vec![];
        add_hwaccel_args(&mut args, &encoder);
        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"cuda".to_string()));
        assert!(args.contains(&"-hwaccel_output_format".to_string()));
    }

    #[test]
    fn test_hwaccel_qsv() {
        let encoder = qsv_encoder();
        let mut args = vec![];
        add_hwaccel_args(&mut args, &encoder);
        assert!(args.contains(&"-hwaccel".to_string()));
        assert!(args.contains(&"qsv".to_string()));
    }

    #[test]
    fn test_hwaccel_amf() {
        let encoder = amf_encoder();
        let mut args = vec![];
        add_hwaccel_args(&mut args, &encoder);
        assert!(args.contains(&"d3d11va".to_string()));
        assert!(args.contains(&"d3d11".to_string()));
    }

    #[test]
    fn test_hwaccel_vaapi() {
        let encoder = vaapi_encoder();
        let mut args = vec![];
        add_hwaccel_args(&mut args, &encoder);
        assert!(args.contains(&"vaapi".to_string()));
    }

    // --- quality args ---

    #[test]
    fn test_quality_args_software_h265() {
        let config = CompressionConfig::default();
        let encoder = default_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"-crf".to_string()));
        assert!(args.contains(&"23".to_string()));
        assert!(args.contains(&"-preset".to_string()));
        assert!(args.contains(&"medium".to_string()));
    }

    #[test]
    fn test_quality_args_videotoolbox() {
        let config = CompressionConfig::default();
        let encoder = vt_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"-q:v".to_string()));
        assert!(args.contains(&"-realtime".to_string()));
        assert!(args.contains(&"-prio_speed".to_string()));
    }

    #[test]
    fn test_quality_args_h264_videotoolbox() {
        let config = CompressionConfig::default();
        let encoder = h264_vt_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"-q:v".to_string()));
        assert!(args.contains(&"-realtime".to_string()));
        assert!(args.contains(&"-prio_speed".to_string()));
    }

    #[test]
    fn test_quality_args_nvenc() {
        let config = CompressionConfig::default();
        let encoder = nvenc_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"-rc".to_string()));
        assert!(args.contains(&"constqp".to_string()));
        assert!(args.contains(&"-bf".to_string()));
        assert!(args.contains(&"-rc-lookahead".to_string()));
    }

    #[test]
    fn test_quality_args_qsv() {
        let config = CompressionConfig::default();
        let encoder = qsv_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"-global_quality".to_string()));
        assert!(args.contains(&"veryfast".to_string()));
    }

    #[test]
    fn test_quality_args_amf() {
        let config = CompressionConfig::default();
        let encoder = amf_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"cqp".to_string()));
        assert!(args.contains(&"speed".to_string()));
    }

    #[test]
    fn test_quality_args_vaapi() {
        let config = CompressionConfig::default();
        let encoder = vaapi_encoder();
        let mut args = vec![];
        add_quality_args(&mut args, &config, &encoder);
        assert!(args.contains(&"-qp".to_string()));
        assert!(args.contains(&"-compression_level".to_string()));
    }

    // --- resolution args ---

    #[test]
    fn test_resolution_original_no_scale() {
        let encoder = default_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "original", &encoder);
        assert!(args.is_empty());
    }

    #[test]
    fn test_resolution_1080p() {
        let encoder = default_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "1080p", &encoder);
        assert!(args.contains(&"scale=-2:1080".to_string()));
    }

    #[test]
    fn test_resolution_720p() {
        let encoder = default_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "720p", &encoder);
        assert!(args.contains(&"scale=-2:720".to_string()));
    }

    #[test]
    fn test_resolution_480p() {
        let encoder = default_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "480p", &encoder);
        assert!(args.contains(&"scale=-2:480".to_string()));
    }

    #[test]
    fn test_resolution_nvenc_uses_cuda_scale() {
        let encoder = nvenc_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "720p", &encoder);
        assert!(args.contains(&"scale_cuda=-2:720".to_string()));
    }

    #[test]
    fn test_resolution_vaapi_uses_vaapi_scale() {
        let encoder = vaapi_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "720p", &encoder);
        assert!(args.contains(&"scale_vaapi=-2:720".to_string()));
    }

    #[test]
    fn test_resolution_qsv_uses_qsv_scale() {
        let encoder = qsv_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "1080p", &encoder);
        assert!(args.contains(&"scale_qsv=-2:1080".to_string()));
    }

    #[test]
    fn test_resolution_amf_uses_cpu_scale() {
        let encoder = amf_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "480p", &encoder);
        assert!(args.contains(&"scale=-2:480".to_string()));
    }

    #[test]
    fn test_resolution_vt_uses_cpu_scale() {
        let encoder = vt_encoder();
        let mut args = vec![];
        add_resolution_args(&mut args, "720p", &encoder);
        assert!(args.contains(&"scale=-2:720".to_string()));
    }

    // --- audio args ---

    #[test]
    fn test_audio_copy() {
        let mut args = vec![];
        add_audio_args(&mut args, "copy");
        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"copy".to_string()));
        assert!(!args.contains(&"-b:a".to_string()));
    }

    #[test]
    fn test_audio_bitrate() {
        let mut args = vec![];
        add_audio_args(&mut args, "128k");
        assert!(args.contains(&"aac".to_string()));
        assert!(args.contains(&"-b:a".to_string()));
        assert!(args.contains(&"128k".to_string()));
    }
}
