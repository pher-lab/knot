use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::crypto::{decrypt, encrypt};

use super::StateWrapper;

/// Maximum image size: 10MB
const MAX_IMAGE_SIZE: usize = 10 * 1024 * 1024;

/// Allowed MIME types
const ALLOWED_MIME_TYPES: &[&str] = &["image/png", "image/jpeg", "image/gif", "image/webp"];

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub id: String,
    pub note_id: String,
    pub mime_type: String,
    pub size_bytes: i64,
}

/// Save an image from raw bytes (for clipboard paste / drag-drop)
#[tauri::command]
pub fn save_image(
    state: State<'_, StateWrapper>,
    note_id: String,
    data: Vec<u8>,
    mime_type: String,
) -> Result<ImageInfo, String> {
    // Validate MIME type
    if !ALLOWED_MIME_TYPES.contains(&mime_type.as_str()) {
        return Err("Unsupported image type".to_string());
    }

    // Validate size
    if data.len() > MAX_IMAGE_SIZE {
        return Err("Image too large".to_string());
    }

    let app_state = state.lock().map_err(|_| "Failed to lock state")?;
    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let note_uuid = Uuid::parse_str(&note_id).map_err(|_| "Invalid note ID")?;
    let image_id = Uuid::new_v4();
    let size_bytes = data.len() as i64;
    let now = Utc::now();

    // Encrypt the image data
    let encrypted_data = encrypt(&data, &**dek).map_err(|e| e.to_string())?;

    db.save_image(&image_id, &note_uuid, &encrypted_data, &mime_type, size_bytes, &now)
        .map_err(|e| e.to_string())?;

    Ok(ImageInfo {
        id: image_id.to_string(),
        note_id,
        mime_type,
        size_bytes,
    })
}

/// Save an image from a file path (for toolbar file dialog — reads file in Rust to avoid IPC transfer)
#[tauri::command]
pub fn save_image_from_path(
    state: State<'_, StateWrapper>,
    note_id: String,
    file_path: String,
) -> Result<ImageInfo, String> {
    // Read file
    let data = std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Validate size
    if data.len() > MAX_IMAGE_SIZE {
        return Err("Image too large".to_string());
    }

    // Infer MIME type from extension
    let mime_type = match std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => return Err("Unsupported image type".to_string()),
    }
    .to_string();

    let app_state = state.lock().map_err(|_| "Failed to lock state")?;
    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let note_uuid = Uuid::parse_str(&note_id).map_err(|_| "Invalid note ID")?;
    let image_id = Uuid::new_v4();
    let size_bytes = data.len() as i64;
    let now = Utc::now();

    let encrypted_data = encrypt(&data, &**dek).map_err(|e| e.to_string())?;

    db.save_image(&image_id, &note_uuid, &encrypted_data, &mime_type, size_bytes, &now)
        .map_err(|e| e.to_string())?;

    Ok(ImageInfo {
        id: image_id.to_string(),
        note_id,
        mime_type,
        size_bytes,
    })
}

/// Get decrypted image data (for export/PDF)
#[tauri::command]
pub fn get_image_data(
    state: State<'_, StateWrapper>,
    image_id: String,
) -> Result<Vec<u8>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;
    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&image_id).map_err(|_| "Invalid image ID")?;

    let enc = db
        .get_image(&uuid)
        .map_err(|e| e.to_string())?
        .ok_or("Image not found")?;

    let decrypted = decrypt(&enc.encrypted_data, &**dek).map_err(|e| e.to_string())?;

    Ok(decrypted)
}

/// Delete a single image
#[tauri::command]
pub fn delete_image(
    state: State<'_, StateWrapper>,
    image_id: String,
) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&image_id).map_err(|_| "Invalid image ID")?;

    db.delete_image(&uuid).map_err(|e| e.to_string())
}
