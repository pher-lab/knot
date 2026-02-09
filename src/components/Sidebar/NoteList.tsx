import { useNotesStore } from "../../stores/notesStore";
import { useTranslation } from "../../i18n";
import { useLanguageStore } from "../../stores/languageStore";

export function NoteList() {
  const { notes, selectedNoteId, selectNote } = useNotesStore();

  return (
    <div className="flex flex-col gap-1 p-2">
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          id={note.id}
          title={note.title}
          updatedAt={note.updated_at}
          isSelected={note.id === selectedNoteId}
          onSelect={() => selectNote(note.id)}
        />
      ))}
    </div>
  );
}

interface NoteItemProps {
  id: string;
  title: string;
  updatedAt: string;
  isSelected: boolean;
  onSelect: () => void;
}

function NoteItem({ title, updatedAt, isSelected, onSelect }: NoteItemProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.resolvedLanguage);
  const formattedDate = formatDate(updatedAt, t, language);

  return (
    <button
      onClick={onSelect}
      className={`w-full px-3 py-2 text-left rounded-lg transition-colors ${
        isSelected
          ? "bg-gray-300 dark:bg-gray-700"
          : "hover:bg-gray-300/50 dark:hover:bg-gray-700/50"
      }`}
    >
      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {title || t("noteList.untitled")}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{formattedDate}</div>
    </button>
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
