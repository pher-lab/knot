pub mod auth;
pub mod export_import;
pub mod notes;
pub mod settings;

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use zeroize::Zeroizing;

use crate::storage::Database;

/// Get the knot data directory
pub(crate) fn get_knot_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir().ok_or("No app data directory")?;
    Ok(app_data.join("knot"))
}

/// Maximum failed password attempts before lockout
pub const MAX_FAILED_ATTEMPTS: u32 = 5;
/// Lockout duration in seconds after max failed attempts
pub const LOCKOUT_DURATION_SECS: u64 = 30;

/// Global application state
pub struct AppState {
    /// Data Encryption Key (only present when unlocked)
    pub dek: Option<Zeroizing<[u8; 32]>>,
    /// Database connection (only present when unlocked)
    pub db: Option<Database>,
    /// Number of consecutive failed password attempts
    pub failed_attempts: u32,
    /// Timestamp of last failed attempt
    pub last_failed_at: Option<Instant>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            dek: None,
            db: None,
            failed_attempts: 0,
            last_failed_at: None,
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.dek.is_some() && self.db.is_some()
    }

    pub fn lock(&mut self) {
        self.dek = None;
        self.db = None;
    }

    /// Record a failed password attempt
    pub fn record_failed_attempt(&mut self) {
        self.failed_attempts += 1;
        self.last_failed_at = Some(Instant::now());
    }

    /// Reset failed attempts counter (called on successful unlock)
    pub fn reset_failed_attempts(&mut self) {
        self.failed_attempts = 0;
        self.last_failed_at = None;
    }

    /// Check if currently locked out due to too many failed attempts
    /// Returns Some(remaining_seconds) if locked out, None if not
    /// Resets failed_attempts when the lockout period has expired (M-3 fix)
    pub fn check_lockout(&mut self) -> Option<u64> {
        if self.failed_attempts >= MAX_FAILED_ATTEMPTS {
            if let Some(last_failed) = self.last_failed_at {
                let elapsed = last_failed.elapsed().as_secs();
                if elapsed < LOCKOUT_DURATION_SECS {
                    return Some(LOCKOUT_DURATION_SECS - elapsed);
                }
                // Lockout period expired — reset so user gets a fresh set of attempts
                self.reset_failed_attempts();
            }
        }
        None
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Thread-safe wrapper for app state
pub type StateWrapper = Mutex<AppState>;
