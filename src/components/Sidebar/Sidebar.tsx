import { useEffect, useState, useRef } from "react";
import { open } from "@tauri-apps/api/dialog";
import { useNotesStore } from "../../stores/notesStore";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore, Theme } from "../../stores/themeStore";
import { useLanguageStore, Language } from "../../stores/languageStore";
import { useFontSizeStore, FontSize } from "../../stores/fontSizeStore";
import { useSortModeStore, SortMode } from "../../stores/sortModeStore";
import { useTranslation } from "../../i18n";
import { getWelcomeNote } from "../../lib/welcomeNote";
import * as api from "../../lib/api";
import { NoteList } from "./NoteList";
import { SearchBar } from "./SearchBar";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ConfirmDialog } from "../ConfirmDialog";

export function Sidebar() {
  const { loadNotes, createNote, selectNote, notes, isLoading, viewMode, trashCount, setViewMode, emptyTrash } = useNotesStore();
  const { lock, autoLockMinutes, setAutoLockMinutes } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { fontSize, setFontSize } = useFontSizeStore();
  const { sortMode, setSortMode, sortDirection, toggleSortDirection } = useSortModeStore();
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showRestoreWelcome, setShowRestoreWelcome] = useState(false);
  const [showEmptyTrash, setShowEmptyTrash] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside the buttons group
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonsRef.current && !buttonsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
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
      // Clear tag filter so imported notes are visible
      useNotesStore.getState().filterByTag(null);
      await loadNotes();
      // Auto-select the most recently imported note (first in sorted list)
      const { notes: updatedNotes } = useNotesStore.getState();
      if (updatedNotes.length > 0) {
        await selectNote(updatedNotes[0].id);
      }
      setShowActions(false);
      alert(t("import.success", { n: count }));
    } catch {
      alert(t("import.error"));
    }
  };

  const handleRestoreWelcome = () => {
    setShowActions(false);
    setShowRestoreWelcome(true);
  };

  const handleConfirmRestoreWelcome = async () => {
    setShowRestoreWelcome(false);
    try {
      const lang = useLanguageStore.getState().resolvedLanguage;
      const welcome = getWelcomeNote(lang);
      // Delete existing welcome note if present
      const existing = useNotesStore.getState().findNoteByTitle(welcome.title);
      if (existing) {
        await useNotesStore.getState().deleteNote(existing.id);
      }
      await api.createNote(welcome.title, welcome.content);
      await loadNotes();
      // Auto-select the restored welcome note
      const restored = useNotesStore.getState().findNoteByTitle(welcome.title);
      if (restored) {
        await selectNote(restored.id);
      }
    } catch {
      // Non-critical
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
          <div className="flex items-center gap-1 relative" ref={buttonsRef}>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowActions(false); }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
              title={t("sidebar.settings")}
            >
              <SettingsIcon />
            </button>
            <button
              onClick={() => { setShowActions(!showActions); setShowSettings(false); }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
              title={t("sidebar.import")}
            >
              <MoreIcon />
            </button>
            <button
              onClick={() => setViewMode(viewMode === "trash" ? "notes" : "trash")}
              className={`relative p-1.5 rounded transition-colors ${
                viewMode === "trash"
                  ? "text-red-500 dark:text-red-400 bg-gray-300 dark:bg-gray-700"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700"
              }`}
              title={t("sidebar.trash")}
            >
              <TrashSidebarIcon />
              {trashCount > 0 && viewMode !== "trash" && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 text-[9px] font-medium leading-3.5 text-center text-gray-500 dark:text-gray-400 bg-gray-300 dark:bg-gray-600 rounded-full">
                  {trashCount > 99 ? "99+" : trashCount}
                </span>
              )}
            </button>
            <button
              onClick={lock}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
              title={t("sidebar.lock")}
            >
              <LockIcon />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-2 z-10 border border-gray-200 dark:border-gray-600">
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
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
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
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("sidebar.fontSize")}</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as FontSize)}
                    className="w-full bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-500 focus:outline-none focus:border-blue-500"
                  >
                    <option value="small">{t("sidebar.fontSmall")}</option>
                    <option value="medium">{t("sidebar.fontMedium")}</option>
                    <option value="large">{t("sidebar.fontLarge")}</option>
                  </select>
                </div>
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t("sidebar.sort")}</label>
                  <div className="flex gap-1">
                    <select
                      value={sortMode}
                      onChange={(e) => { setSortMode(e.target.value as SortMode); loadNotes(); }}
                      className="flex-1 bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white text-sm rounded px-2 py-1 border border-gray-300 dark:border-gray-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value="updated">{t("sort.updated")}</option>
                      <option value="created">{t("sort.created")}</option>
                      <option value="title">{t("sort.title")}</option>
                    </select>
                    <button
                      onClick={() => { toggleSortDirection(); loadNotes(); }}
                      className="px-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded border border-gray-300 dark:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      title={sortDirection === "desc" ? t("sort.descending") : t("sort.ascending")}
                    >
                      {sortDirection === "desc" ? "↓" : "↑"}
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <button
                    onClick={() => { setShowChangePassword(true); setShowSettings(false); }}
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {t("changePassword.title")}
                  </button>
                </div>
              </div>
            )}
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-600">
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
                <div className="border-t border-gray-200 dark:border-gray-600" />
                <button
                  onClick={handleRestoreWelcome}
                  className="w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 px-3 py-2 transition-colors"
                >
                  {t("sidebar.restoreWelcome")}
                </button>
              </div>
            )}
          </div>
        </div>
        {viewMode === "notes" && (
          <button
            onClick={handleCreateNote}
            disabled={isCreating}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isCreating ? t("sidebar.creating") : t("sidebar.newNote")}
          </button>
        )}
        {viewMode === "trash" && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("sidebar.trash")}</span>
            <button
              onClick={() => setShowEmptyTrash(true)}
              disabled={notes.length === 0}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("sidebar.emptyTrash")}
            </button>
          </div>
        )}
      </div>

      {/* Search (notes mode only) */}
      {viewMode === "notes" && (
        <div className="p-3 border-b border-gray-300 dark:border-gray-700">
          <SearchBar />
        </div>
      )}

      {/* Tag Filter (notes mode only) */}
      {viewMode === "notes" && <TagFilter />}

      {/* Note List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">{t("sidebar.loading")}</div>
        ) : notes.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {viewMode === "trash" ? t("sidebar.noTrash") : t("sidebar.noNotes")}
          </div>
        ) : (
          <NoteList />
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
      {showEmptyTrash && (
        <ConfirmDialog
          title={t("confirm.emptyTrashTitle")}
          message={t("confirm.emptyTrashMessage")}
          confirmLabel={t("confirm.emptyTrash")}
          cancelLabel={t("confirm.cancel")}
          variant="danger"
          onConfirm={async () => { setShowEmptyTrash(false); await emptyTrash(); }}
          onCancel={() => setShowEmptyTrash(false)}
        />
      )}
      {showRestoreWelcome && (
        <ConfirmDialog
          title={t("confirm.restoreWelcomeTitle")}
          message={t("confirm.restoreWelcomeMessage")}
          confirmLabel={t("confirm.restoreWelcome")}
          cancelLabel={t("confirm.cancel")}
          onConfirm={handleConfirmRestoreWelcome}
          onCancel={() => setShowRestoreWelcome(false)}
        />
      )}
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

function TrashSidebarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function TagFilter() {
  const { allTags, selectedTag, filterByTag } = useNotesStore();

  if (allTags.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b border-gray-300 dark:border-gray-700">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => filterByTag(selectedTag === tag ? null : tag)}
            className={`shrink-0 px-2 py-0.5 text-xs rounded-full transition-colors ${
              selectedTag === tag
                ? "bg-blue-500 text-white"
                : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-600"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
