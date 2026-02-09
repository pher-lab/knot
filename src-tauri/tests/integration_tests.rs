//! Integration tests for Knot's cryptographic operations
//!
//! These tests verify the complete flow of:
//! - Password → Key derivation → Encryption → Decryption
//! - Recovery key generation and restoration

use knot::crypto::{cipher, keys, recovery};

/// Test the complete encryption round-trip:
/// Password → Derive Key → Encrypt DEK → Decrypt DEK → Use DEK
#[test]
fn test_password_to_encryption_roundtrip() {
    let password = b"my_secure_password";
    let salt = keys::generate_salt();

    // 1. Generate a DEK
    let dek = keys::generate_dek();

    // 2. Derive master key from password
    let master_key = keys::derive_key(password, &salt).unwrap();

    // 3. Encrypt DEK with master key
    let encrypted_dek = cipher::encrypt(&*dek, &*master_key).unwrap();

    // 4. Decrypt DEK with master key
    let decrypted_dek_bytes = cipher::decrypt(&encrypted_dek, &*master_key).unwrap();

    // 5. Verify DEK matches
    assert_eq!(dek.as_ref(), decrypted_dek_bytes.as_slice());

    // 6. Use DEK to encrypt/decrypt note content
    let note_content = "This is my secret note 🔐";
    let dek_array: [u8; 32] = decrypted_dek_bytes.try_into().unwrap();
    let encrypted_note = cipher::encrypt(note_content.as_bytes(), &dek_array).unwrap();
    let decrypted_note = cipher::decrypt(&encrypted_note, &dek_array).unwrap();

    assert_eq!(note_content.as_bytes(), decrypted_note.as_slice());
}

/// Test that wrong password fails to decrypt
#[test]
fn test_wrong_password_fails_decryption() {
    let correct_password = b"correct_password";
    let wrong_password = b"wrong_password";
    let salt = keys::generate_salt();

    // Generate and encrypt DEK with correct password
    let dek = keys::generate_dek();
    let master_key = keys::derive_key(correct_password, &salt).unwrap();
    let encrypted_dek = cipher::encrypt(&*dek, &*master_key).unwrap();

    // Try to decrypt with wrong password
    let wrong_key = keys::derive_key(wrong_password, &salt).unwrap();
    let result = cipher::decrypt(&encrypted_dek, &*wrong_key);

    // Should fail authentication
    assert!(result.is_err());
}

/// Test recovery key flow:
/// Generate recovery key → Encrypt DEK → Recover DEK
#[test]
fn test_recovery_key_roundtrip() {
    // 1. Generate DEK
    let dek = keys::generate_dek();

    // 2. Generate recovery key (mnemonic)
    let mnemonic = recovery::generate_recovery_key().unwrap();

    // Verify it's 12 words
    let words: Vec<&str> = mnemonic.split_whitespace().collect();
    assert_eq!(words.len(), 12);

    // 3. Derive recovery KEK from mnemonic
    let recovery_kek = recovery::recovery_key_to_kek(&mnemonic).unwrap();

    // 4. Encrypt DEK with recovery KEK
    let encrypted_dek = cipher::encrypt(&*dek, &*recovery_kek).unwrap();

    // 5. Later: recover DEK using the same mnemonic
    let recovery_kek_again = recovery::recovery_key_to_kek(&mnemonic).unwrap();
    let recovered_dek = cipher::decrypt(&encrypted_dek, &*recovery_kek_again).unwrap();

    // 6. Verify DEK matches
    assert_eq!(dek.as_ref(), recovered_dek.as_slice());
}

/// Test that recovery with wrong mnemonic fails
#[test]
fn test_wrong_recovery_key_fails() {
    let dek = keys::generate_dek();

    // Encrypt with one recovery key
    let mnemonic1 = recovery::generate_recovery_key().unwrap();
    let kek1 = recovery::recovery_key_to_kek(&mnemonic1).unwrap();
    let encrypted_dek = cipher::encrypt(&*dek, &*kek1).unwrap();

    // Try to decrypt with different recovery key
    let mnemonic2 = recovery::generate_recovery_key().unwrap();
    let kek2 = recovery::recovery_key_to_kek(&mnemonic2).unwrap();
    let result = cipher::decrypt(&encrypted_dek, &*kek2);

    assert!(result.is_err());
}

/// Test multiple notes encryption with same DEK
#[test]
fn test_multiple_notes_same_dek() {
    let dek = keys::generate_dek();
    let large_note = "A".repeat(100000);

    let notes: Vec<&str> = vec![
        "First note content",
        "Second note with different content",
        "Third note 日本語 🔐",
        "", // Empty note
        &large_note, // Large note
    ];

    for original in &notes {
        let encrypted = cipher::encrypt(original.as_bytes(), &*dek).unwrap();
        let decrypted = cipher::decrypt(&encrypted, &*dek).unwrap();
        assert_eq!(original.as_bytes(), decrypted.as_slice());
    }
}

/// Test that DEK change requires re-encryption
#[test]
fn test_dek_rotation() {
    let old_dek = keys::generate_dek();
    let new_dek = keys::generate_dek();

    let note = "Secret note content";

    // Encrypt with old DEK
    let encrypted_old = cipher::encrypt(note.as_bytes(), &*old_dek).unwrap();

    // Cannot decrypt with new DEK
    let result = cipher::decrypt(&encrypted_old, &*new_dek);
    assert!(result.is_err());

    // Re-encrypt for new DEK
    let decrypted = cipher::decrypt(&encrypted_old, &*old_dek).unwrap();
    let encrypted_new = cipher::encrypt(&decrypted, &*new_dek).unwrap();

    // Now can decrypt with new DEK
    let final_decrypted = cipher::decrypt(&encrypted_new, &*new_dek).unwrap();
    assert_eq!(note.as_bytes(), final_decrypted.as_slice());
}

/// Test password change scenario
#[test]
fn test_password_change() {
    let old_password = b"old_password";
    let new_password = b"new_password";
    let salt = keys::generate_salt();

    // Setup: DEK encrypted with old password
    let dek = keys::generate_dek();
    let old_master_key = keys::derive_key(old_password, &salt).unwrap();
    let encrypted_dek = cipher::encrypt(&*dek, &*old_master_key).unwrap();

    // Change password:
    // 1. Decrypt DEK with old password
    let decrypted_dek = cipher::decrypt(&encrypted_dek, &*old_master_key).unwrap();

    // 2. Generate new salt and derive new master key
    let new_salt = keys::generate_salt();
    let new_master_key = keys::derive_key(new_password, &new_salt).unwrap();

    // 3. Re-encrypt DEK with new master key
    let new_encrypted_dek = cipher::encrypt(&decrypted_dek, &*new_master_key).unwrap();

    // Verify: old password no longer works
    let result = cipher::decrypt(&new_encrypted_dek, &*old_master_key);
    assert!(result.is_err());

    // Verify: new password works
    let recovered_dek = cipher::decrypt(&new_encrypted_dek, &*new_master_key).unwrap();
    assert_eq!(dek.as_ref(), recovered_dek.as_slice());
}
