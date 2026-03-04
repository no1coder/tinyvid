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
