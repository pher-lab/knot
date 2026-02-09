use chrono::{DateTime, Utc};
use rusqlite::{params, Row};
use uuid::Uuid;

use super::database::Database;
use crate::models::EncryptedNote;

fn row_to_encrypted_note(row: &Row<'_>) -> Result<EncryptedNote, rusqlite::Error> {
    let id_str: String = row.get(0)?;
    let encrypted_data: Vec<u8> = row.get(1)?;
    let created_at_str: String = row.get(2)?;
    let updated_at_str: String = row.get(3)?;

    let id = Uuid::parse_str(&id_str).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })?;

    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Text, Box::new(e))
        })?
        .with_timezone(&Utc);

    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(e))
        })?
        .with_timezone(&Utc);

    Ok(EncryptedNote {
        id,
        encrypted_data,
        created_at,
        updated_at,
    })
}

impl Database {
    pub fn save_note(&self, note: &EncryptedNote) -> Result<(), rusqlite::Error> {
        self.connection().execute(
            r#"
            INSERT INTO notes (id, encrypted_data, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(id) DO UPDATE SET
                encrypted_data = excluded.encrypted_data,
                updated_at = excluded.updated_at
            "#,
            params![
                note.id.to_string(),
                &note.encrypted_data,
                note.created_at.to_rfc3339(),
                note.updated_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn get_note(&self, id: &Uuid) -> Result<Option<EncryptedNote>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, encrypted_data, created_at, updated_at FROM notes WHERE id = ?1",
        )?;

        let note = stmt.query_row(params![id.to_string()], row_to_encrypted_note);

        match note {
            Ok(n) => Ok(Some(n)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_note(&self, id: &Uuid) -> Result<bool, rusqlite::Error> {
        let rows = self
            .connection()
            .execute("DELETE FROM notes WHERE id = ?1", params![id.to_string()])?;
        Ok(rows > 0)
    }

    pub fn list_notes(&self) -> Result<Vec<EncryptedNote>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, encrypted_data, created_at, updated_at FROM notes ORDER BY updated_at DESC",
        )?;

        let notes = stmt.query_map([], row_to_encrypted_note)?;

        notes.collect()
    }
}
