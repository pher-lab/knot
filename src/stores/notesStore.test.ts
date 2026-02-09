import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/tauri";
import { useNotesStore } from "./notesStore";

// Mock the invoke function
vi.mock("@tauri-apps/api/tauri", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe("notesStore", () => {
  beforeEach(() => {
    // Reset store state
    useNotesStore.setState({
      notes: [],
      selectedNoteId: null,
      currentNote: null,
      searchQuery: "",
      isLoading: false,
      isSaving: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("loadNotes", () => {
    it("should load and sort notes by updated_at", async () => {
      const mockNotes = [
        { id: "1", title: "Note 1", created_at: "2024-01-01", updated_at: "2024-01-01" },
        { id: "2", title: "Note 2", created_at: "2024-01-02", updated_at: "2024-01-03" },
        { id: "3", title: "Note 3", created_at: "2024-01-01", updated_at: "2024-01-02" },
      ];
      mockInvoke.mockResolvedValueOnce(mockNotes);

      await useNotesStore.getState().loadNotes();

      const state = useNotesStore.getState();
      expect(state.notes[0].id).toBe("2"); // Most recent first
      expect(state.notes[1].id).toBe("3");
      expect(state.notes[2].id).toBe("1");
      expect(state.isLoading).toBe(false);
    });

    it("should handle errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Failed to load"));

      await useNotesStore.getState().loadNotes();

      const state = useNotesStore.getState();
      expect(state.error).toBe("Error: Failed to load");
      expect(state.isLoading).toBe(false);
    });
  });

  describe("selectNote", () => {
    it("should select and load a note", async () => {
      const mockNote = {
        id: "1",
        title: "Test Note",
        content: "Test content",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };
      mockInvoke.mockResolvedValueOnce(mockNote);

      await useNotesStore.getState().selectNote("1");

      const state = useNotesStore.getState();
      expect(state.selectedNoteId).toBe("1");
      expect(state.currentNote).toEqual(mockNote);
    });

    it("should clear selection when id is null", async () => {
      useNotesStore.setState({
        selectedNoteId: "1",
        currentNote: { id: "1", title: "Test", content: "", created_at: "", updated_at: "" },
      });

      await useNotesStore.getState().selectNote(null);

      const state = useNotesStore.getState();
      expect(state.selectedNoteId).toBeNull();
      expect(state.currentNote).toBeNull();
    });
  });

  describe("createNote", () => {
    it("should create a new note and select it", async () => {
      const mockNote = {
        id: "new-id",
        title: "Untitled",
        content: "",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };
      mockInvoke.mockResolvedValueOnce(mockNote);

      const id = await useNotesStore.getState().createNote();

      expect(id).toBe("new-id");
      const state = useNotesStore.getState();
      expect(state.selectedNoteId).toBe("new-id");
      expect(state.notes[0].id).toBe("new-id");
    });
  });

  describe("updateNote", () => {
    it("should update note and re-sort list", async () => {
      const initialNotes = [
        { id: "1", title: "Note 1", created_at: "2024-01-01", updated_at: "2024-01-01" },
        { id: "2", title: "Note 2", created_at: "2024-01-01", updated_at: "2024-01-02" },
      ];
      useNotesStore.setState({ notes: initialNotes, selectedNoteId: "1" });

      const updatedNote = {
        id: "1",
        title: "Updated Note 1",
        content: "Updated content",
        created_at: "2024-01-01",
        updated_at: "2024-01-03", // Now newest
      };
      mockInvoke.mockResolvedValueOnce(updatedNote);

      await useNotesStore.getState().updateNote("1", "Updated Note 1", "Updated content");

      const state = useNotesStore.getState();
      expect(state.notes[0].id).toBe("1"); // Now first due to newer updated_at
      expect(state.notes[0].title).toBe("Updated Note 1");
    });

    it("should not update currentNote if different note is selected", async () => {
      const currentNote = {
        id: "2",
        title: "Note 2",
        content: "Content 2",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };
      useNotesStore.setState({
        notes: [
          { id: "1", title: "Note 1", created_at: "2024-01-01", updated_at: "2024-01-01" },
          { id: "2", title: "Note 2", created_at: "2024-01-01", updated_at: "2024-01-01" },
        ],
        selectedNoteId: "2",
        currentNote,
      });

      const updatedNote = {
        id: "1",
        title: "Updated Note 1",
        content: "Updated content",
        created_at: "2024-01-01",
        updated_at: "2024-01-03",
      };
      mockInvoke.mockResolvedValueOnce(updatedNote);

      await useNotesStore.getState().updateNote("1", "Updated Note 1", "Updated content");

      const state = useNotesStore.getState();
      // currentNote should still be note 2
      expect(state.currentNote?.id).toBe("2");
    });
  });

  describe("deleteNote", () => {
    it("should remove note from list", async () => {
      useNotesStore.setState({
        notes: [
          { id: "1", title: "Note 1", created_at: "2024-01-01", updated_at: "2024-01-01" },
          { id: "2", title: "Note 2", created_at: "2024-01-01", updated_at: "2024-01-01" },
        ],
        selectedNoteId: "1",
      });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useNotesStore.getState().deleteNote("1");

      const state = useNotesStore.getState();
      expect(state.notes.length).toBe(1);
      expect(state.notes[0].id).toBe("2");
      expect(state.selectedNoteId).toBeNull();
    });
  });

  describe("findNoteByTitle", () => {
    it("should find note by title (case-insensitive)", () => {
      useNotesStore.setState({
        notes: [
          { id: "1", title: "My Note", created_at: "2024-01-01", updated_at: "2024-01-01" },
          { id: "2", title: "Another Note", created_at: "2024-01-01", updated_at: "2024-01-01" },
        ],
      });

      const found = useNotesStore.getState().findNoteByTitle("my note");
      expect(found?.id).toBe("1");
    });

    it("should return undefined if not found", () => {
      useNotesStore.setState({
        notes: [
          { id: "1", title: "My Note", created_at: "2024-01-01", updated_at: "2024-01-01" },
        ],
      });

      const found = useNotesStore.getState().findNoteByTitle("nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("navigateToNoteByTitle", () => {
    it("should navigate to existing note", async () => {
      const existingNote = {
        id: "1",
        title: "Existing Note",
        content: "Content",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };
      useNotesStore.setState({
        notes: [
          { id: "1", title: "Existing Note", created_at: "2024-01-01", updated_at: "2024-01-01" },
        ],
      });
      mockInvoke.mockResolvedValueOnce(existingNote);

      await useNotesStore.getState().navigateToNoteByTitle("Existing Note");

      const state = useNotesStore.getState();
      expect(state.selectedNoteId).toBe("1");
    });

    it("should create new note if not found", async () => {
      useNotesStore.setState({ notes: [] });
      const newNote = {
        id: "new-id",
        title: "New Note",
        content: "",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      };
      mockInvoke.mockResolvedValueOnce(newNote);

      await useNotesStore.getState().navigateToNoteByTitle("New Note");

      const state = useNotesStore.getState();
      expect(state.selectedNoteId).toBe("new-id");
      expect(state.notes[0].title).toBe("New Note");
    });
  });

  describe("reset", () => {
    it("should reset all state", () => {
      useNotesStore.setState({
        notes: [{ id: "1", title: "Note", created_at: "", updated_at: "" }],
        selectedNoteId: "1",
        currentNote: { id: "1", title: "Note", content: "", created_at: "", updated_at: "" },
        searchQuery: "test",
        isLoading: true,
        isSaving: true,
        error: "Some error",
      });

      useNotesStore.getState().reset();

      const state = useNotesStore.getState();
      expect(state.notes).toEqual([]);
      expect(state.selectedNoteId).toBeNull();
      expect(state.currentNote).toBeNull();
      expect(state.searchQuery).toBe("");
      expect(state.isLoading).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
