import { create } from "zustand";
import * as api from "../lib/api";
import { useNotesStore } from "./notesStore";
import { saveAllSettings } from "./settingsHelper";
import { useLanguageStore } from "./languageStore";
import { getWelcomeNote } from "../lib/welcomeNote";

type AuthScreen = "loading" | "setup" | "unlock" | "recovery" | "unlocked";

interface AuthState {
  screen: AuthScreen;
  isLoading: boolean;
  error: string | null;
  recoveryKey: string | null;
  autoLockMinutes: number; // 0 = disabled
  lockoutSeconds: number | null; // Remaining lockout seconds

  // Actions
  initialize: () => Promise<void>;
  setup: (password: string, createRecoveryKey: boolean) => Promise<boolean>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
  recover: (mnemonic: string, newPassword: string) => Promise<boolean>;
  showRecoveryScreen: () => void;
  showUnlockScreen: () => void;
  clearError: () => void;
  clearRecoveryKey: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  applyAutoLockMinutes: (minutes: number) => void;
  setLockoutSeconds: (seconds: number | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  screen: "loading",
  isLoading: false,
  error: null,
  recoveryKey: null,
  autoLockMinutes: 5,
  lockoutSeconds: null,

  initialize: async () => {
    try {
      const exists = await api.checkVaultExists();
      set({ screen: exists ? "unlock" : "setup" });
    } catch (e) {
      set({ error: String(e), screen: "setup" });
    }
  },

  setup: async (password, createRecoveryKey) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.setupVault(password, createRecoveryKey);
      if (result.success) {
        // Create welcome note in the user's current language
        const lang = useLanguageStore.getState().resolvedLanguage;
        const welcome = getWelcomeNote(lang);
        try {
          await api.createNote(welcome.title, welcome.content);
        } catch {
          // Non-critical: don't block setup if welcome note fails
        }

        set({
          screen: "unlocked",
          isLoading: false,
          recoveryKey: result.recovery_key,
        });
        return true;
      } else {
        set({ error: "Setup failed", isLoading: false });
        return false;
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  unlock: async (password) => {
    set({ isLoading: true, error: null, lockoutSeconds: null });
    try {
      const result = await api.unlockVault(password);
      if (result.success) {
        set({ screen: "unlocked", isLoading: false, lockoutSeconds: null });
        return true;
      } else {
        set({
          error: result.error || "Unlock failed",
          isLoading: false,
          lockoutSeconds: result.lockout_seconds,
        });
        return false;
      }
    } catch (e) {
      set({ error: String(e), isLoading: false, lockoutSeconds: null });
      return false;
    }
  },

  lock: async () => {
    try {
      // Flush any pending saves before locking
      await useNotesStore.getState().flushPendingSave();
      await api.lockVault();
      set({ screen: "unlock", recoveryKey: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  recover: async (mnemonic, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.recoverVault(mnemonic, newPassword);
      if (result.success) {
        set({ screen: "unlocked", isLoading: false });
        return true;
      } else {
        set({ error: result.error || "Recovery failed", isLoading: false });
        return false;
      }
    } catch (e) {
      set({ error: String(e), isLoading: false });
      return false;
    }
  },

  showRecoveryScreen: () => set({ screen: "recovery", error: null }),
  showUnlockScreen: () => set({ screen: "unlock", error: null }),
  clearError: () => set({ error: null }),
  clearRecoveryKey: () => set({ recoveryKey: null }),
  setAutoLockMinutes: (minutes) => {
    set({ autoLockMinutes: minutes });
    saveAllSettings();
  },
  applyAutoLockMinutes: (minutes) => {
    set({ autoLockMinutes: minutes });
  },
  setLockoutSeconds: (seconds) => set({ lockoutSeconds: seconds }),
}));
