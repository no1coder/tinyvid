use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("FFmpeg not found at expected path")]
    FfmpegNotFound,

    #[error("FFmpeg error: {0}")]
    FfmpegError(String),

    #[error("Invalid file: {0}")]
    InvalidFile(String),

    #[error("Task not found: {0}")]
    TaskNotFound(String),

    #[error("Task cancelled")]
    Cancelled,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Safely lock a Mutex, recovering from poison if a thread panicked while holding the lock.
/// This prevents cascading panics throughout the application.
pub fn safe_lock<T>(mutex: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            log::warn!("Mutex was poisoned, recovering");
            poisoned.into_inner()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_display_ffmpeg_not_found() {
        let err = AppError::FfmpegNotFound;
        assert_eq!(err.to_string(), "FFmpeg not found at expected path");
    }

    #[test]
    fn test_display_ffmpeg_error() {
        let err = AppError::FfmpegError("codec failed".into());
        assert_eq!(err.to_string(), "FFmpeg error: codec failed");
    }

    #[test]
    fn test_display_invalid_file() {
        let err = AppError::InvalidFile("no video stream".into());
        assert_eq!(err.to_string(), "Invalid file: no video stream");
    }

    #[test]
    fn test_display_task_not_found() {
        let err = AppError::TaskNotFound("task_99".into());
        assert_eq!(err.to_string(), "Task not found: task_99");
    }

    #[test]
    fn test_display_cancelled() {
        let err = AppError::Cancelled;
        assert_eq!(err.to_string(), "Task cancelled");
    }

    #[test]
    fn test_serialize_to_string() {
        let err = AppError::FfmpegError("timeout".into());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"FFmpeg error: timeout\"");
    }

    #[test]
    fn test_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file missing");
        let app_err: AppError = io_err.into();
        assert!(app_err.to_string().contains("file missing"));
    }

    #[test]
    fn test_from_json_error() {
        let json_err = serde_json::from_str::<String>("invalid").unwrap_err();
        let app_err: AppError = json_err.into();
        assert!(app_err.to_string().starts_with("JSON error:"));
    }
}
