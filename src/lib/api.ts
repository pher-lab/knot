import { invoke } from "@tauri-apps/api/tauri";

// Types
export interface SetupResult {
  success: boolean;
  recovery_key: string | null;
}

export interface AuthResult {
  success: boolean;
  error: string | null;
  lockout_seconds: number | null;
}

export interface NoteResponse {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface NoteListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  pinned: boolean;
  tags: string[];
}

// Auth API
export async function checkLockoutStatus(): Promise<number | null> {
  return invoke<number | null>("check_lockout_status");
}

export async function checkVaultExists(): Promise<boolean> {
  return invoke<boolean>("check_vault_exists");
}

export async function setupVault(
  password: string,
  createRecoveryKey: boolean
): Promise<SetupResult> {
  return invoke<SetupResult>("setup_vault", {
    password,
    createRecoveryKey,
  });
}

export async function unlockVault(password: string): Promise<AuthResult> {
  return invoke<AuthResult>("unlock_vault", { password });
}

export async function lockVault(): Promise<boolean> {
  return invoke<boolean>("lock_vault");
}

export async function recoverVault(
  mnemonic: string,
  newPassword: string
): Promise<AuthResult> {
  return invoke<AuthResult>("recover_vault", { mnemonic, newPassword });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  return invoke<AuthResult>("change_password", {
    currentPassword,
    newPassword,
  });
}

// Notes API
export async function createNote(
  title: string,
  content: string
): Promise<NoteResponse> {
  return invoke<NoteResponse>("create_note", { title, content });
}

export async function getNote(id: string): Promise<NoteResponse | null> {
  return invoke<NoteResponse | null>("get_note", { id });
}

export async function updateNote(
  id: string,
  title: string,
  content: string
): Promise<NoteResponse> {
  return invoke<NoteResponse>("update_note", { id, title, content });
}

export async function deleteNote(id: string): Promise<boolean> {
  return invoke<boolean>("delete_note", { id });
}

export async function listNotes(): Promise<NoteListItem[]> {
  return invoke<NoteListItem[]>("list_notes");
}

export async function searchNotes(query: string): Promise<NoteListItem[]> {
  return invoke<NoteListItem[]>("search_notes", { query });
}

// Settings API
export interface AppSettings {
  theme?: string;
  language?: string;
  auto_lock_minutes?: number;
  font_size?: string;
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<boolean> {
  return invoke<boolean>("save_settings", { settings });
}

// Import/Export API
export async function exportNote(noteId: string, filePath: string): Promise<void> {
  return invoke<void>("export_note", { noteId, filePath });
}

export async function exportAllNotes(dirPath: string): Promise<number> {
  return invoke<number>("export_all_notes", { dirPath });
}

export async function importNotes(filePaths: string[]): Promise<number> {
  return invoke<number>("import_notes", { filePaths });
}

// Pin API
export async function togglePinNote(id: string): Promise<boolean> {
  return invoke<boolean>("toggle_pin_note", { id });
}

// Tags API
export async function setNoteTags(
  id: string,
  tags: string[]
): Promise<string[]> {
  return invoke<string[]>("set_note_tags", { id, tags });
}

export async function listAllTags(): Promise<string[]> {
  return invoke<string[]>("list_all_tags");
}
