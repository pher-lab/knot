use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use rand::{rngs::OsRng, RngCore};
use thiserror::Error;

use super::keys::KEY_SIZE;

/// Current encryption format version
const VERSION: u8 = 0x01;
/// Nonce size for XChaCha20-Poly1305
const NONCE_SIZE: usize = 24;
/// Auth tag size
const TAG_SIZE: usize = 16;

#[derive(Error, Debug)]
pub enum CipherError {
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Invalid ciphertext format")]
    InvalidFormat,
    #[error("Unsupported version: {0}")]
    UnsupportedVersion(u8),
}

/// Encrypt data using XChaCha20-Poly1305
///
/// Output format:
/// ```text
/// ┌────────────────────────────────────────┐
/// │  Version (1 byte)     │ 0x01           │
/// ├───────────────────────┼────────────────┤
/// │  Nonce (24 bytes)     │ random         │
/// ├───────────────────────┼────────────────┤
/// │  Ciphertext (var)     │ encrypted data │
/// ├───────────────────────┼────────────────┤
/// │  Auth Tag (16 bytes)  │ Poly1305 tag   │
/// └───────────────────────┴────────────────┘
/// ```
pub fn encrypt(plaintext: &[u8], key: &[u8; KEY_SIZE]) -> Result<Vec<u8>, CipherError> {
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| CipherError::EncryptionFailed)?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);

    // Encrypt (ciphertext includes auth tag)
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CipherError::EncryptionFailed)?;

    // Build output: version || nonce || ciphertext (includes tag)
    let mut output = Vec::with_capacity(1 + NONCE_SIZE + ciphertext.len());
    output.push(VERSION);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);

    Ok(output)
}

/// Decrypt data using XChaCha20-Poly1305
pub fn decrypt(ciphertext: &[u8], key: &[u8; KEY_SIZE]) -> Result<Vec<u8>, CipherError> {
    // Minimum size: version + nonce + tag
    let min_size = 1 + NONCE_SIZE + TAG_SIZE;
    if ciphertext.len() < min_size {
        return Err(CipherError::InvalidFormat);
    }

    // Check version
    let version = ciphertext[0];
    if version != VERSION {
        return Err(CipherError::UnsupportedVersion(version));
    }

    // Extract nonce and ciphertext
    let nonce = XNonce::from_slice(&ciphertext[1..1 + NONCE_SIZE]);
    let encrypted_data = &ciphertext[1 + NONCE_SIZE..];

    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| CipherError::DecryptionFailed)?;

    // Decrypt
    cipher
        .decrypt(nonce, encrypted_data)
        .map_err(|_| CipherError::DecryptionFailed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::keys::generate_dek;

    #[test]
    fn test_encrypt_decrypt() {
        let key = generate_dek();
        let plaintext = b"Hello, Knot!";

        let ciphertext = encrypt(plaintext, &*key).unwrap();
        let decrypted = decrypt(&ciphertext, &*key).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = generate_dek();
        let key2 = generate_dek();
        let plaintext = b"Secret data";

        let ciphertext = encrypt(plaintext, &*key1).unwrap();
        let result = decrypt(&ciphertext, &*key2);

        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = generate_dek();
        let plaintext = b"Important data";

        let mut ciphertext = encrypt(plaintext, &*key).unwrap();
        // Tamper with the ciphertext
        let last = ciphertext.len() - 1;
        ciphertext[last] ^= 0xFF;

        let result = decrypt(&ciphertext, &*key);
        assert!(result.is_err());
    }

    #[test]
    fn test_large_data_1mb() {
        let key = generate_dek();
        // 1MB of data
        let plaintext: Vec<u8> = (0..1_000_000).map(|i| (i % 256) as u8).collect();

        let ciphertext = encrypt(&plaintext, &*key).unwrap();
        let decrypted = decrypt(&ciphertext, &*key).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_empty_data() {
        let key = generate_dek();
        let plaintext = b"";

        let ciphertext = encrypt(plaintext, &*key).unwrap();
        let decrypted = decrypt(&ciphertext, &*key).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_unicode_content() {
        let key = generate_dek();
        let plaintext = "日本語テスト 🔐🔑 Emoji and UTF-8".as_bytes();

        let ciphertext = encrypt(plaintext, &*key).unwrap();
        let decrypted = decrypt(&ciphertext, &*key).unwrap();

        assert_eq!(plaintext, decrypted.as_slice());
        assert_eq!(
            String::from_utf8(decrypted).unwrap(),
            "日本語テスト 🔐🔑 Emoji and UTF-8"
        );
    }

    #[test]
    fn test_ciphertext_format() {
        let key = generate_dek();
        let plaintext = b"test";

        let ciphertext = encrypt(plaintext, &*key).unwrap();

        // Check format: version (1) + nonce (24) + encrypted data + tag (16)
        assert_eq!(ciphertext[0], 0x01); // Version
        assert!(ciphertext.len() >= 1 + 24 + 16); // Minimum size
    }

    #[test]
    fn test_truncated_ciphertext_fails() {
        let key = generate_dek();

        // Too short - less than minimum (version + nonce + tag)
        let short_ciphertext = vec![0x01; 10];
        let result = decrypt(&short_ciphertext, &*key);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_version_fails() {
        let key = generate_dek();
        let plaintext = b"test";

        let mut ciphertext = encrypt(plaintext, &*key).unwrap();
        // Change version to invalid
        ciphertext[0] = 0xFF;

        let result = decrypt(&ciphertext, &*key);
        assert!(matches!(result, Err(CipherError::UnsupportedVersion(0xFF))));
    }

    #[test]
    fn test_each_encryption_produces_unique_ciphertext() {
        let key = generate_dek();
        let plaintext = b"same data";

        let ct1 = encrypt(plaintext, &*key).unwrap();
        let ct2 = encrypt(plaintext, &*key).unwrap();

        // Different nonces should produce different ciphertexts
        assert_ne!(ct1, ct2);

        // But both should decrypt to same plaintext
        assert_eq!(decrypt(&ct1, &*key).unwrap(), decrypt(&ct2, &*key).unwrap());
    }
}
