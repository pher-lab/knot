use std::collections::HashMap;

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
    let pinned: i64 = row.get(4)?;

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
        pinned: pinned != 0,
    })
}

impl Database {
    pub fn save_note(&self, note: &EncryptedNote) -> Result<(), rusqlite::Error> {
        self.connection().execute(
            r#"
            INSERT INTO notes (id, encrypted_data, created_at, updated_at, pinned)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET
                encrypted_data = excluded.encrypted_data,
                updated_at = excluded.updated_at
            "#,
            params![
                note.id.to_string(),
                &note.encrypted_data,
                note.created_at.to_rfc3339(),
                note.updated_at.to_rfc3339(),
                note.pinned as i64,
            ],
        )?;
        Ok(())
    }

    pub fn get_note(&self, id: &Uuid) -> Result<Option<EncryptedNote>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, encrypted_data, created_at, updated_at, pinned FROM notes WHERE id = ?1",
        )?;

        let note = stmt.query_row(params![id.to_string()], row_to_encrypted_note);

        match note {
            Ok(n) => Ok(Some(n)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_note(&self, id: &Uuid) -> Result<bool, rusqlite::Error> {
        let id_str = id.to_string();
        // Fallback: explicitly delete tags in case foreign_keys is not enabled
        self.connection()
            .execute("DELETE FROM note_tags WHERE note_id = ?1", params![id_str])?;
        let rows = self
            .connection()
            .execute("DELETE FROM notes WHERE id = ?1", params![id_str])?;
        Ok(rows > 0)
    }

    pub fn list_notes(&self) -> Result<Vec<EncryptedNote>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, encrypted_data, created_at, updated_at, pinned FROM notes ORDER BY pinned DESC, updated_at DESC",
        )?;

        let notes = stmt.query_map([], row_to_encrypted_note)?;

        notes.collect()
    }

    pub fn set_note_pinned(&self, id: &Uuid, pinned: bool) -> Result<bool, rusqlite::Error> {
        let rows = self.connection().execute(
            "UPDATE notes SET pinned = ?1 WHERE id = ?2",
            params![pinned as i64, id.to_string()],
        )?;
        Ok(rows > 0)
    }

    /// Set tags for a note (full replacement). Normalizes: lowercase, trim, skip empty.
    /// Wrapped in a transaction for atomicity.
    pub fn set_note_tags(&self, id: &Uuid, tags: &[String]) -> Result<(), rusqlite::Error> {
        let id_str = id.to_string();
        let conn = self.connection();
        let tx = conn.unchecked_transaction()?;
        tx.execute("DELETE FROM note_tags WHERE note_id = ?1", params![id_str])?;
        {
            let mut stmt = tx
                .prepare("INSERT OR IGNORE INTO note_tags (note_id, tag_name) VALUES (?1, ?2)")?;
            for tag in tags {
                let normalized = tag.trim().to_lowercase();
                if !normalized.is_empty() {
                    stmt.execute(params![id_str, normalized])?;
                }
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Get tags for a single note, sorted alphabetically.
    pub fn get_note_tags(&self, id: &Uuid) -> Result<Vec<String>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT tag_name FROM note_tags WHERE note_id = ?1 ORDER BY tag_name",
        )?;
        let tags = stmt
            .query_map(params![id.to_string()], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }

    /// Get tags for all notes as a HashMap<note_id_string, Vec<tag_name>>.
    pub fn get_all_note_tags(&self) -> Result<HashMap<String, Vec<String>>, rusqlite::Error> {
        let mut stmt = self
            .connection()
            .prepare("SELECT note_id, tag_name FROM note_tags ORDER BY tag_name")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        for row in rows {
            let (note_id, tag_name) = row?;
            map.entry(note_id).or_default().push(tag_name);
        }
        Ok(map)
    }

    /// List all distinct tag names, sorted alphabetically.
    pub fn list_all_tags(&self) -> Result<Vec<String>, rusqlite::Error> {
        let mut stmt = self
            .connection()
            .prepare("SELECT DISTINCT tag_name FROM note_tags ORDER BY tag_name")?;
        let tags = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tags)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::keys::generate_dek;
    use crate::models::EncryptedNote;
    use chrono::Utc;
    use tempfile::tempdir;

    fn setup_db() -> Database {
        let dir = tempdir().unwrap();
        let db_path = dir.into_path().join("test.db");
        let dek = generate_dek();
        Database::open_at_path(&db_path, &*dek).unwrap()
    }

    fn create_test_note(db: &Database, id: &Uuid) {
        let note = EncryptedNote {
            id: *id,
            encrypted_data: vec![0u8; 16],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pinned: false,
        };
        db.save_note(&note).unwrap();
    }

    #[test]
    fn test_set_and_get_tags() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);

        db.set_note_tags(&id, &["beta".into(), "alpha".into(), "gamma".into()])
            .unwrap();
        let tags = db.get_note_tags(&id).unwrap();
        assert_eq!(tags, vec!["alpha", "beta", "gamma"]);
    }

    #[test]
    fn test_set_tags_replaces() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);

        db.set_note_tags(&id, &["old".into()]).unwrap();
        db.set_note_tags(&id, &["new1".into(), "new2".into()])
            .unwrap();
        let tags = db.get_note_tags(&id).unwrap();
        assert_eq!(tags, vec!["new1", "new2"]);
    }

    #[test]
    fn test_empty_tags_clears() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);

        db.set_note_tags(&id, &["tag1".into()]).unwrap();
        db.set_note_tags(&id, &[]).unwrap();
        let tags = db.get_note_tags(&id).unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn test_tags_normalized() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);

        db.set_note_tags(&id, &["  Hello  ".into(), "WORLD".into(), "  ".into()])
            .unwrap();
        let tags = db.get_note_tags(&id).unwrap();
        assert_eq!(tags, vec!["hello", "world"]);
    }

    #[test]
    fn test_list_all_tags() {
        let db = setup_db();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        create_test_note(&db, &id1);
        create_test_note(&db, &id2);

        db.set_note_tags(&id1, &["shared".into(), "alpha".into()])
            .unwrap();
        db.set_note_tags(&id2, &["shared".into(), "beta".into()])
            .unwrap();
        let all_tags = db.list_all_tags().unwrap();
        assert_eq!(all_tags, vec!["alpha", "beta", "shared"]);
    }

    #[test]
    fn test_get_all_note_tags() {
        let db = setup_db();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        create_test_note(&db, &id1);
        create_test_note(&db, &id2);

        db.set_note_tags(&id1, &["a".into(), "b".into()]).unwrap();
        db.set_note_tags(&id2, &["c".into()]).unwrap();
        let map = db.get_all_note_tags().unwrap();
        assert_eq!(map.get(&id1.to_string()).unwrap(), &vec!["a", "b"]);
        assert_eq!(map.get(&id2.to_string()).unwrap(), &vec!["c"]);
    }

    #[test]
    fn test_tags_deleted_with_note() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);

        db.set_note_tags(&id, &["tag1".into(), "tag2".into()])
            .unwrap();
        db.delete_note(&id).unwrap();
        let tags = db.get_note_tags(&id).unwrap();
        assert!(tags.is_empty());
        let all_tags = db.list_all_tags().unwrap();
        assert!(all_tags.is_empty());
    }
}
