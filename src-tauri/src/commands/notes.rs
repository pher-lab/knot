use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::crypto::{decrypt, encrypt};
use crate::models::{EncryptedNote, Note};

use super::StateWrapper;

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

impl NoteResponse {
    pub fn from_note_with_tags(note: Note, tags: Vec<String>) -> Self {
        Self {
            id: note.id.to_string(),
            title: note.title,
            content: note.content,
            created_at: note.created_at.to_rfc3339(),
            updated_at: note.updated_at.to_rfc3339(),
            tags,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteListItem {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub pinned: bool,
    pub tags: Vec<String>,
    pub deleted_at: Option<String>,
}

/// Create a new note
#[tauri::command]
pub fn create_note(
    state: State<'_, StateWrapper>,
    title: String,
    content: String,
) -> Result<NoteResponse, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    // Create note
    let note = Note::new(title, content);

    // Serialize and encrypt
    let note_json = serde_json::to_vec(&note).map_err(|e| e.to_string())?;
    let encrypted_data = encrypt(&note_json, &**dek).map_err(|e| e.to_string())?;
    let encrypted_title = encrypt(note.title.as_bytes(), &**dek).map_err(|e| e.to_string())?;

    // Save to database
    let encrypted_note = EncryptedNote {
        id: note.id,
        encrypted_data,
        encrypted_title: Some(encrypted_title),
        created_at: note.created_at,
        updated_at: note.updated_at,
        pinned: false,
        is_deleted: false,
        deleted_at: None,
    };

    db.save_note(&encrypted_note).map_err(|e| e.to_string())?;

    Ok(NoteResponse::from_note_with_tags(note, vec![]))
}

/// Get a note by ID
#[tauri::command]
pub fn get_note(
    state: State<'_, StateWrapper>,
    id: String,
) -> Result<Option<NoteResponse>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    let encrypted_note = db.get_note(&uuid).map_err(|e| e.to_string())?;

    match encrypted_note {
        Some(enc) => {
            let decrypted = decrypt(&enc.encrypted_data, &**dek).map_err(|e| e.to_string())?;
            let note: Note = serde_json::from_slice(&decrypted).map_err(|e| e.to_string())?;
            let tags = db.get_note_tags(&uuid).map_err(|e| e.to_string())?;
            Ok(Some(NoteResponse::from_note_with_tags(note, tags)))
        }
        None => Ok(None),
    }
}

/// Update an existing note
#[tauri::command]
pub fn update_note(
    state: State<'_, StateWrapper>,
    id: String,
    title: String,
    content: String,
) -> Result<NoteResponse, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    // Get existing note to preserve created_at
    let encrypted_note = db
        .get_note(&uuid)
        .map_err(|e| e.to_string())?
        .ok_or("Note not found")?;

    let decrypted = decrypt(&encrypted_note.encrypted_data, &**dek).map_err(|e| e.to_string())?;
    let mut note: Note = serde_json::from_slice(&decrypted).map_err(|e| e.to_string())?;

    // Update fields
    note.title = title;
    note.content = content;
    note.updated_at = Utc::now();

    // Serialize and encrypt
    let note_json = serde_json::to_vec(&note).map_err(|e| e.to_string())?;
    let new_encrypted_data = encrypt(&note_json, &**dek).map_err(|e| e.to_string())?;
    let encrypted_title = encrypt(note.title.as_bytes(), &**dek).map_err(|e| e.to_string())?;

    // Save to database (preserve pinned state)
    let new_encrypted_note = EncryptedNote {
        id: note.id,
        encrypted_data: new_encrypted_data,
        encrypted_title: Some(encrypted_title),
        created_at: note.created_at,
        updated_at: note.updated_at,
        pinned: encrypted_note.pinned,
        is_deleted: encrypted_note.is_deleted,
        deleted_at: encrypted_note.deleted_at,
    };

    db.save_note(&new_encrypted_note).map_err(|e| e.to_string())?;

    let tags = db.get_note_tags(&uuid).map_err(|e| e.to_string())?;
    Ok(NoteResponse::from_note_with_tags(note, tags))
}

/// Move a note to trash (soft delete)
#[tauri::command]
pub fn delete_note(state: State<'_, StateWrapper>, id: String) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    let deleted = db.soft_delete_note(&uuid).map_err(|e| e.to_string())?;

    if !deleted {
        return Err("Note not found".to_string());
    }

    Ok(true)
}

/// Restore a note from trash
#[tauri::command]
pub fn restore_note(state: State<'_, StateWrapper>, id: String) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    let restored = db.restore_note(&uuid).map_err(|e| e.to_string())?;

    if !restored {
        return Err("Note not found".to_string());
    }

    Ok(true)
}

/// Permanently delete a note
#[tauri::command]
pub fn permanent_delete_note(state: State<'_, StateWrapper>, id: String) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    let deleted = db.delete_note(&uuid).map_err(|e| e.to_string())?;

    if !deleted {
        return Err("Note not found".to_string());
    }

    Ok(true)
}

/// Empty trash (permanently delete all trashed notes)
#[tauri::command]
pub fn empty_trash(state: State<'_, StateWrapper>) -> Result<u32, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let count = db.empty_trash().map_err(|e| e.to_string())?;
    Ok(count)
}

/// Get the number of notes in trash
#[tauri::command]
pub fn get_trash_count(state: State<'_, StateWrapper>) -> Result<u32, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let count = db.get_trash_count().map_err(|e| e.to_string())?;
    Ok(count)
}

/// List all notes (metadata only, no content decryption)
/// Uses encrypted_title for fast title decryption without loading full note blobs.
/// Falls back to full decryption for pre-migration notes.
#[tauri::command]
pub fn list_notes(
    state: State<'_, StateWrapper>,
    deleted: Option<bool>,
) -> Result<Vec<NoteListItem>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let is_deleted = deleted.unwrap_or(false);
    let headers = db.list_notes_metadata(is_deleted).map_err(|e| e.to_string())?;
    let all_tags = db.get_all_note_tags(is_deleted).map_err(|e| e.to_string())?;

    let mut items = Vec::with_capacity(headers.len());
    for hdr in headers {
        let title = if let Some(ref enc_title) = hdr.encrypted_title {
            // Fast path: decrypt only the title
            match decrypt(enc_title, &**dek) {
                Ok(bytes) => String::from_utf8(bytes).unwrap_or_default(),
                Err(_) => continue,
            }
        } else {
            // Fallback for pre-migration notes: load and decrypt full blob
            match db.get_note(&hdr.id) {
                Ok(Some(enc)) => {
                    let decrypted = match decrypt(&enc.encrypted_data, &**dek) {
                        Ok(data) => data,
                        Err(_) => continue,
                    };
                    let note: Note = match serde_json::from_slice(&decrypted) {
                        Ok(note) => note,
                        Err(_) => continue,
                    };
                    note.title
                }
                _ => continue,
            }
        };

        let id_str = hdr.id.to_string();
        let tags = all_tags.get(&id_str).cloned().unwrap_or_default();

        items.push(NoteListItem {
            id: id_str,
            title,
            created_at: hdr.created_at.to_rfc3339(),
            updated_at: hdr.updated_at.to_rfc3339(),
            pinned: hdr.pinned,
            tags,
            deleted_at: hdr.deleted_at.map(|dt| dt.to_rfc3339()),
        });
    }

    Ok(items)
}

/// Search notes by content
/// Notes that fail to decrypt are skipped to ensure search remains functional
/// even if some notes are corrupted.
#[tauri::command]
pub fn search_notes(
    state: State<'_, StateWrapper>,
    query: String,
) -> Result<Vec<NoteListItem>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let encrypted_notes = db.list_notes(false).map_err(|e| e.to_string())?;
    let all_tags = db.get_all_note_tags(false).map_err(|e| e.to_string())?;

    // Split query into terms for AND search: "a b" matches notes containing both "a" and "b"
    let terms: Vec<String> = query
        .split_whitespace()
        .map(|t| t.to_lowercase())
        .collect();

    let mut items = Vec::new();
    for enc in encrypted_notes {
        // Skip notes that fail to decrypt (corrupted data)
        let decrypted = match decrypt(&enc.encrypted_data, &**dek) {
            Ok(data) => data,
            Err(_) => continue,
        };

        // Skip notes that fail to deserialize (corrupted structure)
        let note: Note = match serde_json::from_slice(&decrypted) {
            Ok(note) => note,
            Err(_) => continue,
        };

        let id_str = note.id.to_string();
        let tags = all_tags.get(&id_str).cloned().unwrap_or_default();

        // All terms must match somewhere in title, content, or tags (AND logic)
        let title_lower = note.title.to_lowercase();
        let content_lower = note.content.to_lowercase();
        let matches = terms.iter().all(|term| {
            title_lower.contains(term)
                || content_lower.contains(term)
                || tags.iter().any(|t| t.contains(term))
        });
        if matches {
            items.push(NoteListItem {
                id: id_str,
                title: note.title,
                created_at: note.created_at.to_rfc3339(),
                updated_at: note.updated_at.to_rfc3339(),
                pinned: enc.pinned,
                tags,
                deleted_at: None,
            });
        }
    }

    Ok(items)
}

/// Toggle pin state for a note
#[tauri::command]
pub fn toggle_pin_note(
    state: State<'_, StateWrapper>,
    id: String,
) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    // Get current pinned state
    let encrypted_note = db
        .get_note(&uuid)
        .map_err(|e| e.to_string())?
        .ok_or("Note not found")?;

    let new_pinned = !encrypted_note.pinned;

    db.set_note_pinned(&uuid, new_pinned)
        .map_err(|e| e.to_string())?;

    Ok(new_pinned)
}

/// Set tags for a note (full replacement)
#[tauri::command]
pub fn set_note_tags(
    state: State<'_, StateWrapper>,
    id: String,
    tags: Vec<String>,
) -> Result<Vec<String>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    // Verify note exists
    db.get_note(&uuid)
        .map_err(|e| e.to_string())?
        .ok_or("Note not found")?;

    db.set_note_tags(&uuid, &tags).map_err(|e| e.to_string())?;

    // Return the normalized tags
    let saved_tags = db.get_note_tags(&uuid).map_err(|e| e.to_string())?;
    Ok(saved_tags)
}

/// List all distinct tags
#[tauri::command]
pub fn list_all_tags(state: State<'_, StateWrapper>) -> Result<Vec<String>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let tags = db.list_all_tags().map_err(|e| e.to_string())?;
    Ok(tags)
}
