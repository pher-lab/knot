use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Vault configuration stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    /// Salt for password-based key derivation
    pub salt: [u8; 32],
    /// DEK encrypted with master key (derived from password)
    pub encrypted_dek: Vec<u8>,
    /// DEK encrypted with recovery key (optional)
    pub recovery_key_encrypted_dek: Option<Vec<u8>>,
    /// When the vault was created
    pub created_at: DateTime<Utc>,
}

impl Vault {
    pub fn new(salt: [u8; 32], encrypted_dek: Vec<u8>) -> Self {
        Self {
            salt,
            encrypted_dek,
            recovery_key_encrypted_dek: None,
            created_at: Utc::now(),
        }
    }

    pub fn with_recovery_key(mut self, recovery_encrypted_dek: Vec<u8>) -> Self {
        self.recovery_key_encrypted_dek = Some(recovery_encrypted_dek);
        self
    }
}
