use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Encrypted image stored in the database
#[derive(Debug, Clone)]
pub struct EncryptedImage {
    pub id: Uuid,
    pub note_id: Uuid,
    pub encrypted_data: Vec<u8>,
    pub mime_type: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}

/// Lightweight image metadata (no encrypted_data blob)
#[derive(Debug, Clone)]
pub struct ImageMetadata {
    pub id: Uuid,
    pub note_id: Uuid,
    pub mime_type: String,
    pub size_bytes: i64,
    pub created_at: DateTime<Utc>,
}
