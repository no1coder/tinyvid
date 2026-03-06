use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::utils::error::AppError;
use crate::utils::path::is_supported_image;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    pub path: String,
    pub file_name: String,
    pub size: u64,
    pub width: u32,
    pub height: u32,
    pub format: String,
}

/// Read image metadata without decoding pixels.
/// Uses imagesize crate to read only file headers (microsecond-level).
pub fn probe_image(path: &Path) -> Result<ImageInfo, AppError> {
    if !path.exists() {
        return Err(AppError::InvalidFile(format!(
            "File not found: {}",
            path.display()
        )));
    }

    if !is_supported_image(path) {
        return Err(AppError::InvalidFile(format!(
            "Unsupported image format: {}",
            path.display()
        )));
    }

    let metadata = std::fs::metadata(path)?;

    let (width, height) = imagesize::size(path)
        .map(|s| (s.width as u32, s.height as u32))
        .map_err(|e| AppError::InvalidFile(format!("Cannot read image dimensions: {}", e)))?;

    let format = detect_image_format(path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(ImageInfo {
        path: path.to_string_lossy().to_string(),
        file_name,
        size: metadata.len(),
        width,
        height,
        format,
    })
}

/// Detect image format from file extension
fn detect_image_format(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "jpg" | "jpeg" => "jpeg".to_string(),
            "tif" | "tiff" => "tiff".to_string(),
            other => other.to_string(),
        })
        .unwrap_or_else(|| "unknown".to_string())
}

/// Collect supported image files from a list of paths.
/// Filters out non-image files silently.
pub fn collect_images(paths: &[String]) -> Vec<ImageInfo> {
    paths
        .iter()
        .filter_map(|p| {
            let path = Path::new(p);
            probe_image(path).ok()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_detect_image_format_jpeg() {
        assert_eq!(detect_image_format(Path::new("test.jpg")), "jpeg");
        assert_eq!(detect_image_format(Path::new("test.jpeg")), "jpeg");
        assert_eq!(detect_image_format(Path::new("test.JPG")), "jpeg");
    }

    #[test]
    fn test_detect_image_format_png() {
        assert_eq!(detect_image_format(Path::new("test.png")), "png");
    }

    #[test]
    fn test_detect_image_format_webp() {
        assert_eq!(detect_image_format(Path::new("test.webp")), "webp");
    }

    #[test]
    fn test_detect_image_format_tiff() {
        assert_eq!(detect_image_format(Path::new("test.tif")), "tiff");
        assert_eq!(detect_image_format(Path::new("test.tiff")), "tiff");
    }

    #[test]
    fn test_detect_image_format_no_extension() {
        assert_eq!(detect_image_format(Path::new("noext")), "unknown");
    }

    #[test]
    fn test_probe_image_not_found() {
        let result = probe_image(Path::new("/nonexistent/image.png"));
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("File not found"));
    }

    #[test]
    fn test_probe_image_unsupported_format() {
        let dir = std::env::temp_dir().join("tinyvid_test_probe_img");
        let _ = std::fs::create_dir_all(&dir);
        let txt_file = dir.join("test.txt");
        std::fs::write(&txt_file, "not an image").unwrap();

        let result = probe_image(&txt_file);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Unsupported image format"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_probe_real_png() {
        // Create a minimal valid PNG (1x1 pixel, red)
        let dir = std::env::temp_dir().join("tinyvid_test_probe_png");
        let _ = std::fs::create_dir_all(&dir);
        let png_path = dir.join("test.png");

        // Minimal 1x1 PNG file
        let png_bytes: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, // depth=8, RGB
            0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
            0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00,
            0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
            0xAE, 0x42, 0x60, 0x82,
        ];

        let mut file = std::fs::File::create(&png_path).unwrap();
        file.write_all(png_bytes).unwrap();

        let info = probe_image(&png_path).unwrap();
        assert_eq!(info.width, 1);
        assert_eq!(info.height, 1);
        assert_eq!(info.format, "png");
        assert_eq!(info.file_name, "test.png");
        assert!(info.size > 0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_collect_images_filters_invalid() {
        let paths = vec![
            "/nonexistent/a.png".to_string(),
            "/nonexistent/b.txt".to_string(),
        ];
        let images = collect_images(&paths);
        assert!(images.is_empty());
    }
}
