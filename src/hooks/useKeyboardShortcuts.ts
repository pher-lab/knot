import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { useNotesStore } from "../stores/notesStore";

export function useKeyboardShortcuts() {
  const screen = useAuthStore((s) => s.screen);
  const lock = useAuthStore((s) => s.lock);
  const createNote = useNotesStore((s) => s.createNote);

  useEffect(() => {
    // Only enable shortcuts when unlocked
    if (screen !== "unlocked") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Ctrl+L: Lock (works even when typing)
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        lock();
        return;
      }

      // Ctrl+N: New note (works in editor, blocked only in input/textarea)
      if (e.ctrlKey && e.key === "n") {
        if (isTextInput) return;
        e.preventDefault();
        createNote();
        return;
      }

      // Ctrl+F: Focus search (works in editor, blocked only in input/textarea)
      if (e.ctrlKey && e.key === "f") {
        if (isTextInput) return;
        e.preventDefault();
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
          searchInput.focus();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, lock, createNote]);
}
