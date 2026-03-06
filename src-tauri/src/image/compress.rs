use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use caesium::parameters::CSParameters;

use super::config::ImageCompressionConfig;
use crate::utils::error::AppError;

/// Compress a single image file using caesium.
/// Returns the output file size on success.
pub fn compress_image(
    input: &str,
    output: &str,
    config: &ImageCompressionConfig,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<u64, AppError> {
    if cancel_flag.load(Ordering::Acquire) {
        return Err(AppError::Cancelled);
    }

    let mut params = CSParameters::new();
    params.keep_metadata = config.keep_metadata;

    match config.mode.as_str() {
        "lossless" => {
            // JPEG: quality=0 means Huffman-only optimization (no re-encode)
            // PNG: moderate optimization (level 2 is ~10x faster than 4+zopfli, <3% size difference)
            // WebP: lossless mode
            params.jpeg.quality = 0;
            params.png.optimization_level = 2;
            params.png.force_zopfli = false;
            params.webp.lossless = true;
        }
        "lossy" => {
            params.jpeg.quality = config.quality;
            params.png.quality = config.quality;
            params.webp.quality = config.quality;
        }
        _ => {
            return Err(AppError::ImageError(format!(
                "Unknown compression mode: {}",
                config.mode
            )));
        }
    }

    // Check cancel before calling into caesium
    if cancel_flag.load(Ordering::Acquire) {
        return Err(AppError::Cancelled);
    }

    let needs_convert = needs_format_conversion(input, &config.output_format);
    if needs_convert {
        let target = map_to_caesium_format(&config.output_format)
            .ok_or_else(|| {
                AppError::ImageError(format!(
                    "Cannot convert to format: {}",
                    config.output_format
                ))
            })?;
        caesium::convert(input.to_string(), output.to_string(), &params, target)
            .map_err(|e| AppError::ImageError(e.to_string()))?;
    } else {
        caesium::compress(input.to_string(), output.to_string(), &params)
            .map_err(|e| AppError::ImageError(e.to_string()))?;
    }

    let output_size = std::fs::metadata(output)
        .map_err(|e| AppError::ImageError(format!("Cannot read output file: {}", e)))?
        .len();

    if output_size == 0 {
        let _ = std::fs::remove_file(output);
        return Err(AppError::ImageError(
            "Output file is empty, compression may have failed".into(),
        ));
    }

    Ok(output_size)
}

/// Check if format conversion is needed
fn needs_format_conversion(input_path: &str, output_format: &str) -> bool {
    if output_format == "same" {
        return false;
    }

    let input_ext = std::path::Path::new(input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let normalized_input = match input_ext.as_str() {
        "jpg" | "jpeg" => "jpeg",
        _ => &input_ext,
    };

    normalized_input != output_format
}

/// Map output format string to caesium SupportedFileTypes
fn map_to_caesium_format(format: &str) -> Option<caesium::SupportedFileTypes> {
    match format {
        "jpeg" => Some(caesium::SupportedFileTypes::Jpeg),
        "png" => Some(caesium::SupportedFileTypes::Png),
        "webp" => Some(caesium::SupportedFileTypes::WebP),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_needs_format_conversion_same() {
        assert!(!needs_format_conversion("/test.jpg", "same"));
        assert!(!needs_format_conversion("/test.png", "same"));
    }

    #[test]
    fn test_needs_format_conversion_different() {
        assert!(needs_format_conversion("/test.png", "jpeg"));
        assert!(needs_format_conversion("/test.jpg", "webp"));
        assert!(needs_format_conversion("/test.webp", "png"));
    }

    #[test]
    fn test_needs_format_conversion_same_format() {
        assert!(!needs_format_conversion("/test.jpg", "jpeg"));
        assert!(!needs_format_conversion("/test.jpeg", "jpeg"));
        assert!(!needs_format_conversion("/test.png", "png"));
        assert!(!needs_format_conversion("/test.webp", "webp"));
    }

    #[test]
    fn test_map_to_caesium_format() {
        assert!(map_to_caesium_format("jpeg").is_some());
        assert!(map_to_caesium_format("png").is_some());
        assert!(map_to_caesium_format("webp").is_some());
        assert!(map_to_caesium_format("tiff").is_none());
        assert!(map_to_caesium_format("bmp").is_none());
    }

    #[test]
    fn test_compress_cancelled_before_start() {
        let cancel_flag = Arc::new(AtomicBool::new(true));
        let config = ImageCompressionConfig::default();
        let result = compress_image("/input.png", "/output.png", &config, &cancel_flag);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::Cancelled => {}
            e => panic!("Expected Cancelled, got: {:?}", e),
        }
    }
}
