import { useState, useEffect, useRef } from "react";
import { save } from "@tauri-apps/api/dialog";
import { useNotesStore } from "../../stores/notesStore";
import { useTranslation } from "../../i18n";
import { useLanguageStore } from "../../stores/languageStore";
import { ConfirmDialog } from "../ConfirmDialog";
import * as api from "../../lib/api";

interface ContextMenuState {
  noteId: string;
  pinned: boolean;
  x: number;
  y: number;
}

export function NoteList() {
  const { notes, selectedNoteId, selectNote, deleteNote, selectedTag } = useNotesStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const { t } = useTranslation();
  const filteredNotes = selectedTag
    ? notes.filter((n) => n.tags.includes(selectedTag))
    : notes;

  const handleConfirmDelete = async () => {
    if (deleteNoteId) {
      await deleteNote(deleteNoteId);
      setDeleteNoteId(null);
    }
  };

  if (filteredNotes.length === 0 && selectedTag) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        {t("tags.noTaggedNotes")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {filteredNotes.map((note) => (
        <NoteItem
          key={note.id}
          id={note.id}
          title={note.title}
          updatedAt={note.updated_at}
          pinned={note.pinned}
          tags={note.tags}
          isSelected={note.id === selectedNoteId}
          onSelect={() => selectNote(note.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              noteId: note.id,
              pinned: note.pinned,
              x: e.clientX,
              y: e.clientY,
            });
          }}
        />
      ))}
      {contextMenu && (
        <NoteContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
          onRequestDelete={(id) => setDeleteNoteId(id)}
        />
      )}
      {deleteNoteId && (
        <ConfirmDialog
          title={t("confirm.deleteNoteTitle")}
          message={t("confirm.deleteNoteMessage")}
          confirmLabel={t("confirm.deleteNote")}
          cancelLabel={t("confirm.cancel")}
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteNoteId(null)}
        />
      )}
    </div>
  );
}

interface NoteItemProps {
  id: string;
  title: string;
  updatedAt: string;
  pinned: boolean;
  tags: string[];
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function NoteItem({ title, updatedAt, pinned, tags, isSelected, onSelect, onContextMenu }: NoteItemProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.resolvedLanguage);
  const formattedDate = formatDate(updatedAt, t, language);

  return (
    <button
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
        isSelected
          ? "bg-gray-300 dark:bg-gray-700"
          : "hover:bg-gray-300/50 dark:hover:bg-gray-700/50"
      }`}
    >
      <div className="flex items-center gap-1">
        {pinned && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500 dark:text-gray-400 shrink-0">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        )}
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {title || t("noteList.untitled")}
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{formattedDate}</div>
      {tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0 text-[10px] rounded-full bg-gray-300/70 dark:bg-gray-600/70 text-gray-600 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

interface NoteContextMenuProps {
  noteId: string;
  pinned: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onRequestDelete: (id: string) => void;
}

function NoteContextMenu({ noteId, pinned, x, y, onClose, onRequestDelete }: NoteContextMenuProps) {
  const { togglePin, selectNote } = useNotesStore();
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: x,
    top: y,
    zIndex: 50,
  };

  const handlePin = async () => {
    await togglePin(noteId);
    onClose();
  };

  const handleExport = async () => {
    onClose();
    try {
      await selectNote(noteId);
      const note = useNotesStore.getState().currentNote;
      if (!note) return;
      const noteTitle = note.title || "Untitled";
      const path = await save({
        defaultPath: `${noteTitle}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await api.exportNote(noteId, path);
      alert(t("export.success"));
    } catch {
      alert(t("export.error"));
    }
  };

  const handleDelete = () => {
    onClose();
    onRequestDelete(noteId);
  };

  return (
    <div ref={menuRef} style={style} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]">
      <button
        onClick={handlePin}
        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {pinned ? t("contextMenu.unpin") : t("contextMenu.pin")}
      </button>
      <button
        onClick={handleExport}
        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {t("contextMenu.export")}
      </button>
      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
      <button
        onClick={handleDelete}
        className="w-full px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {t("contextMenu.delete")}
      </button>
    </div>
  );
}

function formatDate(
  isoString: string,
  t: (key: Parameters<ReturnType<typeof useTranslation>["t"]>[0], params?: Record<string, string | number>) => string,
  language: string,
): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("noteList.justNow");
  if (minutes < 60) return t("noteList.minutesAgo", { n: minutes });
  if (hours < 24) return t("noteList.hoursAgo", { n: hours });
  if (days < 7) return t("noteList.daysAgo", { n: days });

  const locale = language === "ja" ? "ja-JP" : "en-US";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
