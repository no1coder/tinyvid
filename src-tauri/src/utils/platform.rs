use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    MacOS,
    Windows,
    Linux,
}

pub fn detect_platform() -> Platform {
    if cfg!(target_os = "macos") {
        Platform::MacOS
    } else if cfg!(target_os = "windows") {
        Platform::Windows
    } else {
        Platform::Linux
    }
}
