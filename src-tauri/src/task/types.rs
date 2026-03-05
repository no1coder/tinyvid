use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInfo {
    pub id: String,
    pub input_path: String,
    pub output_path: String,
    pub file_name: String,
    pub status: TaskStatus,
    pub progress: f64,
    pub input_size: u64,
    pub output_size: Option<u64>,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_status_serialization() {
        assert_eq!(serde_json::to_string(&TaskStatus::Pending).unwrap(), "\"pending\"");
        assert_eq!(serde_json::to_string(&TaskStatus::Running).unwrap(), "\"running\"");
        assert_eq!(serde_json::to_string(&TaskStatus::Completed).unwrap(), "\"completed\"");
        assert_eq!(serde_json::to_string(&TaskStatus::Failed).unwrap(), "\"failed\"");
        assert_eq!(serde_json::to_string(&TaskStatus::Cancelled).unwrap(), "\"cancelled\"");
        assert_eq!(serde_json::to_string(&TaskStatus::Paused).unwrap(), "\"paused\"");
    }

    #[test]
    fn test_task_info_serialization() {
        let info = TaskInfo {
            id: "task_1".into(),
            input_path: "/input.mp4".into(),
            output_path: "/output.mp4".into(),
            file_name: "input.mp4".into(),
            status: TaskStatus::Running,
            progress: 45.5,
            input_size: 1024 * 1024,
            output_size: Some(512 * 1024),
            error: None,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"inputPath\""));
        assert!(json.contains("\"outputPath\""));
        assert!(json.contains("\"fileName\""));
        assert!(json.contains("\"inputSize\""));
        assert!(json.contains("\"outputSize\""));
        assert!(json.contains("\"status\":\"running\""));
    }

    #[test]
    fn test_task_info_with_error() {
        let info = TaskInfo {
            id: "task_1".into(),
            input_path: "/input.mp4".into(),
            output_path: "/output.mp4".into(),
            file_name: "input.mp4".into(),
            status: TaskStatus::Failed,
            progress: 30.0,
            input_size: 1024,
            output_size: None,
            error: Some("encoder crashed".into()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"error\":\"encoder crashed\""));
        assert!(json.contains("\"outputSize\":null"));
    }

    #[test]
    fn test_task_status_equality() {
        assert_eq!(TaskStatus::Pending, TaskStatus::Pending);
        assert_ne!(TaskStatus::Pending, TaskStatus::Running);
        assert_ne!(TaskStatus::Completed, TaskStatus::Failed);
    }

    #[test]
    fn test_task_status_clone() {
        let status = TaskStatus::Running;
        let cloned = status.clone();
        assert_eq!(status, cloned);
    }
}
