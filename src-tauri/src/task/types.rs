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
