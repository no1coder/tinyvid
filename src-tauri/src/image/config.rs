use serde::{Deserialize, Serialize};

use crate::utils::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressionConfig {
    pub mode: String,
    pub quality: u32,
    pub output_format: String,
    pub output_dir: Option<String>,
    pub filename_template: String,
    pub max_concurrency: Option<usize>,
    pub keep_metadata: bool,
}

impl Default for ImageCompressionConfig {
    fn default() -> Self {
        Self {
            mode: "lossless".to_string(),
            quality: 80,
            output_format: "same".to_string(),
            output_dir: None,
            filename_template: "{name}_compressed".to_string(),
            max_concurrency: None,
            keep_metadata: true,
        }
    }
}

const VALID_MODES: &[&str] = &["lossless", "lossy"];
const VALID_IMAGE_OUTPUT_FORMATS: &[&str] = &["same", "jpeg", "png", "webp"];
const QUALITY_MIN: u32 = 1;
const QUALITY_MAX: u32 = 100;

/// Validate image compression config using whitelist approach
pub fn validate_image_config(config: &ImageCompressionConfig) -> Result<(), AppError> {
    if !VALID_MODES.contains(&config.mode.as_str()) {
        return Err(AppError::ImageError(format!(
            "Invalid mode: '{}'. Allowed: {:?}",
            config.mode, VALID_MODES
        )));
    }

    if config.mode == "lossy" && (config.quality < QUALITY_MIN || config.quality > QUALITY_MAX) {
        return Err(AppError::ImageError(format!(
            "Quality {} out of range ({}..={})",
            config.quality, QUALITY_MIN, QUALITY_MAX
        )));
    }

    if !VALID_IMAGE_OUTPUT_FORMATS.contains(&config.output_format.as_str()) {
        return Err(AppError::ImageError(format!(
            "Invalid output format: '{}'. Allowed: {:?}",
            config.output_format, VALID_IMAGE_OUTPUT_FORMATS
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ImageCompressionConfig::default();
        assert_eq!(config.mode, "lossless");
        assert_eq!(config.quality, 80);
        assert_eq!(config.output_format, "same");
        assert!(config.keep_metadata);
    }

    #[test]
    fn test_validate_valid_lossless() {
        let config = ImageCompressionConfig {
            mode: "lossless".into(),
            ..Default::default()
        };
        assert!(validate_image_config(&config).is_ok());
    }

    #[test]
    fn test_validate_valid_lossy() {
        let config = ImageCompressionConfig {
            mode: "lossy".into(),
            quality: 75,
            ..Default::default()
        };
        assert!(validate_image_config(&config).is_ok());
    }

    #[test]
    fn test_validate_invalid_mode() {
        let config = ImageCompressionConfig {
            mode: "ultra".into(),
            ..Default::default()
        };
        let err = validate_image_config(&config).unwrap_err();
        assert!(err.to_string().contains("Invalid mode"));
    }

    #[test]
    fn test_validate_quality_too_low() {
        let config = ImageCompressionConfig {
            mode: "lossy".into(),
            quality: 0,
            ..Default::default()
        };
        let err = validate_image_config(&config).unwrap_err();
        assert!(err.to_string().contains("out of range"));
    }

    #[test]
    fn test_validate_quality_too_high() {
        let config = ImageCompressionConfig {
            mode: "lossy".into(),
            quality: 101,
            ..Default::default()
        };
        let err = validate_image_config(&config).unwrap_err();
        assert!(err.to_string().contains("out of range"));
    }

    #[test]
    fn test_validate_quality_boundary_in_lossless() {
        // quality is ignored in lossless mode, so any value should pass
        let config = ImageCompressionConfig {
            mode: "lossless".into(),
            quality: 0,
            ..Default::default()
        };
        assert!(validate_image_config(&config).is_ok());
    }

    #[test]
    fn test_validate_invalid_output_format() {
        let config = ImageCompressionConfig {
            output_format: "tiff".into(),
            ..Default::default()
        };
        let err = validate_image_config(&config).unwrap_err();
        assert!(err.to_string().contains("Invalid output format"));
    }

    #[test]
    fn test_validate_all_valid_formats() {
        for fmt in &["same", "jpeg", "png", "webp"] {
            let config = ImageCompressionConfig {
                output_format: fmt.to_string(),
                ..Default::default()
            };
            assert!(
                validate_image_config(&config).is_ok(),
                "Expected format '{}' to be valid",
                fmt
            );
        }
    }

    #[test]
    fn test_serde_roundtrip() {
        let config = ImageCompressionConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"mode\":\"lossless\""));
        assert!(json.contains("\"outputFormat\":\"same\""));
        assert!(json.contains("\"filenameTemplate\":\"{name}_compressed\""));
        assert!(json.contains("\"keepMetadata\":true"));

        let parsed: ImageCompressionConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.mode, "lossless");
        assert_eq!(parsed.quality, 80);
    }
}
