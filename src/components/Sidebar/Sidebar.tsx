import { useEffect, useState, useRef } from "react";
import { open } from "@tauri-apps/api/dialog";
import { useNotesStore } from "../../stores/notesStore";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore, Theme } from "../../stores/themeStore";
import { useLanguageStore, Language } from "../../stores/languageStore";
import { useTranslation } from "../../i18n";
import * as api from "../../lib/api";
import { NoteList } from "./NoteList";
import { SearchBar } from "./SearchBar";

export function Sidebar() {
  const { loadNotes, createNote, notes, isLoading } = useNotesStore();
  const { lock, autoLockMinutes, setAutoLockMinutes } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    if (showSettings || showActions) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSettings, showActions]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleCreateNote = async () => {
    setIsCreating(true);
    await createNote();
    setIsCreating(false);
  };

  const handleImport = async () => {
    try {
      const files = await open({
        multiple: true,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!files) return;
      const filePaths = Array.isArray(files) ? files : [files];
      if (filePaths.length === 0) return;
      const count = await api.importNotes(filePaths);
      await loadNotes();
      setShowActions(false);
      alert(t("import.success", { n: count }));
    } catch {
      alert(t("import.error"));
    }
  };

  const handleExportAll = async () => {
    if (notes.length === 0) {
      alert(t("export.noNotes"));
      return;
    }
    try {
      const dir = await open({ directory: true });
      if (!dir || Array.isArray(dir)) return;
      const count = await api.exportAllNotes(dir);
      setShowActions(false);
      alert(t("export.successCount", { n: count }));
    } catch {
      alert(t("export.error"));
    }
  };

  return (
    <div className="w-64 bg-gray-200 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Knot</h1>
          <div className="flex items-center gap-1">
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => { setShowSettings(!showSettings); setShowActions(false); }}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                title={t("sidebar.settings")}
              >
                <SettingsIcon />
              </button>
              {showSettings && (
                <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-2 z-10 border border-gray-200 dark:border-gray-600">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("sidebar.theme")}</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as Theme)}
                      className="w-full bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value="system">{t("sidebar.themeSystem")}</option>
                      <option value="light">{t("sidebar.themeLight")}</option>
                      <option value="dark">{t("sidebar.themeDark")}</option>
                    </select>
                  </div>
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("sidebar.autoLock")}</label>
                    <select
                      value={autoLockMinutes}
                      onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                      className="w-full bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value={0}>{t("sidebar.autoLockDisabled")}</option>
                      <option value={1}>{t("sidebar.autoLockMinutes", { n: 1 })}</option>
                      <option value={5}>{t("sidebar.autoLockMinutes", { n: 5 })}</option>
                      <option value={10}>{t("sidebar.autoLockMinutes", { n: 10 })}</option>
                      <option value={15}>{t("sidebar.autoLockMinutes", { n: 15 })}</option>
                      <option value={30}>{t("sidebar.autoLockMinutes", { n: 30 })}</option>
                    </select>
                  </div>
                  <div className="px-3 py-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("sidebar.language")}</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="w-full bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value="system">{t("sidebar.languageSystem")}</option>
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={actionsRef}>
              <button
                onClick={() => { setShowActions(!showActions); setShowSettings(false); }}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
                title={t("sidebar.import")}
              >
                <MoreIcon />
              </button>
              {showActions && (
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-600">
                  <button
                    onClick={handleImport}
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 px-3 py-2 transition-colors"
                  >
                    {t("sidebar.import")}
                  </button>
                  <button
                    onClick={handleExportAll}
                    disabled={notes.length === 0}
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t("sidebar.exportAll")}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={lock}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
              title={t("sidebar.lock")}
            >
              <LockIcon />
            </button>
          </div>
        </div>
        <button
          onClick={handleCreateNote}
          disabled={isCreating}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isCreating ? t("sidebar.creating") : t("sidebar.newNote")}
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-300 dark:border-gray-700">
        <SearchBar />
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">{t("sidebar.loading")}</div>
        ) : notes.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">{t("sidebar.noNotes")}</div>
        ) : (
          <NoteList />
        )}
      </div>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
