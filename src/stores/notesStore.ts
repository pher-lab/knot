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
  allTags: string[];
  selectedTag: string | null;

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
  // Pin
  togglePin: (id: string) => Promise<void>;
  // Wiki link helpers
  findNoteByTitle: (title: string) => NoteListItem | undefined;
  navigateToNoteByTitle: (title: string) => Promise<void>;
  // Tags
  setNoteTags: (id: string, tags: string[]) => Promise<void>;
  loadAllTags: () => Promise<void>;
  filterByTag: (tag: string | null) => void;
}

function sortNotes(notes: NoteListItem[]) {
  notes.sort((a, b) => {
    // Pinned notes first
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    // Then by updated_at descending
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
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
  allTags: [],
  selectedTag: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await api.listNotes();
      sortNotes(notes);
      set({ notes, isLoading: false });
      get().loadAllTags();
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
        pinned: false,
        tags: [],
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
          ? { ...n, title: note.title, updated_at: note.updated_at, tags: note.tags }
          : n
      );
      sortNotes(updatedNotes);
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
      get().loadAllTags();
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
      sortNotes(notes);
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
      allTags: [],
      selectedTag: null,
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

  togglePin: async (id: string) => {
    try {
      const newPinned = await api.togglePinNote(id);
      const { notes } = get();
      const updatedNotes = notes.map((n) =>
        n.id === id ? { ...n, pinned: newPinned } : n
      );
      sortNotes(updatedNotes);
      set({ notes: updatedNotes });
    } catch (e) {
      set({ error: String(e) });
    }
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
        pinned: false,
        tags: [],
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

  setNoteTags: async (id: string, tags: string[]) => {
    try {
      const savedTags = await api.setNoteTags(id, tags);
      const { notes, currentNote } = get();
      const updatedNotes = notes.map((n) =>
        n.id === id ? { ...n, tags: savedTags } : n
      );
      set({
        notes: updatedNotes,
        currentNote:
          currentNote && currentNote.id === id
            ? { ...currentNote, tags: savedTags }
            : currentNote,
      });
      get().loadAllTags();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadAllTags: async () => {
    try {
      const allTags = await api.listAllTags();
      const { selectedTag } = get();
      set({
        allTags,
        selectedTag: selectedTag && !allTags.includes(selectedTag) ? null : selectedTag,
      });
    } catch {
      // Non-critical, don't set error
    }
  },

  filterByTag: (tag: string | null) => {
    set({ selectedTag: tag });
  },
}));
