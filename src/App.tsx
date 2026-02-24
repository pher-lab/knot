import { useEffect } from "react";
import { useAuthStore } from "./stores/authStore";
import { useNotesStore } from "./stores/notesStore";
import { useThemeStore } from "./stores/themeStore";
import { useLanguageStore } from "./stores/languageStore";
import { useFontSizeStore, FontSize } from "./stores/fontSizeStore";
import { useAutoLock } from "./hooks/useAutoLock";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTranslation } from "./i18n";
import * as api from "./lib/api";
import {
  SetupScreen,
  UnlockScreen,
  RecoveryScreen,
  RecoveryKeyModal,
} from "./components/Auth";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";

function App() {
  const { screen, initialize } = useAuthStore();
  const resetNotes = useNotesStore((s) => s.reset);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  // Apply theme class to document with smooth transition
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.getBoundingClientRect(); // Force reflow so transition fires before dark class changes
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    const timer = setTimeout(() => root.classList.remove("theme-transitioning"), 200);
    return () => clearTimeout(timer);
  }, [resolvedTheme]);

  // Auto-lock on inactivity
  useAutoLock();

  // Keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    const start = async () => {
      // Load persisted settings, vault check, and system theme in parallel
      const settingsPromise = api.loadSettings().catch(() => null);
      const initPromise = initialize();
      const themePromise = useThemeStore.getState().initSystemTheme();

      const [settings] = await Promise.all([settingsPromise, initPromise, themePromise]);

      if (settings) {
        if (settings.theme) {
          useThemeStore.getState().applyTheme(settings.theme as "light" | "dark" | "system");
        }
        if (settings.language) {
          useLanguageStore.getState().applyLanguage(settings.language as "ja" | "en" | "system");
        }
        if (settings.auto_lock_minutes !== undefined && settings.auto_lock_minutes !== null) {
          useAuthStore.getState().applyAutoLockMinutes(settings.auto_lock_minutes);
        }
        if (settings.font_size) {
          useFontSizeStore.getState().applyFontSize(settings.font_size as FontSize);
        }
      }
    };
    start();
  }, [initialize]);

  // Reset notes when locked
  useEffect(() => {
    if (screen !== "unlocked") {
      resetNotes();
    }
  }, [screen, resetNotes]);

  return (
    <>
      {screen === "loading" && <LoadingScreen />}
      {screen === "setup" && <SetupScreen />}
      {screen === "unlock" && <UnlockScreen />}
      {screen === "recovery" && <RecoveryScreen />}
      {screen === "unlocked" && <MainScreen />}
      <RecoveryKeyModal />
    </>
  );
}

function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Knot</h1>
        <p className="text-gray-500 dark:text-gray-400">{t("app.loading")}</p>
      </div>
    </div>
  );
}

function MainScreen() {
  const noteError = useNotesStore((s) => s.error);
  const clearNoteError = useNotesStore((s) => s.clearError);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col relative">
        {noteError && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-red-100 dark:bg-red-900/80 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span>{noteError}</span>
            <button
              onClick={clearNoteError}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300 font-bold"
            >
              &times;
            </button>
          </div>
        )}
        <Editor />
      </div>
    </div>
  );
}

export default App;
