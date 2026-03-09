use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rusqlite::{params, Row};
use uuid::Uuid;

use super::database::Database;
use crate::models::{EncryptedNote, EncryptedNoteHeader};

fn row_to_encrypted_note(row: &Row<'_>) -> Result<EncryptedNote, rusqlite::Error> {
    let id_str: String = row.get(0)?;
    let encrypted_data: Vec<u8> = row.get(1)?;
    let created_at_str: String = row.get(2)?;
    let updated_at_str: String = row.get(3)?;
    let pinned: i64 = row.get(4)?;
    let encrypted_title: Option<Vec<u8>> = row.get(5)?;

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

    let is_deleted: i64 = row.get(6)?;
    let deleted_at_str: Option<String> = row.get(7)?;

    let deleted_at = deleted_at_str
        .map(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        7,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })
        })
        .transpose()?;

    Ok(EncryptedNote {
        id,
        encrypted_data,
        encrypted_title,
        created_at,
        updated_at,
        pinned: pinned != 0,
        is_deleted: is_deleted != 0,
        deleted_at,
    })
}

fn row_to_encrypted_note_header(row: &Row<'_>) -> Result<EncryptedNoteHeader, rusqlite::Error> {
    let id_str: String = row.get(0)?;
    let encrypted_title: Option<Vec<u8>> = row.get(1)?;
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

    let is_deleted: i64 = row.get(5)?;
    let deleted_at_str: Option<String> = row.get(6)?;

    let deleted_at = deleted_at_str
        .map(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        6,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })
        })
        .transpose()?;

    Ok(EncryptedNoteHeader {
        id,
        encrypted_title,
        created_at,
        updated_at,
        pinned: pinned != 0,
        is_deleted: is_deleted != 0,
        deleted_at,
    })
}

impl Database {
    pub fn save_note(&self, note: &EncryptedNote) -> Result<(), rusqlite::Error> {
        self.connection().execute(
            r#"
            INSERT INTO notes (id, encrypted_data, encrypted_title, created_at, updated_at, pinned, is_deleted, deleted_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                encrypted_data = excluded.encrypted_data,
                encrypted_title = excluded.encrypted_title,
                updated_at = excluded.updated_at
            "#,
            params![
                note.id.to_string(),
                &note.encrypted_data,
                &note.encrypted_title,
                note.created_at.to_rfc3339(),
                note.updated_at.to_rfc3339(),
                note.pinned as i64,
                note.is_deleted as i64,
                note.deleted_at.map(|dt| dt.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    pub fn get_note(&self, id: &Uuid) -> Result<Option<EncryptedNote>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, encrypted_data, created_at, updated_at, pinned, encrypted_title, is_deleted, deleted_at FROM notes WHERE id = ?1",
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
        // Fallback: explicitly delete images for cascade
        self.connection()
            .execute("DELETE FROM images WHERE note_id = ?1", params![id_str])?;
        let rows = self
            .connection()
            .execute("DELETE FROM notes WHERE id = ?1", params![id_str])?;
        Ok(rows > 0)
    }

    pub fn list_notes(&self, deleted: bool) -> Result<Vec<EncryptedNote>, rusqlite::Error> {
        let sql = if deleted {
            "SELECT id, encrypted_data, created_at, updated_at, pinned, encrypted_title, is_deleted, deleted_at FROM notes WHERE is_deleted = 1 ORDER BY deleted_at DESC"
        } else {
            "SELECT id, encrypted_data, created_at, updated_at, pinned, encrypted_title, is_deleted, deleted_at FROM notes WHERE is_deleted = 0 ORDER BY pinned DESC, updated_at DESC"
        };
        let mut stmt = self.connection().prepare(sql)?;
        let notes = stmt.query_map([], row_to_encrypted_note)?;
        notes.collect()
    }

    /// List note headers without encrypted_data (lightweight, for sidebar).
    pub fn list_notes_metadata(
        &self,
        deleted: bool,
    ) -> Result<Vec<EncryptedNoteHeader>, rusqlite::Error> {
        let sql = if deleted {
            "SELECT id, encrypted_title, created_at, updated_at, pinned, is_deleted, deleted_at FROM notes WHERE is_deleted = 1 ORDER BY deleted_at DESC"
        } else {
            "SELECT id, encrypted_title, created_at, updated_at, pinned, is_deleted, deleted_at FROM notes WHERE is_deleted = 0 ORDER BY pinned DESC, updated_at DESC"
        };
        let mut stmt = self.connection().prepare(sql)?;
        let notes = stmt.query_map([], row_to_encrypted_note_header)?;
        notes.collect()
    }

    /// Migrate existing notes to populate encrypted_title.
    /// Decrypts each note's full blob, extracts title, encrypts it separately.
    /// Idempotent: skips notes that already have encrypted_title.
    pub fn migrate_encrypted_titles(&self, dek: &[u8; 32]) -> Result<(), rusqlite::Error> {
        use crate::crypto::{decrypt, encrypt};
        use crate::models::Note;

        let count: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM notes WHERE encrypted_title IS NULL",
            [],
            |row| row.get(0),
        )?;

        if count == 0 {
            return Ok(());
        }

        let mut stmt = self.connection().prepare(
            "SELECT id, encrypted_data FROM notes WHERE encrypted_title IS NULL",
        )?;
        let rows: Vec<(String, Vec<u8>)> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let tx = self.connection().unchecked_transaction()?;
        {
            let mut update_stmt =
                tx.prepare("UPDATE notes SET encrypted_title = ?1 WHERE id = ?2")?;
            for (id, encrypted_data) in &rows {
                let decrypted = match decrypt(encrypted_data, dek) {
                    Ok(data) => data,
                    Err(_) => continue,
                };
                let note: Note = match serde_json::from_slice(&decrypted) {
                    Ok(n) => n,
                    Err(_) => continue,
                };
                let encrypted_title = match encrypt(note.title.as_bytes(), dek) {
                    Ok(et) => et,
                    Err(_) => continue,
                };
                update_stmt.execute(params![encrypted_title, id])?;
            }
        }
        tx.commit()?;

        Ok(())
    }

    pub fn soft_delete_note(&self, id: &Uuid) -> Result<bool, rusqlite::Error> {
        let now = Utc::now().to_rfc3339();
        let rows = self.connection().execute(
            "UPDATE notes SET is_deleted = 1, deleted_at = ?1, pinned = 0 WHERE id = ?2",
            params![now, id.to_string()],
        )?;
        Ok(rows > 0)
    }

    pub fn restore_note(&self, id: &Uuid) -> Result<bool, rusqlite::Error> {
        let rows = self.connection().execute(
            "UPDATE notes SET is_deleted = 0, deleted_at = NULL WHERE id = ?1",
            params![id.to_string()],
        )?;
        Ok(rows > 0)
    }

    pub fn empty_trash(&self) -> Result<u32, rusqlite::Error> {
        self.connection().execute(
            "DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE is_deleted = 1)",
            [],
        )?;
        self.connection().execute(
            "DELETE FROM images WHERE note_id IN (SELECT id FROM notes WHERE is_deleted = 1)",
            [],
        )?;
        let rows = self.connection().execute(
            "DELETE FROM notes WHERE is_deleted = 1",
            [],
        )?;
        Ok(rows as u32)
    }

    pub fn purge_old_trash(&self, older_than: &DateTime<Utc>) -> Result<u32, rusqlite::Error> {
        let cutoff = older_than.to_rfc3339();
        self.connection().execute(
            "DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE is_deleted = 1 AND deleted_at < ?1)",
            params![cutoff],
        )?;
        self.connection().execute(
            "DELETE FROM images WHERE note_id IN (SELECT id FROM notes WHERE is_deleted = 1 AND deleted_at < ?1)",
            params![cutoff],
        )?;
        let rows = self.connection().execute(
            "DELETE FROM notes WHERE is_deleted = 1 AND deleted_at < ?1",
            params![cutoff],
        )?;
        Ok(rows as u32)
    }

    pub fn get_trash_count(&self) -> Result<u32, rusqlite::Error> {
        let count: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM notes WHERE is_deleted = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(count as u32)
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

    /// Get tags for notes as a HashMap<note_id_string, Vec<tag_name>>.
    /// Filters by is_deleted status to match the current view.
    pub fn get_all_note_tags(
        &self,
        deleted: bool,
    ) -> Result<HashMap<String, Vec<String>>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT nt.note_id, nt.tag_name FROM note_tags nt \
             INNER JOIN notes n ON nt.note_id = n.id \
             WHERE n.is_deleted = ?1 \
             ORDER BY nt.tag_name",
        )?;
        let rows = stmt.query_map(params![deleted as i64], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        for row in rows {
            let (note_id, tag_name) = row?;
            map.entry(note_id).or_default().push(tag_name);
        }
        Ok(map)
    }

    /// List all distinct tag names for non-deleted notes, sorted alphabetically.
    pub fn list_all_tags(&self) -> Result<Vec<String>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT DISTINCT nt.tag_name FROM note_tags nt \
             INNER JOIN notes n ON nt.note_id = n.id \
             WHERE n.is_deleted = 0 \
             ORDER BY nt.tag_name",
        )?;
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
            encrypted_title: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pinned: false,
            is_deleted: false,
            deleted_at: None,
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
        let map = db.get_all_note_tags(false).unwrap();
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

    #[test]
    fn test_list_notes_metadata() {
        let db = setup_db();
        let id = Uuid::new_v4();
        let enc_title = Some(vec![1u8, 2, 3]);
        let note = EncryptedNote {
            id,
            encrypted_data: vec![0u8; 16],
            encrypted_title: enc_title.clone(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pinned: false,
            is_deleted: false,
            deleted_at: None,
        };
        db.save_note(&note).unwrap();

        let headers = db.list_notes_metadata(false).unwrap();
        assert_eq!(headers.len(), 1);
        assert_eq!(headers[0].id, id);
        assert_eq!(headers[0].encrypted_title, enc_title);
    }

    #[test]
    fn test_save_and_read_encrypted_title() {
        let db = setup_db();
        let id = Uuid::new_v4();
        let title_data = vec![10u8, 20, 30, 40];
        let note = EncryptedNote {
            id,
            encrypted_data: vec![0u8; 16],
            encrypted_title: Some(title_data.clone()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pinned: false,
            is_deleted: false,
            deleted_at: None,
        };
        db.save_note(&note).unwrap();

        let loaded = db.get_note(&id).unwrap().unwrap();
        assert_eq!(loaded.encrypted_title, Some(title_data));
    }

    #[test]
    fn test_migrate_encrypted_titles() {
        use crate::crypto::{decrypt, encrypt};

        let dir = tempdir().unwrap();
        let db_path = dir.into_path().join("test.db");
        let dek = generate_dek();
        let db = Database::open_at_path(&db_path, &*dek).unwrap();

        // Create a note without encrypted_title (simulating pre-migration)
        let id = Uuid::new_v4();
        let note = crate::models::Note::new("Test Title".into(), "Test Content".into());
        let note_json = serde_json::to_vec(&crate::models::Note {
            id,
            title: "Test Title".into(),
            content: "Test Content".into(),
            created_at: note.created_at,
            updated_at: note.updated_at,
        })
        .unwrap();
        let encrypted_data = encrypt(&note_json, &*dek).unwrap();

        let enc_note = EncryptedNote {
            id,
            encrypted_data,
            encrypted_title: None,
            created_at: note.created_at,
            updated_at: note.updated_at,
            pinned: false,
            is_deleted: false,
            deleted_at: None,
        };
        db.save_note(&enc_note).unwrap();

        // Run migration
        db.migrate_encrypted_titles(&*dek).unwrap();

        // Verify encrypted_title is now populated
        let loaded = db.get_note(&id).unwrap().unwrap();
        assert!(loaded.encrypted_title.is_some());

        let decrypted_title = decrypt(&loaded.encrypted_title.unwrap(), &*dek).unwrap();
        assert_eq!(String::from_utf8(decrypted_title).unwrap(), "Test Title");

        // Running migration again should be a no-op
        db.migrate_encrypted_titles(&*dek).unwrap();
    }

    #[test]
    fn test_soft_delete_and_restore() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);

        // Soft delete
        assert!(db.soft_delete_note(&id).unwrap());

        // Should not appear in normal list
        assert!(db.list_notes_metadata(false).unwrap().is_empty());

        // Should appear in trash list
        let trash = db.list_notes_metadata(true).unwrap();
        assert_eq!(trash.len(), 1);
        assert!(trash[0].is_deleted);
        assert!(trash[0].deleted_at.is_some());

        // Restore
        assert!(db.restore_note(&id).unwrap());

        // Should appear in normal list again
        assert_eq!(db.list_notes_metadata(false).unwrap().len(), 1);
        assert!(db.list_notes_metadata(true).unwrap().is_empty());
    }

    #[test]
    fn test_soft_delete_unpins() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);
        db.set_note_pinned(&id, true).unwrap();

        db.soft_delete_note(&id).unwrap();
        let note = db.get_note(&id).unwrap().unwrap();
        assert!(!note.pinned);
    }

    #[test]
    fn test_empty_trash() {
        let db = setup_db();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let id3 = Uuid::new_v4();
        create_test_note(&db, &id1);
        create_test_note(&db, &id2);
        create_test_note(&db, &id3);

        db.soft_delete_note(&id1).unwrap();
        db.soft_delete_note(&id2).unwrap();

        let count = db.empty_trash().unwrap();
        assert_eq!(count, 2);

        // id3 should still exist
        assert_eq!(db.list_notes_metadata(false).unwrap().len(), 1);
        assert!(db.list_notes_metadata(true).unwrap().is_empty());
    }

    #[test]
    fn test_get_trash_count() {
        let db = setup_db();
        assert_eq!(db.get_trash_count().unwrap(), 0);

        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        create_test_note(&db, &id1);
        create_test_note(&db, &id2);

        db.soft_delete_note(&id1).unwrap();
        assert_eq!(db.get_trash_count().unwrap(), 1);

        db.soft_delete_note(&id2).unwrap();
        assert_eq!(db.get_trash_count().unwrap(), 2);
    }

    #[test]
    fn test_purge_old_trash() {
        let db = setup_db();
        let id = Uuid::new_v4();
        create_test_note(&db, &id);
        db.soft_delete_note(&id).unwrap();

        // Purge with future cutoff should remove the note
        let future = Utc::now() + chrono::Duration::days(31);
        let purged = db.purge_old_trash(&future).unwrap();
        assert_eq!(purged, 1);
        assert_eq!(db.get_trash_count().unwrap(), 0);
    }

    #[test]
    fn test_tags_excluded_for_deleted_notes() {
        let db = setup_db();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        create_test_note(&db, &id1);
        create_test_note(&db, &id2);

        db.set_note_tags(&id1, &["visible".into()]).unwrap();
        db.set_note_tags(&id2, &["hidden".into()]).unwrap();
        db.soft_delete_note(&id2).unwrap();

        let all_tags = db.list_all_tags().unwrap();
        assert_eq!(all_tags, vec!["visible"]);

        let tag_map = db.get_all_note_tags(false).unwrap();
        assert!(tag_map.contains_key(&id1.to_string()));
        assert!(!tag_map.contains_key(&id2.to_string()));
    }
}
