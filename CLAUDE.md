# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knot is a privacy-first encrypted note-taking app built with Tauri. All data is encrypted locally using XChaCha20-Poly1305, with keys derived via Argon2id. The database itself is encrypted with SQLCipher. The app is designed for zero-knowledge architecture - no plaintext data ever touches disk.

## Build Requirements

- **Windows**: Strawberry Perl is required for building SQLCipher (MSYS2 Perl won't work)
  - Download from https://strawberryperl.com/
  - Ensure `C:\Strawberry\perl\bin` is in PATH before any MSYS2 paths

## Development Commands

```bash
# Development (starts both Vite frontend and Tauri backend)
npm run tauri:dev

# Build for production
npm run tauri:build

# Frontend only (for UI development)
npm run dev

# Run Rust tests
cd src-tauri && cargo test

# Run a single Rust test
cd src-tauri && cargo test <test_name>
```

## Architecture

### Dual-layer Structure

**Frontend (TypeScript/React)** - `src/`
- State management via Zustand stores (`stores/authStore.ts`, `stores/notesStore.ts`)
- All Tauri IPC calls go through `lib/api.ts`
- CodeMirror 6 for the Markdown editor

**Backend (Rust/Tauri)** - `src-tauri/src/`
- `commands/` - Tauri command handlers exposed to frontend
- `crypto/` - Encryption primitives (keys.rs, cipher.rs, recovery.rs)
- `storage/` - SQLCipher database operations
- `models/` - Data structures (Note, Vault)

### State Management

The app uses a global `AppState` (in `commands/mod.rs`) that holds:
- `dek: Option<Zeroizing<[u8; 32]>>` - Data Encryption Key, only present when unlocked
- `db: Option<Database>` - Database connection, only present when unlocked

When the app locks, both are zeroed and dropped.

### Screen Flow

Frontend screens are controlled by `authStore.screen`:
- `loading` → `setup` (first run) or `unlock` (returning user)
- `unlock` → `unlocked` (after successful password entry)
- `recovery` → accessed via unlock screen for account recovery

### Cryptography

- **Key derivation**: Argon2id (64MB memory, 3 iterations, 4 parallel lanes)
- **Database encryption**: SQLCipher (DEK used as encryption key)
- **Note encryption**: XChaCha20-Poly1305 for note content (application-level)
- **Recovery**: BIP39 12-word mnemonic → HKDF → Recovery KEK

The app uses dual-layer encryption: SQLCipher encrypts the entire database file (protecting metadata like timestamps), while note content is additionally encrypted with XChaCha20-Poly1305.

See `docs/SPECIFICATION.md` for detailed cryptographic protocols and threat model.

## Conventions

- Security-sensitive data uses `Zeroizing<T>` from the `zeroize` crate
- All note content is encrypted before storage; titles are also encrypted
- Frontend communicates with backend exclusively via Tauri `invoke()` calls
- Error messages to users should not leak security-relevant information
