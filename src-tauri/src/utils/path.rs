use std::path::{Path, PathBuf};

use tauri::Manager;

// Common binary install locations (GUI apps may not inherit shell PATH)
#[cfg(not(target_os = "windows"))]
const COMMON_BIN_DIRS: &[&str] = &[
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
];

#[cfg(target_os = "windows")]
const COMMON_BIN_DIRS: &[&str] = &[];

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts", "mts", "m2ts", "vob", "mpg",
    "mpeg", "3gp",
];

/// Resolve FFmpeg binary path.
/// Priority: sidecar (dev) → exe dir (production bundle) → system PATH fallback.
pub fn resolve_ffmpeg(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    resolve_sidecar(app_handle, "ffmpeg")
}

/// Resolve FFprobe binary path (same priority as FFmpeg).
pub fn resolve_ffprobe(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    resolve_sidecar(app_handle, "ffprobe")
}

/// Resolve a sidecar binary by name.
/// Priority:
///   1. Dev sidecar: src-tauri/binaries/<name>-<target-triple> (via Resource dir)
///   2. Production bundle: next to main executable (Contents/MacOS/<name>)
///   3. System PATH fallback (for development without bundled binaries)
fn resolve_sidecar(app_handle: &tauri::AppHandle, name: &str) -> Option<PathBuf> {
    let binary_name = if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    // 1. Dev sidecar: binaries/<name>-<target-triple> in resource dir
    if let Ok(path) = app_handle.path().resolve(
        sidecar_name(name),
        tauri::path::BaseDirectory::Resource,
    ) {
        if path.exists() {
            log::info!("Using bundled {} sidecar: {:?}", name, path);
            return Some(path);
        }
    }

    // 2. Production bundle: next to main executable (Contents/MacOS/)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let bundled = exe_dir.join(&binary_name);
            if bundled.exists() && is_runnable(&bundled) {
                log::info!("Using bundled {} from exe dir: {:?}", name, bundled);
                return Some(bundled);
            }
        }
    }

    // 3. System PATH fallback (for development)
    log::info!("Bundled {} not found, searching system PATH...", name);
    if let Some(path) = find_in_path(name) {
        return Some(path);
    }

    // 4. Common install locations (GUI apps may not inherit shell PATH)
    for dir in COMMON_BIN_DIRS {
        let candidate = Path::new(dir).join(&binary_name);
        if candidate.exists() {
            log::info!("Found {} at common path: {:?}", name, candidate);
            return Some(candidate);
        }
    }

    None
}

/// Build sidecar binary name with platform suffix.
/// Tauri externalBin convention: "binaries/ffmpeg" resolves to
/// "binaries/ffmpeg-<target-triple>[.exe]" at build time.
fn sidecar_name(name: &str) -> String {
    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
    format!("binaries/{}-{}{}{}", name, std::env::consts::ARCH, platform_suffix(), ext)
}

fn platform_suffix() -> &'static str {
    if cfg!(target_os = "macos") {
        "-apple-darwin"
    } else if cfg!(target_os = "windows") {
        "-pc-windows-msvc"
    } else {
        "-unknown-linux-gnu"
    }
}

/// Quick check that a binary can actually execute (catches missing dylibs)
fn is_runnable(path: &Path) -> bool {
    std::process::Command::new(path)
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Search for a binary in the system PATH.
/// Uses "where" on Windows, "which" on Unix/macOS.
fn find_in_path(name: &str) -> Option<PathBuf> {
    let cmd = if cfg!(target_os = "windows") { "where" } else { "which" };

    std::process::Command::new(cmd)
        .arg(name)
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                // "where" on Windows may return multiple lines; take the first
                let path_str = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path_str.is_empty() {
                    log::info!("Found {} in system PATH: {}", name, path_str);
                    Some(PathBuf::from(path_str))
                } else {
                    None
                }
            } else {
                None
            }
        })
}

/// Generate output path with `_compressed` suffix.
/// If `output_dir` is provided, place the file there instead of next to the input.
/// Automatically appends a numeric suffix if the file already exists to avoid overwriting.
pub fn generate_output_path(input: &Path, output_dir: Option<&str>) -> PathBuf {
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let parent = match output_dir {
        Some(dir) if !dir.is_empty() => Path::new(dir).to_path_buf(),
        _ => input.parent().unwrap_or_else(|| Path::new(".")).to_path_buf(),
    };

    let base = parent.join(format!("{}_compressed.mp4", stem));
    if !base.exists() {
        return base;
    }

    // Append numeric suffix to avoid overwriting: file_compressed_2.mp4, _3.mp4, ...
    for i in 2..=999 {
        let candidate = parent.join(format!("{}_compressed_{}.mp4", stem, i));
        if !candidate.exists() {
            return candidate;
        }
    }

    // Fallback (should never reach here in practice)
    base
}

/// Check if file extension is a supported video format
pub fn is_supported_video(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_output_path() {
        let input = Path::new("/videos/test.mp4");
        let output = generate_output_path(input, None);
        assert_eq!(output, PathBuf::from("/videos/test_compressed.mp4"));
    }

    #[test]
    fn test_generate_output_path_with_spaces() {
        let input = Path::new("/my videos/my file.mkv");
        let output = generate_output_path(input, None);
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

    #[test]
    fn test_is_supported_video_all_formats() {
        let formats = [
            "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm",
            "m4v", "ts", "mts", "m2ts", "vob", "mpg", "mpeg", "3gp",
        ];
        for ext in &formats {
            assert!(
                is_supported_video(Path::new(&format!("test.{}", ext))),
                "Expected {} to be supported",
                ext
            );
        }
    }

    #[test]
    fn test_is_supported_video_case_insensitive() {
        assert!(is_supported_video(Path::new("test.MP4")));
        assert!(is_supported_video(Path::new("test.Avi")));
        assert!(is_supported_video(Path::new("test.WEBM")));
        assert!(is_supported_video(Path::new("test.MOV")));
    }

    #[test]
    fn test_generate_output_path_no_extension() {
        let input = Path::new("/videos/noext");
        let output = generate_output_path(input, None);
        assert_eq!(output, PathBuf::from("/videos/noext_compressed.mp4"));
    }

    #[test]
    fn test_generate_output_path_custom_dir() {
        let input = Path::new("/videos/test.mp4");
        let output = generate_output_path(input, Some("/output"));
        assert_eq!(output, PathBuf::from("/output/test_compressed.mp4"));
    }

    #[test]
    fn test_generate_output_path_empty_dir_falls_back() {
        let input = Path::new("/videos/test.mp4");
        let output = generate_output_path(input, Some(""));
        assert_eq!(output, PathBuf::from("/videos/test_compressed.mp4"));
    }

    #[test]
    fn test_generate_output_path_avoids_overwrite() {
        let dir = std::env::temp_dir().join("tinyvid_test_overwrite");
        let _ = std::fs::create_dir_all(&dir);
        // Create the base output file
        let existing = dir.join("video_compressed.mp4");
        std::fs::write(&existing, "fake").unwrap();

        let input = dir.join("video.mp4");
        let output = generate_output_path(&input, None);
        assert_eq!(output, dir.join("video_compressed_2.mp4"));

        // Create _2 too
        std::fs::write(&output, "fake").unwrap();
        let output3 = generate_output_path(&input, None);
        assert_eq!(output3, dir.join("video_compressed_3.mp4"));

        // Cleanup
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_generate_output_path_different_extension() {
        let input = Path::new("/videos/test.mkv");
        let output = generate_output_path(input, None);
        // Output always uses .mp4 extension
        assert_eq!(output, PathBuf::from("/videos/test_compressed.mp4"));
    }

    #[test]
    fn test_sidecar_name_format() {
        let name = sidecar_name("ffmpeg");
        assert!(name.starts_with("binaries/ffmpeg-"));
        assert!(name.contains(std::env::consts::ARCH));
        #[cfg(target_os = "macos")]
        assert!(name.ends_with("-apple-darwin"));
        #[cfg(target_os = "windows")]
        assert!(name.ends_with("-pc-windows-msvc.exe"));
        #[cfg(target_os = "linux")]
        assert!(name.ends_with("-unknown-linux-gnu"));
    }

    #[test]
    fn test_sidecar_name_ffprobe() {
        let name = sidecar_name("ffprobe");
        assert!(name.starts_with("binaries/ffprobe-"));
    }

    #[test]
    fn test_platform_suffix() {
        let suffix = platform_suffix();
        #[cfg(target_os = "macos")]
        assert_eq!(suffix, "-apple-darwin");
        #[cfg(target_os = "windows")]
        assert_eq!(suffix, "-pc-windows-msvc");
        #[cfg(target_os = "linux")]
        assert_eq!(suffix, "-unknown-linux-gnu");
    }

    #[test]
    fn test_find_in_path_nonexistent() {
        let result = find_in_path("totally_nonexistent_binary_xyz_123");
        assert!(result.is_none());
    }

    #[test]
    fn test_find_in_path_known_binary() {
        // "ls" (or "cmd" on Windows) should always exist
        #[cfg(not(target_os = "windows"))]
        let result = find_in_path("ls");
        #[cfg(target_os = "windows")]
        let result = find_in_path("cmd");
        assert!(result.is_some());
    }
}
