# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knot is a privacy-first encrypted note-taking app built with Tauri 1.x. All data is encrypted locally using XChaCha20-Poly1305, with keys derived via Argon2id. The database itself is encrypted with SQLCipher. The app is designed for zero-knowledge architecture - no plaintext data ever touches disk.

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

# Frontend only (for UI development without Tauri)
npm run dev

# Run all Rust tests
cd src-tauri && cargo test

# Run a single Rust test
cd src-tauri && cargo test <test_name>

# Run all frontend tests (single run)
npm run test:run

# Run frontend tests in watch mode
npm run test

# Type-check frontend without emitting
npx tsc --noEmit
```

## Architecture

### Dual-layer Structure

**Frontend (TypeScript/React)** - `src/`
- State management via Zustand stores (`stores/authStore.ts`, `stores/notesStore.ts`)
- All Tauri IPC calls go through `lib/api.ts` — never call `invoke()` directly from components
- CodeMirror 6 for the Markdown editor with custom wikilink syntax extension
- Tailwind CSS 4 for styling with `dark:` class-based dark mode

**Backend (Rust/Tauri)** - `src-tauri/src/`
- `commands/` - Tauri command handlers exposed to frontend (auth, notes, settings, export/import)
- `crypto/` - Encryption primitives (keys.rs, cipher.rs, recovery.rs)
- `storage/` - SQLCipher database operations (database.rs for schema, notes.rs for queries)
- `models/` - Data structures (Note, EncryptedNote, NoteMetadata, Vault)

### Data Flow

All note operations follow this pipeline:
1. Frontend component calls a store action (e.g., `notesStore.createNote()`)
2. Store action calls `api.ts` wrapper (e.g., `api.createNote()`)
3. `api.ts` calls `invoke("create_note", { ... })` (Tauri IPC)
4. Rust command handler checks `AppState.is_unlocked()`, then encrypts/decrypts using DEK
5. Storage layer reads/writes encrypted blobs to SQLCipher database

### State Management

The app uses a global `AppState` (in `commands/mod.rs`) that holds:
- `dek: Option<Zeroizing<[u8; 32]>>` - Data Encryption Key, only present when unlocked
- `db: Option<Database>` - Database connection, only present when unlocked
- `failed_attempts: u32` and `last_failed_at` - Brute-force lockout tracking

When the app locks, both dek and db are zeroed and dropped. Every Rust command that touches notes must first check `is_unlocked()`.

### Screen Flow

Frontend screens are controlled by `authStore.screen`:
- `loading` → `setup` (first run) or `unlock` (returning user)
- `unlock` → `unlocked` (after successful password entry)
- `recovery` → accessed via unlock screen for account recovery

### i18n System

Custom implementation in `src/i18n/` (not react-i18next — intentionally lightweight for ~85 keys, 2 languages):
- `translations.ts` - All translation strings for `ja` and `en`
- `useTranslation.ts` - Hook returning `{ t, language, resolvedLanguage }`
- `backendErrors.ts` - Maps Rust error strings to i18n keys
- Usage: `const { t } = useTranslation(); t("key")` or `t("key", { n: 5 })`
- When adding a new user-facing string, add entries to **both** `ja` and `en` in `translations.ts`

### Auto-save and Pending Saves

The editor debounces updates into a `pendingSave` in `notesStore`. Before locking, `flushPendingSave()` is called to ensure no data loss. This is critical — any new lock or close path must call `flushPendingSave()` first.

### Cryptography

- **Key derivation**: Argon2id (64MB memory, 3 iterations, 4 parallel lanes)
- **Database encryption**: SQLCipher (DEK used as hex-encoded encryption key)
- **Note encryption**: XChaCha20-Poly1305 for note content (application-level)
- **Cipher format**: `[version(1 byte) | nonce(24 bytes) | ciphertext | tag(16 bytes)]`
- **Recovery**: BIP39 12-word mnemonic → HKDF-SHA256 (with domain separation) → Recovery KEK

The app uses dual-layer encryption: SQLCipher encrypts the entire database file (protecting metadata like timestamps), while note content is additionally encrypted with XChaCha20-Poly1305.

See `docs/SPECIFICATION.md` for detailed cryptographic protocols and threat model.

### Settings Persistence

App settings (theme, language, auto-lock timeout) are stored as plain JSON in `settings.json` (via `commands/settings.rs`). These do **not** require the vault to be unlocked. The unified persistence helper is in `stores/settingsHelper.ts`.

## Testing

### Frontend Tests (Vitest + jsdom)
- Config: `vitest.config.ts` with jsdom environment
- Setup file `src/test/setup.ts` mocks `@tauri-apps/api/tauri` globally
- Pattern: mock `invoke` per test, reset stores in `beforeEach`
- Example: `mockInvoke.mockResolvedValueOnce(data)` then call store action and assert state

### Backend Tests (cargo test)
- Tests use `tempfile` crate for temporary SQLCipher databases
- Inline `#[cfg(test)] mod tests` in each module
- Crypto tests verify round-trip encrypt/decrypt, key derivation determinism

## Conventions

- Security-sensitive data uses `Zeroizing<T>` from the `zeroize` crate
- All note content is encrypted before storage; titles are also encrypted
- Frontend communicates with backend exclusively via Tauri `invoke()` calls through `lib/api.ts`
- Error messages to users should not leak security-relevant information
- Rust commands return `Result<T, String>` — frontend maps error strings via `backendErrors.ts`
- Tags are normalized: lowercase, trimmed, empty strings removed
- Notes are sorted pinned-first, then by `updated_at` descending
- Wikilinks use `[[Note Title]]` syntax — clicking creates the note if it doesn't exist
