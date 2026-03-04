use std::path::{Path, PathBuf};

use super::platform::{detect_platform, Platform};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts", "mts", "m2ts", "vob", "mpg",
    "mpeg", "3gp",
];

/// Get the bundled FFmpeg binary path based on platform
pub fn get_ffmpeg_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let binary_name = match detect_platform() {
        Platform::Windows => "ffmpeg.exe",
        _ => "ffmpeg",
    };

    resource_dir.join(binary_name)
}

/// Get the bundled FFprobe binary path based on platform
pub fn get_ffprobe_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let binary_name = match detect_platform() {
        Platform::Windows => "ffprobe.exe",
        _ => "ffprobe",
    };

    resource_dir.join(binary_name)
}

/// Generate output path with `_compressed` suffix
pub fn generate_output_path(input: &Path) -> PathBuf {
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let parent = input.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("{}_compressed.mp4", stem))
}

/// Check if file extension is a supported video format
pub fn is_supported_video(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

use tauri::Manager;

/// Try to find ffmpeg in system PATH as fallback
pub fn find_system_ffmpeg() -> Option<PathBuf> {
    which_ffmpeg("ffmpeg")
}

/// Try to find ffprobe in system PATH as fallback
pub fn find_system_ffprobe() -> Option<PathBuf> {
    which_ffmpeg("ffprobe")
}

fn which_ffmpeg(name: &str) -> Option<PathBuf> {
    std::process::Command::new("which")
        .arg(name)
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    Some(PathBuf::from(path_str))
                } else {
                    None
                }
            } else {
                None
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_output_path() {
        let input = Path::new("/videos/test.mp4");
        let output = generate_output_path(input);
        assert_eq!(output, PathBuf::from("/videos/test_compressed.mp4"));
    }

    #[test]
    fn test_generate_output_path_with_spaces() {
        let input = Path::new("/my videos/my file.mkv");
        let output = generate_output_path(input);
        assert_eq!(
            output,
            PathBuf::from("/my videos/my file_compressed.mp4")
        );
    }

    #[test]
    fn test_is_supported_video() {
        assert!(is_supported_video(Path::new("test.mp4")));
        assert!(is_supported_video(Path::new("test.MKV")));
        assert!(is_supported_video(Path::new("test.avi")));
        assert!(!is_supported_video(Path::new("test.txt")));
        assert!(!is_supported_video(Path::new("test.jpg")));
        assert!(!is_supported_video(Path::new("noext")));
    }
}
