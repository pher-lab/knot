use serde::{Deserialize, Serialize};
use tauri::State;
use zeroize::Zeroizing;

use super::StateWrapper;
use crate::crypto::{
    decrypt, derive_key, encrypt, generate_dek, generate_recovery_key, generate_salt,
    recovery_key_to_kek,
};
use crate::storage::Database;

use super::get_knot_dir;

/// Minimum password length (matches frontend validation)
const MIN_PASSWORD_LENGTH: usize = 8;

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupResult {
    pub success: bool,
    pub recovery_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResult {
    pub success: bool,
    pub error: Option<String>,
    /// Remaining lockout seconds (only present when locked out)
    pub lockout_seconds: Option<u64>,
}

/// Check if a vault already exists
#[tauri::command]
pub fn check_vault_exists() -> Result<bool, String> {
    let knot_dir = get_knot_dir()?;
    let salt_path = knot_dir.join("salt.bin");
    let dek_path = knot_dir.join("dek.enc");
    let db_path = knot_dir.join("knot.db");

    Ok(salt_path.exists() && dek_path.exists() && db_path.exists())
}

/// Set up a new vault with password
#[tauri::command]
pub fn setup_vault(
    state: State<'_, StateWrapper>,
    password: String,
    create_recovery_key: bool,
) -> Result<SetupResult, String> {
    // Validate password length
    if password.len() < MIN_PASSWORD_LENGTH {
        return Err(format!(
            "Password must be at least {} characters",
            MIN_PASSWORD_LENGTH
        ));
    }

    let knot_dir = get_knot_dir()?;

    // Prevent overwriting an existing vault (H-2: backend guard against data loss)
    let salt_path = knot_dir.join("salt.bin");
    let dek_path = knot_dir.join("dek.enc");
    let db_path = knot_dir.join("knot.db");
    if salt_path.exists() || dek_path.exists() || db_path.exists() {
        return Err("Vault already exists".to_string());
    }

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&knot_dir).map_err(|e| e.to_string())?;

    // Generate salt and derive master key
    let salt = generate_salt();
    let master_key = derive_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;

    // Generate DEK
    let dek = generate_dek();

    // Encrypt DEK with master key
    let encrypted_dek = encrypt(&*dek, &*master_key).map_err(|e| e.to_string())?;

    // Save salt and encrypted DEK to files
    std::fs::write(knot_dir.join("salt.bin"), &salt).map_err(|e| e.to_string())?;
    std::fs::write(knot_dir.join("dek.enc"), &encrypted_dek).map_err(|e| e.to_string())?;

    // Optionally create recovery key
    let recovery_key = if create_recovery_key {
        let mnemonic = generate_recovery_key().map_err(|e| e.to_string())?;
        let recovery_kek = recovery_key_to_kek(&mnemonic).map_err(|e| e.to_string())?;
        let recovery_encrypted_dek = encrypt(&*dek, &*recovery_kek).map_err(|e| e.to_string())?;

        // Save recovery-encrypted DEK
        std::fs::write(knot_dir.join("recovery_dek.enc"), &recovery_encrypted_dek)
            .map_err(|e| e.to_string())?;

        Some(mnemonic)
    } else {
        None
    };

    // Open database with SQLCipher encryption (this creates the db file)
    let db = Database::open(&dek).map_err(|e| e.to_string())?;

    // Store unlocked state
    let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
    app_state.dek = Some(dek);
    app_state.db = Some(db);

    Ok(SetupResult {
        success: true,
        recovery_key,
    })
}

/// Unlock the vault with password
#[tauri::command]
pub fn unlock_vault(
    state: State<'_, StateWrapper>,
    password: String,
) -> Result<AuthResult, String> {
    // Check for lockout first (short lock)
    {
        let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
        if let Some(remaining_secs) = app_state.check_lockout() {
            return Ok(AuthResult {
                success: false,
                error: Some("Too many failed attempts".to_string()),
                lockout_seconds: Some(remaining_secs),
            });
        }
    }

    let knot_dir = get_knot_dir()?;

    // Check if vault exists
    if !knot_dir.join("knot.db").exists() {
        return Ok(AuthResult {
            success: false,
            error: Some("Vault does not exist".to_string()),
            lockout_seconds: None,
        });
    }

    // Read salt
    let salt_bytes = std::fs::read(knot_dir.join("salt.bin")).map_err(|_| "Failed to read salt")?;

    if salt_bytes.len() != 32 {
        return Ok(AuthResult {
            success: false,
            error: Some("Invalid salt".to_string()),
            lockout_seconds: None,
        });
    }

    let mut salt = [0u8; 32];
    salt.copy_from_slice(&salt_bytes);

    // Derive master key from password
    let master_key = derive_key(password.as_bytes(), &salt).map_err(|e| e.to_string())?;

    // Read encrypted DEK with size validation
    // Expected size: 1 (version) + 24 (nonce) + 32 (ciphertext) + 16 (tag) = 73 bytes
    let encrypted_dek =
        std::fs::read(knot_dir.join("dek.enc")).map_err(|_| "Failed to read encrypted DEK")?;

    if encrypted_dek.len() > 256 {
        return Ok(AuthResult {
            success: false,
            error: Some("Invalid vault data".to_string()),
            lockout_seconds: None,
        });
    }

    // Decrypt DEK (wrap in Zeroizing immediately to ensure cleanup)
    let dek_bytes: Zeroizing<Vec<u8>> = match decrypt(&encrypted_dek, &*master_key) {
        Ok(bytes) => Zeroizing::new(bytes),
        Err(_) => {
            // Record failed attempt
            let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
            app_state.record_failed_attempt();

            let (error_msg, lockout_secs) = if app_state.failed_attempts >= super::MAX_FAILED_ATTEMPTS
            {
                (
                    "Invalid password".to_string(),
                    Some(super::LOCKOUT_DURATION_SECS),
                )
            } else {
                let remaining = super::MAX_FAILED_ATTEMPTS - app_state.failed_attempts;
                (
                    format!("Invalid password. {} attempts remaining.", remaining),
                    None,
                )
            };

            return Ok(AuthResult {
                success: false,
                error: Some(error_msg),
                lockout_seconds: lockout_secs,
            });
        }
    };

    if dek_bytes.len() != 32 {
        return Ok(AuthResult {
            success: false,
            error: Some("Invalid DEK".to_string()),
            lockout_seconds: None,
        });
    }

    let mut dek = Zeroizing::new([0u8; 32]);
    dek.copy_from_slice(&dek_bytes);

    // Open database with SQLCipher encryption
    let db = Database::open(&dek).map_err(|e| e.to_string())?;

    // Store unlocked state and reset failed attempts
    let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
    app_state.dek = Some(dek);
    app_state.db = Some(db);
    app_state.reset_failed_attempts();

    Ok(AuthResult {
        success: true,
        error: None,
        lockout_seconds: None,
    })
}

/// Lock the vault
#[tauri::command]
pub fn lock_vault(state: State<'_, StateWrapper>) -> Result<bool, String> {
    let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
    app_state.lock();
    Ok(true)
}

/// Recover vault with recovery key
#[tauri::command]
pub fn recover_vault(
    state: State<'_, StateWrapper>,
    mnemonic: String,
    new_password: String,
) -> Result<AuthResult, String> {
    // Check for lockout first (H-1: rate limit recovery attempts)
    {
        let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
        if let Some(remaining_secs) = app_state.check_lockout() {
            return Ok(AuthResult {
                success: false,
                error: Some("Too many failed attempts".to_string()),
                lockout_seconds: Some(remaining_secs),
            });
        }
    }

    // Validate new password length
    if new_password.len() < MIN_PASSWORD_LENGTH {
        return Ok(AuthResult {
            success: false,
            error: Some(format!(
                "Password must be at least {} characters",
                MIN_PASSWORD_LENGTH
            )),
            lockout_seconds: None,
        });
    }

    let knot_dir = get_knot_dir()?;

    // Read recovery-encrypted DEK with size validation
    let encrypted_dek = match std::fs::read(knot_dir.join("recovery_dek.enc")) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Ok(AuthResult {
                success: false,
                error: Some("Recovery key not set up".to_string()),
                lockout_seconds: None,
            });
        }
    };

    if encrypted_dek.len() > 256 {
        return Ok(AuthResult {
            success: false,
            error: Some("Invalid recovery data".to_string()),
            lockout_seconds: None,
        });
    }

    // Derive KEK from mnemonic
    let recovery_kek = recovery_key_to_kek(&mnemonic).map_err(|e| e.to_string())?;

    // Decrypt DEK (wrap in Zeroizing immediately to ensure cleanup)
    let dek_bytes: Zeroizing<Vec<u8>> = match decrypt(&encrypted_dek, &*recovery_kek) {
        Ok(bytes) => Zeroizing::new(bytes),
        Err(_) => {
            // Record failed recovery attempt (H-1: rate limit)
            let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
            app_state.record_failed_attempt();

            let (error_msg, lockout_secs) = if app_state.failed_attempts >= super::MAX_FAILED_ATTEMPTS
            {
                (
                    "Invalid recovery key".to_string(),
                    Some(super::LOCKOUT_DURATION_SECS),
                )
            } else {
                let remaining = super::MAX_FAILED_ATTEMPTS - app_state.failed_attempts;
                (
                    format!("Invalid recovery key. {} attempts remaining.", remaining),
                    None,
                )
            };

            return Ok(AuthResult {
                success: false,
                error: Some(error_msg),
                lockout_seconds: lockout_secs,
            });
        }
    };

    if dek_bytes.len() != 32 {
        return Ok(AuthResult {
            success: false,
            error: Some("Invalid DEK".to_string()),
            lockout_seconds: None,
        });
    }

    let mut dek = Zeroizing::new([0u8; 32]);
    dek.copy_from_slice(&dek_bytes);

    // Generate new salt and encrypt DEK with new password
    let new_salt = generate_salt();
    let new_master_key =
        derive_key(new_password.as_bytes(), &new_salt).map_err(|e| e.to_string())?;
    let new_encrypted_dek = encrypt(&*dek, &*new_master_key).map_err(|e| e.to_string())?;

    // Save new salt and encrypted DEK
    std::fs::write(knot_dir.join("salt.bin"), &new_salt).map_err(|e| e.to_string())?;
    std::fs::write(knot_dir.join("dek.enc"), &new_encrypted_dek).map_err(|e| e.to_string())?;

    // Open database with SQLCipher encryption
    let db = Database::open(&dek).map_err(|e| e.to_string())?;

    // Store unlocked state and reset failed attempts
    let mut app_state = state.lock().map_err(|_| "Failed to lock state")?;
    app_state.dek = Some(dek);
    app_state.db = Some(db);
    app_state.reset_failed_attempts();

    Ok(AuthResult {
        success: true,
        error: None,
        lockout_seconds: None,
    })
}
