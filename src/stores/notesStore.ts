import { create } from "zustand";
import * as api from "../lib/api";
import type { NoteListItem, NoteResponse } from "../lib/api";

interface PendingSave {
  id: string;
  title: string;
  content: string;
}

interface NotesState {
  notes: NoteListItem[];
  selectedNoteId: string | null;
  currentNote: NoteResponse | null;
  searchQuery: string;
  isLoading: boolean;
  isLoadingNote: boolean;
  isSaving: boolean;
  pendingSave: PendingSave | null;
  error: string | null;

  // Actions
  loadNotes: () => Promise<void>;
  selectNote: (id: string | null) => Promise<void>;
  createNote: () => Promise<string | null>;
  createNoteWithTitle: (title: string) => Promise<string | null>;
  updateNote: (id: string, title: string, content: string) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  search: (query: string) => Promise<void>;
  clearSearch: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
  // Pending save management
  setPendingSave: (data: PendingSave | null) => void;
  flushPendingSave: () => Promise<void>;
  // Wiki link helpers
  findNoteByTitle: (title: string) => NoteListItem | undefined;
  navigateToNoteByTitle: (title: string) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  currentNote: null,
  searchQuery: "",
  isLoading: false,
  isLoadingNote: false,
  isSaving: false,
  pendingSave: null,
  error: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await api.listNotes();
      // Sort by updated_at descending
      notes.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      set({ notes, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  selectNote: async (id) => {
    if (id === null) {
      set({ selectedNoteId: null, currentNote: null });
      return;
    }

    set({ isLoadingNote: true, error: null });
    try {
      const note = await api.getNote(id);
      set({ selectedNoteId: id, currentNote: note, isLoadingNote: false });
    } catch (e) {
      set({ error: String(e), isLoadingNote: false });
    }
  },

  createNote: async () => {
    set({ isSaving: true, error: null });
    try {
      const note = await api.createNote("", "");
      const { notes } = get();
      const newItem: NoteListItem = {
        id: note.id,
        title: note.title,
        created_at: note.created_at,
        updated_at: note.updated_at,
      };
      set({
        notes: [newItem, ...notes],
        selectedNoteId: note.id,
        currentNote: note,
        isSaving: false,
      });
      return note.id;
    } catch (e) {
      set({ error: String(e), isSaving: false });
      return null;
    }
  },

  updateNote: async (id, title, content) => {
    set({ isSaving: true, error: null });
    try {
      const note = await api.updateNote(id, title, content);
      const { notes, selectedNoteId } = get();
      const updatedNotes = notes.map((n) =>
        n.id === id
          ? { ...n, title: note.title, updated_at: note.updated_at }
          : n
      );
      // Re-sort by updated_at
      updatedNotes.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      set({
        notes: updatedNotes,
        // Only update currentNote if we're still viewing the same note
        currentNote: selectedNoteId === id ? note : get().currentNote,
        isSaving: false,
      });
      return true;
    } catch (e) {
      set({ error: String(e), isSaving: false });
      return false;
    }
  },

  deleteNote: async (id) => {
    set({ isSaving: true, error: null });
    try {
      await api.deleteNote(id);
      const { notes, selectedNoteId } = get();
      const filteredNotes = notes.filter((n) => n.id !== id);
      set({
        notes: filteredNotes,
        selectedNoteId: selectedNoteId === id ? null : selectedNoteId,
        currentNote: selectedNoteId === id ? null : get().currentNote,
        isSaving: false,
      });
      return true;
    } catch (e) {
      set({ error: String(e), isSaving: false });
      return false;
    }
  },

  search: async (query) => {
    set({ searchQuery: query, isLoading: true, error: null });
    try {
      const notes = await api.searchNotes(query);
      notes.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      set({ notes, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  clearSearch: async () => {
    set({ searchQuery: "" });
    await get().loadNotes();
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      notes: [],
      selectedNoteId: null,
      currentNote: null,
      searchQuery: "",
      isLoading: false,
      isLoadingNote: false,
      isSaving: false,
      pendingSave: null,
      error: null,
    }),

  setPendingSave: (data) => set({ pendingSave: data }),

  flushPendingSave: async () => {
    const { pendingSave, updateNote } = get();
    if (pendingSave) {
      set({ pendingSave: null });
      await updateNote(pendingSave.id, pendingSave.title, pendingSave.content);
    }
  },

  // Wiki link helpers
  findNoteByTitle: (title: string) => {
    const { notes } = get();
    // Case-insensitive search, returns first match
    const lowerTitle = title.toLowerCase();
    return notes.find((n) => n.title.toLowerCase() === lowerTitle);
  },

  createNoteWithTitle: async (title: string) => {
    set({ isSaving: true, error: null });
    try {
      const note = await api.createNote(title, "");
      const { notes } = get();
      const newItem: NoteListItem = {
        id: note.id,
        title: note.title,
        created_at: note.created_at,
        updated_at: note.updated_at,
      };
      set({
        notes: [newItem, ...notes],
        selectedNoteId: note.id,
        currentNote: note,
        isSaving: false,
      });
      return note.id;
    } catch (e) {
      set({ error: String(e), isSaving: false });
      return null;
    }
  },

  navigateToNoteByTitle: async (title: string) => {
    const { findNoteByTitle, selectNote, createNoteWithTitle } = get();
    const existingNote = findNoteByTitle(title);

    if (existingNote) {
      await selectNote(existingNote.id);
    } else {
      // Note doesn't exist - create it
      await createNoteWithTitle(title);
    }
  },
}));
