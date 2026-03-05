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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_platform_returns_current() {
        let platform = detect_platform();
        #[cfg(target_os = "macos")]
        assert_eq!(platform, Platform::MacOS);
        #[cfg(target_os = "windows")]
        assert_eq!(platform, Platform::Windows);
        #[cfg(target_os = "linux")]
        assert_eq!(platform, Platform::Linux);
    }

    #[test]
    fn test_platform_serde_lowercase() {
        let json = serde_json::to_string(&Platform::MacOS).unwrap();
        assert_eq!(json, "\"macos\"");

        let json = serde_json::to_string(&Platform::Windows).unwrap();
        assert_eq!(json, "\"windows\"");

        let json = serde_json::to_string(&Platform::Linux).unwrap();
        assert_eq!(json, "\"linux\"");
    }

    #[test]
    fn test_platform_clone() {
        let p = Platform::MacOS;
        let p2 = p.clone();
        assert_eq!(p, p2);
    }

    #[test]
    fn test_platform_debug() {
        let debug = format!("{:?}", Platform::MacOS);
        assert_eq!(debug, "MacOS");
    }
}
