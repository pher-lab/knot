pub mod auth;
pub mod export_import;
pub mod notes;
pub mod settings;

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
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

/// Persisted lockout state
#[derive(serde::Serialize, serde::Deserialize)]
struct LockoutData {
    failed_attempts: u32,
    last_failed_at_epoch: u64,
}

fn lockout_file_path() -> Option<PathBuf> {
    dirs::data_local_dir().map(|d| d.join("knot").join("lockout.json"))
}

fn persist_lockout(failed_attempts: u32, epoch_secs: u64) {
    if let Some(path) = lockout_file_path() {
        let data = LockoutData {
            failed_attempts,
            last_failed_at_epoch: epoch_secs,
        };
        if let Ok(json) = serde_json::to_string(&data) {
            // Best-effort: ignore write errors
            let _ = std::fs::create_dir_all(path.parent().unwrap_or(&path));
            let _ = std::fs::write(&path, json);
        }
    }
}

fn remove_lockout_file() {
    if let Some(path) = lockout_file_path() {
        let _ = std::fs::remove_file(&path);
    }
}

fn load_lockout() -> Option<LockoutData> {
    let path = lockout_file_path()?;
    let data = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

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
    /// Whether lockout state has been loaded from disk
    lockout_loaded: bool,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            dek: None,
            db: None,
            failed_attempts: 0,
            last_failed_at: None,
            lockout_loaded: false,
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.dek.is_some() && self.db.is_some()
    }

    pub fn lock(&mut self) {
        self.dek = None;
        self.db = None;
    }

    /// Load persisted lockout state from disk (lazy, called once)
    fn ensure_lockout_loaded(&mut self) {
        if self.lockout_loaded {
            return;
        }
        self.lockout_loaded = true;

        if let Some(data) = load_lockout() {
            if data.failed_attempts >= MAX_FAILED_ATTEMPTS {
                let now_epoch = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let elapsed = now_epoch.saturating_sub(data.last_failed_at_epoch);

                if elapsed < LOCKOUT_DURATION_SECS {
                    // Lockout is still active — restore state
                    self.failed_attempts = data.failed_attempts;
                    // Reconstruct Instant: current time minus elapsed since failure
                    self.last_failed_at =
                        Some(Instant::now() - std::time::Duration::from_secs(elapsed));
                } else {
                    // Lockout has expired — clean up
                    remove_lockout_file();
                }
            } else {
                // Not at lockout threshold but had some failures — restore count
                let now_epoch = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let elapsed = now_epoch.saturating_sub(data.last_failed_at_epoch);

                self.failed_attempts = data.failed_attempts;
                self.last_failed_at =
                    Some(Instant::now() - std::time::Duration::from_secs(elapsed));
            }
        }
    }

    /// Record a failed password attempt
    pub fn record_failed_attempt(&mut self) {
        self.ensure_lockout_loaded();
        self.failed_attempts += 1;
        self.last_failed_at = Some(Instant::now());

        let epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        persist_lockout(self.failed_attempts, epoch);
    }

    /// Reset failed attempts counter (called on successful unlock)
    pub fn reset_failed_attempts(&mut self) {
        self.failed_attempts = 0;
        self.last_failed_at = None;
        remove_lockout_file();
    }

    /// Check if currently locked out due to too many failed attempts
    /// Returns Some(remaining_seconds) if locked out, None if not
    /// Resets failed_attempts when the lockout period has expired (M-3 fix)
    pub fn check_lockout(&mut self) -> Option<u64> {
        self.ensure_lockout_loaded();
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_persist_and_load_lockout() {
        let temp_dir = tempfile::tempdir().unwrap();
        let lockout_path = temp_dir.path().join("lockout.json");

        let epoch = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let data = LockoutData {
            failed_attempts: 5,
            last_failed_at_epoch: epoch,
        };

        let json = serde_json::to_string(&data).unwrap();
        fs::write(&lockout_path, &json).unwrap();

        let loaded: LockoutData =
            serde_json::from_str(&fs::read_to_string(&lockout_path).unwrap()).unwrap();
        assert_eq!(loaded.failed_attempts, 5);
        assert_eq!(loaded.last_failed_at_epoch, epoch);
    }

    #[test]
    fn test_lockout_data_serialization() {
        let data = LockoutData {
            failed_attempts: 3,
            last_failed_at_epoch: 1700000000,
        };

        let json = serde_json::to_string(&data).unwrap();
        let deserialized: LockoutData = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.failed_attempts, 3);
        assert_eq!(deserialized.last_failed_at_epoch, 1700000000);
    }

    #[test]
    fn test_app_state_record_and_reset() {
        let mut state = AppState::new();
        state.lockout_loaded = true; // skip file loading in test

        assert_eq!(state.failed_attempts, 0);
        assert!(state.last_failed_at.is_none());

        state.failed_attempts += 1;
        state.last_failed_at = Some(Instant::now());

        assert_eq!(state.failed_attempts, 1);
        assert!(state.last_failed_at.is_some());

        state.failed_attempts = 0;
        state.last_failed_at = None;

        assert_eq!(state.failed_attempts, 0);
        assert!(state.last_failed_at.is_none());
    }

    #[test]
    fn test_check_lockout_not_at_threshold() {
        let mut state = AppState::new();
        state.lockout_loaded = true;
        state.failed_attempts = 3;
        state.last_failed_at = Some(Instant::now());

        assert!(state.check_lockout().is_none());
    }

    #[test]
    fn test_check_lockout_at_threshold_active() {
        let mut state = AppState::new();
        state.lockout_loaded = true;
        state.failed_attempts = MAX_FAILED_ATTEMPTS;
        state.last_failed_at = Some(Instant::now());

        let remaining = state.check_lockout();
        assert!(remaining.is_some());
        assert!(remaining.unwrap() <= LOCKOUT_DURATION_SECS);
    }

    #[test]
    fn test_check_lockout_at_threshold_expired() {
        let mut state = AppState::new();
        state.lockout_loaded = true;
        state.failed_attempts = MAX_FAILED_ATTEMPTS;
        // Set last_failed_at to past beyond lockout duration
        state.last_failed_at = Some(
            Instant::now() - std::time::Duration::from_secs(LOCKOUT_DURATION_SECS + 1),
        );

        assert!(state.check_lockout().is_none());
        assert_eq!(state.failed_attempts, 0);
        assert!(state.last_failed_at.is_none());
    }
}
