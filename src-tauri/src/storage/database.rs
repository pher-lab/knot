use rusqlite::{Connection, Result as SqlResult};
use std::fmt::Write;
use std::path::PathBuf;
use thiserror::Error;
use zeroize::Zeroizing;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Failed to get app data directory")]
    NoAppDataDir,
    #[error("Failed to create directory: {0}")]
    CreateDirFailed(String),
    #[error("Invalid encryption key")]
    InvalidKey,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open or create the database with SQLCipher encryption
    /// The DEK (Data Encryption Key) is used to encrypt the entire database file.
    pub fn open(dek: &[u8; 32]) -> Result<Self, DatabaseError> {
        let db_path = Self::get_db_path()?;
        Self::open_at_path(&db_path, dek)
    }

    /// Open or create the database at a specific path with SQLCipher encryption
    /// Used for testing with temporary directories.
    pub fn open_at_path(db_path: &PathBuf, dek: &[u8; 32]) -> Result<Self, DatabaseError> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| DatabaseError::CreateDirFailed(e.to_string()))?;
        }

        let conn = Connection::open(db_path)?;

        // Set SQLCipher encryption key (hex format)
        // Build hex string directly into Zeroizing buffer to avoid intermediate String
        let mut hex_key = Zeroizing::new(String::with_capacity(2 + 64 + 1)); // x'<64 hex chars>'
        hex_key.push_str("x'");
        for byte in dek {
            write!(hex_key, "{:02x}", byte).expect("write to String cannot fail");
        }
        hex_key.push('\'');
        conn.pragma_update(None, "key", hex_key.as_str())?;

        // Verify the key is correct by querying sqlite_master
        // SQLCipher silently accepts wrong keys but fails on actual queries
        conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
            .map_err(|_| DatabaseError::InvalidKey)?;

        // Initialize schema
        Self::init_schema(&conn)?;

        Ok(Self { conn })
    }

    /// Check if database file exists
    pub fn exists() -> Result<bool, DatabaseError> {
        let db_path = Self::get_db_path()?;
        Ok(db_path.exists())
    }

    fn get_db_path() -> Result<PathBuf, DatabaseError> {
        let app_data = dirs::data_local_dir().ok_or(DatabaseError::NoAppDataDir)?;
        Ok(app_data.join("knot").join("knot.db"))
    }

    fn init_schema(conn: &Connection) -> SqlResult<()> {
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                encrypted_data BLOB NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
            "#,
        )?;
        Ok(())
    }

    pub fn connection(&self) -> &Connection {
        &self.conn
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::keys::generate_dek;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_create_encrypted_database() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let dek = generate_dek();

        // Create database
        let db = Database::open_at_path(&db_path, &*dek).unwrap();
        drop(db);

        // File should exist
        assert!(db_path.exists());

        // File should be encrypted (not readable as plain SQLite)
        let content = fs::read(&db_path).unwrap();
        // SQLite magic bytes are "SQLite format 3\0" but encrypted DB won't have this
        assert!(!content.starts_with(b"SQLite format 3"));
    }

    #[test]
    fn test_reopen_with_correct_key() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let dek = generate_dek();

        // Create and insert data
        {
            let db = Database::open_at_path(&db_path, &*dek).unwrap();
            db.connection()
                .execute(
                    "INSERT INTO notes (id, encrypted_data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                    ("test-id", b"encrypted content".as_slice(), "2024-01-01", "2024-01-01"),
                )
                .unwrap();
        }

        // Reopen and verify data
        let db = Database::open_at_path(&db_path, &*dek).unwrap();
        let count: i64 = db
            .connection()
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_wrong_key_fails() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let dek1 = generate_dek();
        let dek2 = generate_dek();

        // Create database with first key
        {
            let _db = Database::open_at_path(&db_path, &*dek1).unwrap();
        }

        // Try to open with wrong key
        let result = Database::open_at_path(&db_path, &*dek2);
        assert!(result.is_err());
        assert!(matches!(result, Err(DatabaseError::InvalidKey)));
    }

    #[test]
    fn test_database_file_is_encrypted() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let dek = generate_dek();

        // Create database with some data
        {
            let db = Database::open_at_path(&db_path, &*dek).unwrap();
            db.connection()
                .execute(
                    "INSERT INTO notes (id, encrypted_data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                    ("unique-test-id-12345", b"secret data here".as_slice(), "2024-01-01", "2024-01-01"),
                )
                .unwrap();
        }

        // Read raw file content
        let content = fs::read(&db_path).unwrap();
        let content_str = String::from_utf8_lossy(&content);

        // Plain text should NOT be visible in encrypted file
        assert!(!content_str.contains("unique-test-id-12345"));
        assert!(!content_str.contains("secret data here"));
        assert!(!content_str.contains("notes"));
    }

    #[test]
    fn test_large_data_storage() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let dek = generate_dek();

        // Create large data (1MB)
        let large_data: Vec<u8> = (0..1_000_000).map(|i| (i % 256) as u8).collect();

        let db = Database::open_at_path(&db_path, &*dek).unwrap();
        db.connection()
            .execute(
                "INSERT INTO notes (id, encrypted_data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                ("large-note", large_data.as_slice(), "2024-01-01", "2024-01-01"),
            )
            .unwrap();

        // Retrieve and verify
        let retrieved: Vec<u8> = db
            .connection()
            .query_row(
                "SELECT encrypted_data FROM notes WHERE id = ?1",
                ["large-note"],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(large_data, retrieved);
    }

    #[test]
    fn test_multiple_notes_crud() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let dek = generate_dek();

        let db = Database::open_at_path(&db_path, &*dek).unwrap();
        let conn = db.connection();

        // Create multiple notes
        for i in 0..100 {
            conn.execute(
                "INSERT INTO notes (id, encrypted_data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                (format!("note-{}", i), format!("content-{}", i).as_bytes(), "2024-01-01", "2024-01-01"),
            )
            .unwrap();
        }

        // Verify count
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 100);

        // Update a note
        conn.execute(
            "UPDATE notes SET encrypted_data = ?1, updated_at = ?2 WHERE id = ?3",
            (b"updated content".as_slice(), "2024-01-02", "note-50"),
        )
        .unwrap();

        // Verify update
        let updated: Vec<u8> = conn
            .query_row(
                "SELECT encrypted_data FROM notes WHERE id = ?1",
                ["note-50"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(updated, b"updated content");

        // Delete a note
        conn.execute("DELETE FROM notes WHERE id = ?1", ["note-99"])
            .unwrap();

        // Verify deletion
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 99);
    }
}
