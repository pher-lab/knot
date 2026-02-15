use std::fs;
use std::path::{Path, PathBuf};

use tauri::State;
use uuid::Uuid;

use crate::crypto::{decrypt, encrypt};
use crate::models::{EncryptedNote, Note};

use super::StateWrapper;

/// Sanitize a string for use as a filename.
/// Removes characters that are invalid on Windows (\ / : * ? " < > |)
/// and trims leading/trailing whitespace and dots.
fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            // Also replace control characters
            c if c.is_control() => '_',
            c => c,
        })
        .collect();

    // Trim whitespace and dots (Windows doesn't allow trailing dots)
    let trimmed = sanitized.trim().trim_matches('.').trim().to_string();

    if trimmed.is_empty() {
        "Untitled".to_string()
    } else {
        trimmed
    }
}

/// Generate a unique file path by appending (2), (3), etc. if the file already exists.
fn unique_file_path(dir: &Path, base_name: &str, extension: &str) -> PathBuf {
    let first = dir.join(format!("{}.{}", base_name, extension));
    if !first.exists() {
        return first;
    }

    let mut counter = 2u32;
    loop {
        let path = dir.join(format!("{} ({}).{}", base_name, counter, extension));
        if !path.exists() {
            return path;
        }
        counter += 1;
    }
}

/// Export a single note to a .md file
#[tauri::command]
pub fn export_note(
    state: State<'_, StateWrapper>,
    note_id: String,
    file_path: String,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&note_id).map_err(|_| "Invalid note ID")?;

    let encrypted_note = db
        .get_note(&uuid)
        .map_err(|e| e.to_string())?
        .ok_or("Note not found")?;

    let decrypted = decrypt(&encrypted_note.encrypted_data, &**dek).map_err(|e| e.to_string())?;
    let note: Note = serde_json::from_slice(&decrypted).map_err(|e| e.to_string())?;

    fs::write(&file_path, &note.content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Export all notes to a directory as .md files
#[tauri::command]
pub fn export_all_notes(
    state: State<'_, StateWrapper>,
    dir_path: String,
) -> Result<u32, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let dir = Path::new(&dir_path);
    if !dir.is_dir() {
        return Err("Invalid directory".to_string());
    }

    let encrypted_notes = db.list_notes().map_err(|e| e.to_string())?;

    let mut count: u32 = 0;
    for enc in encrypted_notes {
        let decrypted = match decrypt(&enc.encrypted_data, &**dek) {
            Ok(data) => data,
            Err(_) => continue,
        };

        let note: Note = match serde_json::from_slice(&decrypted) {
            Ok(note) => note,
            Err(_) => continue,
        };

        let base_name = if note.title.is_empty() {
            "Untitled".to_string()
        } else {
            sanitize_filename(&note.title)
        };

        let file_path = unique_file_path(dir, &base_name, "md");

        if fs::write(&file_path, &note.content).is_ok() {
            count += 1;
        }
    }

    Ok(count)
}

/// Import .md files as notes
#[tauri::command]
pub fn import_notes(
    state: State<'_, StateWrapper>,
    file_paths: Vec<String>,
) -> Result<u32, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let mut count: u32 = 0;
    for path_str in &file_paths {
        let path = Path::new(path_str);

        // Extract title from filename (without extension)
        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();

        // Read file content
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Create note, encrypt, and save
        let note = Note::new(title, content);

        let note_json = serde_json::to_vec(&note).map_err(|e| e.to_string())?;
        let encrypted_data = encrypt(&note_json, &**dek).map_err(|e| e.to_string())?;

        let encrypted_note = EncryptedNote {
            id: note.id,
            encrypted_data,
            created_at: note.created_at,
            updated_at: note.updated_at,
        };

        db.save_note(&encrypted_note).map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_filename_removes_windows_forbidden_chars() {
        assert_eq!(sanitize_filename(r#"foo\bar/baz:qux*?"<>|"#), "foo_bar_baz_qux______");
    }

    #[test]
    fn test_sanitize_filename_trims_whitespace_and_dots() {
        assert_eq!(sanitize_filename("  hello  "), "hello");
        assert_eq!(sanitize_filename("...test..."), "test");
        assert_eq!(sanitize_filename("  ..hello..  "), "hello");
    }

    #[test]
    fn test_sanitize_filename_empty_returns_untitled() {
        assert_eq!(sanitize_filename(""), "Untitled");
        assert_eq!(sanitize_filename("   "), "Untitled");
        assert_eq!(sanitize_filename("..."), "Untitled");
    }

    #[test]
    fn test_sanitize_filename_preserves_unicode() {
        assert_eq!(sanitize_filename("日本語のノート"), "日本語のノート");
        assert_eq!(sanitize_filename("Ünïcödë"), "Ünïcödë");
    }

    #[test]
    fn test_sanitize_filename_control_chars() {
        assert_eq!(sanitize_filename("hello\0world"), "hello_world");
        assert_eq!(sanitize_filename("tab\there"), "tab_here");
    }

    #[test]
    fn test_unique_file_path_no_conflict() {
        let dir = std::env::temp_dir();
        let unique_name = format!("knot_test_{}", Uuid::new_v4());
        let path = unique_file_path(&dir, &unique_name, "md");
        assert_eq!(path, dir.join(format!("{}.md", unique_name)));
    }

    #[test]
    fn test_unique_file_path_with_conflict() {
        let dir = std::env::temp_dir();
        let unique_name = format!("knot_test_{}", Uuid::new_v4());

        // Create the first file to cause a conflict
        let first_path = dir.join(format!("{}.md", unique_name));
        fs::write(&first_path, "test").unwrap();

        let path = unique_file_path(&dir, &unique_name, "md");
        assert_eq!(path, dir.join(format!("{} (2).md", unique_name)));

        // Cleanup
        let _ = fs::remove_file(&first_path);
    }

    #[test]
    fn test_unique_file_path_with_multiple_conflicts() {
        let dir = std::env::temp_dir();
        let unique_name = format!("knot_test_{}", Uuid::new_v4());

        // Create first two files
        let first_path = dir.join(format!("{}.md", unique_name));
        let second_path = dir.join(format!("{} (2).md", unique_name));
        fs::write(&first_path, "test").unwrap();
        fs::write(&second_path, "test").unwrap();

        let path = unique_file_path(&dir, &unique_name, "md");
        assert_eq!(path, dir.join(format!("{} (3).md", unique_name)));

        // Cleanup
        let _ = fs::remove_file(&first_path);
        let _ = fs::remove_file(&second_path);
    }
}
