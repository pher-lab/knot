use bip39::{Language, Mnemonic};
use rand::{rngs::OsRng, RngCore};
use thiserror::Error;
use zeroize::Zeroizing;

use super::keys::KEY_SIZE;

#[derive(Error, Debug)]
pub enum RecoveryError {
    #[error("Failed to generate mnemonic")]
    MnemonicGenerationFailed,
    #[error("Invalid mnemonic phrase")]
    InvalidMnemonic,
}

/// Generate a BIP39 mnemonic (12 words, 128 bits of entropy)
pub fn generate_recovery_key() -> Result<String, RecoveryError> {
    // Generate 128 bits (16 bytes) of entropy for 12 words
    // Wrap in Zeroizing to ensure entropy is cleared from memory
    let mut entropy = Zeroizing::new([0u8; 16]);
    OsRng.fill_bytes(entropy.as_mut());

    let mnemonic = Mnemonic::from_entropy_in(Language::English, entropy.as_ref())
        .map_err(|_| RecoveryError::MnemonicGenerationFailed)?;

    Ok(mnemonic.to_string())
}

/// Derive a Key Encryption Key (KEK) from recovery mnemonic using HKDF-SHA256
pub fn recovery_key_to_kek(mnemonic_phrase: &str) -> Result<Zeroizing<[u8; KEY_SIZE]>, RecoveryError> {
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, mnemonic_phrase)
        .map_err(|_| RecoveryError::InvalidMnemonic)?;

    // Get entropy from mnemonic
    // Wrap in Zeroizing to ensure entropy is cleared from memory
    let entropy = Zeroizing::new(mnemonic.to_entropy());

    // Use HKDF-SHA256 to derive key from entropy
    use hkdf::Hkdf;
    use sha2::Sha256;

    // HKDF extract and expand with domain separator as info
    let hk = Hkdf::<Sha256>::new(None, &*entropy);
    let mut key = Zeroizing::new([0u8; KEY_SIZE]);
    hk.expand(b"knot-recovery-kek-v1", key.as_mut())
        .expect("32 bytes is a valid output length for HKDF-SHA256");

    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_recovery_key() {
        let mnemonic = generate_recovery_key().unwrap();
        let words: Vec<&str> = mnemonic.split_whitespace().collect();
        assert_eq!(words.len(), 12);
    }

    #[test]
    fn test_recovery_key_to_kek() {
        let mnemonic = generate_recovery_key().unwrap();
        let kek1 = recovery_key_to_kek(&mnemonic).unwrap();
        let kek2 = recovery_key_to_kek(&mnemonic).unwrap();

        // Same mnemonic should produce same key
        assert_eq!(kek1.as_ref(), kek2.as_ref());
    }

    #[test]
    fn test_invalid_mnemonic() {
        let result = recovery_key_to_kek("invalid mnemonic phrase");
        assert!(result.is_err());
    }
}
