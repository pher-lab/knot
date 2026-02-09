use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2, Params,
};
use rand::{rngs::OsRng, RngCore};
use thiserror::Error;
use zeroize::Zeroizing;

/// Key size for XChaCha20-Poly1305 (256 bits)
pub const KEY_SIZE: usize = 32;
/// Salt size for Argon2
pub const SALT_SIZE: usize = 32;

#[derive(Error, Debug)]
pub enum KeyError {
    #[error("Key derivation failed")]
    DerivationFailed,
    #[error("Invalid key length")]
    InvalidKeyLength,
}

/// Generate a random salt for password hashing
pub fn generate_salt() -> [u8; SALT_SIZE] {
    let mut salt = [0u8; SALT_SIZE];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Generate a random Data Encryption Key (DEK)
pub fn generate_dek() -> Zeroizing<[u8; KEY_SIZE]> {
    let mut dek = Zeroizing::new([0u8; KEY_SIZE]);
    OsRng.fill_bytes(dek.as_mut());
    dek
}

/// Derive a key from password using Argon2id
///
/// Parameters (as per spec):
/// - Memory: 64MB
/// - Iterations: 3
/// - Parallelism: 4
pub fn derive_key(password: &[u8], salt: &[u8; SALT_SIZE]) -> Result<Zeroizing<[u8; KEY_SIZE]>, KeyError> {
    // Argon2id parameters: 64MB memory, 3 iterations, 4 parallel lanes
    let params = Params::new(
        64 * 1024, // 64MB in KB
        3,         // iterations
        4,         // parallelism
        Some(KEY_SIZE),
    )
    .map_err(|_| KeyError::DerivationFailed)?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    // Convert salt to SaltString format
    let salt_string = SaltString::encode_b64(salt).map_err(|_| KeyError::DerivationFailed)?;

    let hash = argon2
        .hash_password(password, &salt_string)
        .map_err(|_| KeyError::DerivationFailed)?;

    let hash_output = hash.hash.ok_or(KeyError::DerivationFailed)?;
    let hash_bytes = hash_output.as_bytes();

    if hash_bytes.len() < KEY_SIZE {
        return Err(KeyError::InvalidKeyLength);
    }

    let mut key = Zeroizing::new([0u8; KEY_SIZE]);
    key.copy_from_slice(&hash_bytes[..KEY_SIZE]);

    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_salt() {
        let salt1 = generate_salt();
        let salt2 = generate_salt();
        assert_ne!(salt1, salt2);
    }

    #[test]
    fn test_generate_dek() {
        let dek1 = generate_dek();
        let dek2 = generate_dek();
        assert_ne!(dek1.as_ref(), dek2.as_ref());
    }

    #[test]
    fn test_derive_key() {
        let password = b"test_password";
        let salt = generate_salt();

        let key1 = derive_key(password, &salt).unwrap();
        let key2 = derive_key(password, &salt).unwrap();

        // Same password and salt should produce same key
        assert_eq!(key1.as_ref(), key2.as_ref());

        // Different salt should produce different key
        let salt2 = generate_salt();
        let key3 = derive_key(password, &salt2).unwrap();
        assert_ne!(key1.as_ref(), key3.as_ref());
    }

    #[test]
    fn test_wrong_password_produces_different_key() {
        let salt = generate_salt();
        let key1 = derive_key(b"correct_password", &salt).unwrap();
        let key2 = derive_key(b"wrong_password", &salt).unwrap();

        // Different passwords should produce different keys
        assert_ne!(key1.as_ref(), key2.as_ref());
    }

    #[test]
    fn test_empty_password() {
        let salt = generate_salt();
        // Empty password should still work (though not recommended)
        let result = derive_key(b"", &salt);
        assert!(result.is_ok());
    }

    #[test]
    fn test_unicode_password() {
        let salt = generate_salt();
        let password = "パスワード🔐".as_bytes();
        let key = derive_key(password, &salt).unwrap();

        // Should produce consistent results
        let key2 = derive_key(password, &salt).unwrap();
        assert_eq!(key.as_ref(), key2.as_ref());
    }

    #[test]
    fn test_long_password() {
        let salt = generate_salt();
        let long_password = "a".repeat(10000);
        let result = derive_key(long_password.as_bytes(), &salt);
        assert!(result.is_ok());
    }
}
