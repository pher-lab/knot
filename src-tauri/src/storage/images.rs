use chrono::{DateTime, Utc};
use rusqlite::params;
use uuid::Uuid;

use super::database::Database;
use crate::models::{EncryptedImage, ImageMetadata};

impl Database {
    /// Save an encrypted image to the database
    pub fn save_image(
        &self,
        id: &Uuid,
        note_id: &Uuid,
        encrypted_data: &[u8],
        mime_type: &str,
        size_bytes: i64,
        created_at: &DateTime<Utc>,
    ) -> Result<(), rusqlite::Error> {
        self.connection().execute(
            "INSERT INTO images (id, note_id, encrypted_data, mime_type, size_bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id.to_string(),
                note_id.to_string(),
                encrypted_data,
                mime_type,
                size_bytes,
                created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    /// Get an encrypted image by ID (for protocol handler)
    pub fn get_image(&self, id: &Uuid) -> Result<Option<EncryptedImage>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, note_id, encrypted_data, mime_type, size_bytes, created_at FROM images WHERE id = ?1",
        )?;

        let result = stmt.query_row(params![id.to_string()], |row| {
            let id_str: String = row.get(0)?;
            let note_id_str: String = row.get(1)?;
            let encrypted_data: Vec<u8> = row.get(2)?;
            let mime_type: String = row.get(3)?;
            let size_bytes: i64 = row.get(4)?;
            let created_at_str: String = row.get(5)?;

            let id = Uuid::parse_str(&id_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
            let note_id = Uuid::parse_str(&note_id_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    1,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
            let created_at = DateTime::parse_from_rfc3339(&created_at_str)
                .map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        5,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?
                .with_timezone(&Utc);

            Ok(EncryptedImage {
                id,
                note_id,
                encrypted_data,
                mime_type,
                size_bytes,
                created_at,
            })
        });

        match result {
            Ok(img) => Ok(Some(img)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// List image metadata for a note (without encrypted_data)
    pub fn list_images_for_note(
        &self,
        note_id: &Uuid,
    ) -> Result<Vec<ImageMetadata>, rusqlite::Error> {
        let mut stmt = self.connection().prepare(
            "SELECT id, note_id, mime_type, size_bytes, created_at FROM images WHERE note_id = ?1 ORDER BY created_at",
        )?;

        let rows = stmt.query_map(params![note_id.to_string()], |row| {
            let id_str: String = row.get(0)?;
            let note_id_str: String = row.get(1)?;
            let mime_type: String = row.get(2)?;
            let size_bytes: i64 = row.get(3)?;
            let created_at_str: String = row.get(4)?;

            let id = Uuid::parse_str(&id_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
            let note_id = Uuid::parse_str(&note_id_str).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    1,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
            let created_at = DateTime::parse_from_rfc3339(&created_at_str)
                .map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        4,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?
                .with_timezone(&Utc);

            Ok(ImageMetadata {
                id,
                note_id,
                mime_type,
                size_bytes,
                created_at,
            })
        })?;

        rows.collect()
    }

    /// Delete a single image by ID
    pub fn delete_image(&self, id: &Uuid) -> Result<bool, rusqlite::Error> {
        let rows = self
            .connection()
            .execute("DELETE FROM images WHERE id = ?1", params![id.to_string()])?;
        Ok(rows > 0)
    }

    /// Delete all images for a note (cascade delete fallback)
    pub fn delete_images_for_note(&self, note_id: &Uuid) -> Result<(), rusqlite::Error> {
        self.connection().execute(
            "DELETE FROM images WHERE note_id = ?1",
            params![note_id.to_string()],
        )?;
        Ok(())
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

    fn create_test_note(db: &Database) -> Uuid {
        let id = Uuid::new_v4();
        let note = EncryptedNote {
            id,
            encrypted_data: vec![0u8; 16],
            encrypted_title: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pinned: false,
            is_deleted: false,
            deleted_at: None,
        };
        db.save_note(&note).unwrap();
        id
    }

    #[test]
    fn test_save_and_get_image() {
        let db = setup_db();
        let note_id = create_test_note(&db);
        let image_id = Uuid::new_v4();
        let data = vec![1u8, 2, 3, 4, 5];
        let now = Utc::now();

        db.save_image(&image_id, &note_id, &data, "image/png", 5, &now)
            .unwrap();

        let img = db.get_image(&image_id).unwrap().unwrap();
        assert_eq!(img.id, image_id);
        assert_eq!(img.note_id, note_id);
        assert_eq!(img.encrypted_data, data);
        assert_eq!(img.mime_type, "image/png");
        assert_eq!(img.size_bytes, 5);
    }

    #[test]
    fn test_get_nonexistent_image() {
        let db = setup_db();
        let result = db.get_image(&Uuid::new_v4()).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_list_images_for_note() {
        let db = setup_db();
        let note_id = create_test_note(&db);
        let now = Utc::now();

        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        db.save_image(&id1, &note_id, &[1, 2, 3], "image/png", 3, &now)
            .unwrap();
        db.save_image(&id2, &note_id, &[4, 5, 6], "image/jpeg", 3, &now)
            .unwrap();

        let images = db.list_images_for_note(&note_id).unwrap();
        assert_eq!(images.len(), 2);
    }

    #[test]
    fn test_delete_image() {
        let db = setup_db();
        let note_id = create_test_note(&db);
        let image_id = Uuid::new_v4();
        let now = Utc::now();

        db.save_image(&image_id, &note_id, &[1, 2, 3], "image/png", 3, &now)
            .unwrap();
        assert!(db.delete_image(&image_id).unwrap());
        assert!(db.get_image(&image_id).unwrap().is_none());
    }

    #[test]
    fn test_delete_nonexistent_image() {
        let db = setup_db();
        assert!(!db.delete_image(&Uuid::new_v4()).unwrap());
    }

    #[test]
    fn test_delete_images_for_note() {
        let db = setup_db();
        let note_id = create_test_note(&db);
        let now = Utc::now();

        db.save_image(&Uuid::new_v4(), &note_id, &[1], "image/png", 1, &now)
            .unwrap();
        db.save_image(&Uuid::new_v4(), &note_id, &[2], "image/jpeg", 1, &now)
            .unwrap();

        db.delete_images_for_note(&note_id).unwrap();
        let images = db.list_images_for_note(&note_id).unwrap();
        assert!(images.is_empty());
    }

    #[test]
    fn test_cascade_delete_with_note() {
        let db = setup_db();
        let note_id = create_test_note(&db);
        let image_id = Uuid::new_v4();
        let now = Utc::now();

        db.save_image(&image_id, &note_id, &[1, 2, 3], "image/png", 3, &now)
            .unwrap();

        // Delete note (which should cascade to images via foreign key + explicit delete)
        db.delete_images_for_note(&note_id).unwrap();
        db.delete_note(&note_id).unwrap();

        assert!(db.get_image(&image_id).unwrap().is_none());
    }

    #[test]
    fn test_large_image_data() {
        let db = setup_db();
        let note_id = create_test_note(&db);
        let image_id = Uuid::new_v4();
        let now = Utc::now();

        // 1MB of data
        let data: Vec<u8> = (0..1_000_000).map(|i| (i % 256) as u8).collect();
        let size = data.len() as i64;

        db.save_image(&image_id, &note_id, &data, "image/png", size, &now)
            .unwrap();

        let img = db.get_image(&image_id).unwrap().unwrap();
        assert_eq!(img.encrypted_data, data);
        assert_eq!(img.size_bytes, size);
    }
}
