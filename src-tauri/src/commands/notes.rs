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
}

impl From<Note> for NoteResponse {
    fn from(note: Note) -> Self {
        Self {
            id: note.id.to_string(),
            title: note.title,
            content: note.content,
            created_at: note.created_at.to_rfc3339(),
            updated_at: note.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteListItem {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
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

    // Save to database
    let encrypted_note = EncryptedNote {
        id: note.id,
        encrypted_data,
        created_at: note.created_at,
        updated_at: note.updated_at,
    };

    db.save_note(&encrypted_note).map_err(|e| e.to_string())?;

    Ok(NoteResponse::from(note))
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
            Ok(Some(NoteResponse::from(note)))
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

    // Save to database
    let new_encrypted_note = EncryptedNote {
        id: note.id,
        encrypted_data: new_encrypted_data,
        created_at: note.created_at,
        updated_at: note.updated_at,
    };

    db.save_note(&new_encrypted_note).map_err(|e| e.to_string())?;

    Ok(NoteResponse::from(note))
}

/// Delete a note
#[tauri::command]
pub fn delete_note(state: State<'_, StateWrapper>, id: String) -> Result<bool, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let uuid = Uuid::parse_str(&id).map_err(|_| "Invalid note ID")?;

    let deleted = db.delete_note(&uuid).map_err(|e| e.to_string())?;

    if !deleted {
        return Err("Note not found".to_string());
    }

    Ok(true)
}

/// List all notes (metadata only)
/// Notes that fail to decrypt are skipped to ensure the list remains accessible
/// even if some notes are corrupted.
#[tauri::command]
pub fn list_notes(state: State<'_, StateWrapper>) -> Result<Vec<NoteListItem>, String> {
    let app_state = state.lock().map_err(|_| "Failed to lock state")?;

    let dek = app_state.dek.as_ref().ok_or("Vault is locked")?;
    let db = app_state.db.as_ref().ok_or("Vault is locked")?;

    let encrypted_notes = db.list_notes().map_err(|e| e.to_string())?;

    let mut items = Vec::with_capacity(encrypted_notes.len());
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

        items.push(NoteListItem {
            id: note.id.to_string(),
            title: note.title,
            created_at: note.created_at.to_rfc3339(),
            updated_at: note.updated_at.to_rfc3339(),
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

    let encrypted_notes = db.list_notes().map_err(|e| e.to_string())?;
    let query_lower = query.to_lowercase();

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

        // Search in title and content
        if note.title.to_lowercase().contains(&query_lower)
            || note.content.to_lowercase().contains(&query_lower)
        {
            items.push(NoteListItem {
                id: note.id.to_string(),
                title: note.title,
                created_at: note.created_at.to_rfc3339(),
                updated_at: note.updated_at.to_rfc3339(),
            });
        }
    }

    Ok(items)
}
