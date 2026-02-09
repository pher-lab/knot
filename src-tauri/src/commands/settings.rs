use serde::{Deserialize, Serialize};

use super::get_knot_dir;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Settings {
    pub theme: Option<String>,
    pub language: Option<String>,
    pub auto_lock_minutes: Option<u32>,
}

/// Load settings from settings.json. Returns default (all None) if file doesn't exist.
#[tauri::command]
pub fn load_settings() -> Result<Settings, String> {
    let knot_dir = get_knot_dir()?;
    let path = knot_dir.join("settings.json");

    if !path.exists() {
        return Ok(Settings::default());
    }

    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(settings)
}

/// Save settings to settings.json.
#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<bool, String> {
    let knot_dir = get_knot_dir()?;
    std::fs::create_dir_all(&knot_dir).map_err(|e| e.to_string())?;

    let path = knot_dir.join("settings.json");
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_settings_serialization() {
        let settings = Settings {
            theme: Some("dark".to_string()),
            language: Some("ja".to_string()),
            auto_lock_minutes: Some(5),
        };
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.theme.as_deref(), Some("dark"));
        assert_eq!(deserialized.language.as_deref(), Some("ja"));
        assert_eq!(deserialized.auto_lock_minutes, Some(5));
    }

    #[test]
    fn test_settings_default() {
        let settings = Settings::default();
        assert!(settings.theme.is_none());
        assert!(settings.language.is_none());
        assert!(settings.auto_lock_minutes.is_none());
    }

    #[test]
    fn test_settings_partial_json() {
        let json = r#"{"theme":"light"}"#;
        let settings: Settings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.theme.as_deref(), Some("light"));
        assert!(settings.language.is_none());
        assert!(settings.auto_lock_minutes.is_none());
    }

    #[test]
    fn test_save_and_load_settings() {
        let temp_dir = tempfile::tempdir().unwrap();
        let settings_path = temp_dir.path().join("settings.json");

        let settings = Settings {
            theme: Some("dark".to_string()),
            language: Some("en".to_string()),
            auto_lock_minutes: Some(10),
        };

        let data = serde_json::to_string_pretty(&settings).unwrap();
        fs::write(&settings_path, &data).unwrap();

        let loaded_data = fs::read_to_string(&settings_path).unwrap();
        let loaded: Settings = serde_json::from_str(&loaded_data).unwrap();
        assert_eq!(loaded.theme.as_deref(), Some("dark"));
        assert_eq!(loaded.language.as_deref(), Some("en"));
        assert_eq!(loaded.auto_lock_minutes, Some(10));
    }
}
