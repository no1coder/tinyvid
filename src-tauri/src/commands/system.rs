use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::ffmpeg::encoder::EncoderInfo;
use crate::state::AppState;
use crate::utils::error::AppError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSpaceInfo {
    pub available_bytes: u64,
    pub total_bytes: u64,
    pub required_bytes: u64,
    pub sufficient: bool,
    pub tight: bool,
}

#[tauri::command]
pub fn detect_hardware(state: State<'_, AppState>) -> Result<Vec<EncoderInfo>, AppError> {
    let encoders = state.encoders.lock().unwrap();
    Ok(encoders.clone())
}

#[tauri::command]
pub fn get_ffmpeg_version(state: State<'_, AppState>) -> Result<String, AppError> {
    let ffmpeg_path = state.ffmpeg_path.lock().unwrap();
    let path = ffmpeg_path.as_ref().ok_or(AppError::FfmpegNotFound)?;

    let output = std::process::Command::new(path).arg("-version").output()?;

    let version = String::from_utf8_lossy(&output.stdout);
    let first_line = version.lines().next().unwrap_or("unknown").to_string();
    Ok(first_line)
}

/// Check available disk space for the target output directory.
/// `estimated_bytes` is the total estimated output size from the frontend.
/// `output_dir` is the directory where compressed files will be written.
#[tauri::command]
pub fn check_disk_space(
    output_dir: String,
    estimated_bytes: u64,
) -> Result<DiskSpaceInfo, AppError> {
    let path = Path::new(&output_dir);

    // Walk up to find an existing directory for the check
    let check_path = std::iter::successors(Some(path), |p| p.parent())
        .find(|p| p.exists())
        .unwrap_or(path);

    let (available, total) = get_disk_space(check_path)?;
    let required = (estimated_bytes as f64 * 1.1) as u64; // 10% safety margin
    let sufficient = available >= required;
    let tight = sufficient && available < required * 2; // <2x margin is tight

    Ok(DiskSpaceInfo {
        available_bytes: available,
        total_bytes: total,
        required_bytes: required,
        sufficient,
        tight,
    })
}

/// Show the file in Finder/Explorer/file manager
#[tauri::command]
pub fn show_in_folder(path: String) -> Result<(), AppError> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::InvalidFile(format!(
            "File not found: {}",
            path
        )));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::Io(e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| AppError::Io(e))?;
    }
    #[cfg(target_os = "linux")]
    {
        // Try xdg-open on the parent directory
        if let Some(parent) = file_path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| AppError::Io(e))?;
        }
    }

    Ok(())
}

#[cfg(unix)]
fn get_disk_space(path: &Path) -> Result<(u64, u64), AppError> {
    use std::ffi::CString;
    use std::mem::MaybeUninit;

    let c_path = CString::new(path.to_string_lossy().as_bytes())
        .map_err(|_| AppError::InvalidFile("Invalid path".into()))?;

    unsafe {
        let mut stat: MaybeUninit<libc::statvfs> = MaybeUninit::uninit();
        if libc::statvfs(c_path.as_ptr(), stat.as_mut_ptr()) != 0 {
            return Err(AppError::Io(std::io::Error::last_os_error()));
        }
        let stat = stat.assume_init();
        let available = stat.f_bavail as u64 * stat.f_frsize as u64;
        let total = stat.f_blocks as u64 * stat.f_frsize as u64;
        Ok((available, total))
    }
}

#[cfg(windows)]
fn get_disk_space(path: &Path) -> Result<(u64, u64), AppError> {
    use std::os::windows::ffi::OsStrExt;

    let wide_path: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut free_available: u64 = 0;
    let mut total: u64 = 0;
    let mut _total_free: u64 = 0;

    let result = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_available,
            &mut total,
            &mut _total_free,
        )
    };

    if result == 0 {
        return Err(AppError::Io(std::io::Error::last_os_error()));
    }

    Ok((free_available, total))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_disk_space_current_dir() {
        let result = get_disk_space(Path::new("."));
        assert!(result.is_ok());
        let (available, total) = result.unwrap();
        assert!(total > 0);
        assert!(available <= total);
    }

    #[test]
    fn test_check_disk_space_sufficient() {
        let result = check_disk_space(".".to_string(), 1024);
        assert!(result.is_ok());
        let info = result.unwrap();
        assert!(info.sufficient);
        assert!(info.available_bytes > 0);
    }
}
