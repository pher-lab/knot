import { useEffect, useRef, useState, useCallback } from "react";
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { markdown, deleteMarkupBackward } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { save } from "@tauri-apps/api/dialog";
import { useNotesStore } from "../../stores/notesStore";
import { useThemeStore } from "../../stores/themeStore";
import { useTranslation } from "../../i18n";
import * as api from "../../lib/api";
import { wikilink } from "./wikilink";
import { Toolbar } from "./Toolbar";

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
  },
  ".cm-content": {
    fontFamily: "'Noto Sans JP', sans-serif",
    padding: "16px 24px",
    minHeight: "100%",
  },
  ".cm-line": {
    padding: "2px 0",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-placeholder": {
    color: "#6b7280",
  },
});

const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#f9fafb",
      color: "#111827",
    },
    ".cm-gutters": {
      backgroundColor: "#f9fafb",
      borderRight: "none",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#111827",
    },
  },
  { dark: false }
);

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#111827",
      color: "#e5e7eb",
    },
    ".cm-gutters": {
      backgroundColor: "#111827",
      borderRight: "none",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "#fff",
    },
  },
  { dark: true }
);

// Markdown syntax highlighting styles for light theme
const lightHighlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, fontSize: "1.6em", fontWeight: "bold", color: "#111827" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "bold", color: "#1f2937" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "bold", color: "#374151" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "bold", color: "#4b5563" },
  { tag: tags.heading5, fontSize: "1.05em", fontWeight: "bold", color: "#6b7280" },
  { tag: tags.heading6, fontSize: "1em", fontWeight: "bold", color: "#9ca3af" },
  // Emphasis
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#9ca3af" },
  // Code
  { tag: tags.monospace, fontFamily: "monospace", backgroundColor: "#e5e7eb", borderRadius: "3px", padding: "1px 4px" },
  // Links
  { tag: tags.link, color: "#2563eb", textDecoration: "underline" },
  { tag: tags.url, color: "#6b7280" },
  // Quote
  { tag: tags.quote, color: "#6b7280", fontStyle: "italic" },
  // List markers
  { tag: tags.list, color: "#6b7280" },
  // Markup characters (*, **, _, etc.)
  { tag: tags.processingInstruction, color: "#9ca3af" },
]);

// Markdown syntax highlighting styles for dark theme
const darkHighlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, fontSize: "1.6em", fontWeight: "bold", color: "#f9fafb" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "bold", color: "#f3f4f6" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "bold", color: "#e5e7eb" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "bold", color: "#d1d5db" },
  { tag: tags.heading5, fontSize: "1.05em", fontWeight: "bold", color: "#9ca3af" },
  { tag: tags.heading6, fontSize: "1em", fontWeight: "bold", color: "#6b7280" },
  // Emphasis
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#6b7280" },
  // Code
  { tag: tags.monospace, fontFamily: "monospace", backgroundColor: "#374151", borderRadius: "3px", padding: "1px 4px" },
  // Links
  { tag: tags.link, color: "#60a5fa", textDecoration: "underline" },
  { tag: tags.url, color: "#9ca3af" },
  // Quote
  { tag: tags.quote, color: "#9ca3af", fontStyle: "italic" },
  // List markers
  { tag: tags.list, color: "#9ca3af" },
  // Markup characters (*, **, _, etc.)
  { tag: tags.processingInstruction, color: "#6b7280" },
]);

const themeCompartment = new Compartment();
const highlightCompartment = new Compartment();
const placeholderCompartment = new Compartment();

// Custom Enter handler for Markdown lists that avoids library's renumbering bugs
function customListEnter(view: EditorView): boolean {
  // Skip during IME composition
  if (view.composing) {
    return false;
  }

  const { state } = view;
  const { from, to } = state.selection.main;

  // Only handle when cursor is a single point (no selection)
  if (from !== to) {
    return false;
  }

  const line = state.doc.lineAt(from);
  const lineText = line.text;
  const cursorInLine = from - line.from;

  // Ordered list: "  1. content" or "  1) content"
  const orderedMatch = /^(\s*)(\d+)([.)]\s*)(.*)$/.exec(lineText);
  if (orderedMatch) {
    const [, indent, num, marker, content] = orderedMatch;
    const markerEnd = indent.length + num.length + marker.length;

    // If cursor is at end and content is empty, remove list marker
    if (cursorInLine >= markerEnd && content.trim() === "") {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: EditorSelection.cursor(line.from),
      });
      return true;
    }

    // If cursor is after marker, continue the list
    if (cursorInLine >= markerEnd) {
      const nextNum = parseInt(num, 10) + 1;
      const newMarker = `\n${indent}${nextNum}${marker}`;
      view.dispatch({
        changes: { from, insert: newMarker },
        selection: EditorSelection.cursor(from + newMarker.length),
        scrollIntoView: true,
      });
      return true;
    }
  }

  // Unordered list: "  - content" or "  * content" or "  + content"
  const unorderedMatch = /^(\s*)([-*+]\s+)(.*)$/.exec(lineText);
  if (unorderedMatch) {
    const [, indent, marker, content] = unorderedMatch;
    const markerEnd = indent.length + marker.length;

    // If cursor is at end and content is empty, remove list marker
    if (cursorInLine >= markerEnd && content.trim() === "") {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: EditorSelection.cursor(line.from),
      });
      return true;
    }

    // If cursor is after marker, continue the list
    if (cursorInLine >= markerEnd) {
      const newMarker = `\n${indent}${marker}`;
      view.dispatch({
        changes: { from, insert: newMarker },
        selection: EditorSelection.cursor(from + newMarker.length),
        scrollIntoView: true,
      });
      return true;
    }
  }

  // Task list: "  - [ ] content" or "  - [x] content"
  const taskMatch = /^(\s*)([-*+]\s+\[[ xX]\]\s*)(.*)$/.exec(lineText);
  if (taskMatch) {
    const [, indent, marker, content] = taskMatch;
    const markerEnd = indent.length + marker.length;
    // Normalize to unchecked checkbox
    const baseMarker = marker.replace(/\[[xX]\]/, "[ ]");

    if (cursorInLine >= markerEnd && content.trim() === "") {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: EditorSelection.cursor(line.from),
      });
      return true;
    }

    if (cursorInLine >= markerEnd) {
      const newMarker = `\n${indent}${baseMarker}`;
      view.dispatch({
        changes: { from, insert: newMarker },
        selection: EditorSelection.cursor(from + newMarker.length),
        scrollIntoView: true,
      });
      return true;
    }
  }

  // Blockquote: "> content"
  const blockquoteMatch = /^(\s*>+\s*)(.*)$/.exec(lineText);
  if (blockquoteMatch) {
    const [, prefix, content] = blockquoteMatch;

    if (cursorInLine >= prefix.length && content.trim() === "") {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: EditorSelection.cursor(line.from),
      });
      return true;
    }

    if (cursorInLine >= prefix.length) {
      const newLine = `\n${prefix}`;
      view.dispatch({
        changes: { from, insert: newLine },
        selection: EditorSelection.cursor(from + newLine.length),
        scrollIntoView: true,
      });
      return true;
    }
  }

  // Not a list/blockquote context, let default handler take over
  return false;
}

const customMarkdownKeymap = keymap.of([
  {
    key: "Enter",
    run: customListEnter,
  },
  {
    key: "Backspace",
    run: deleteMarkupBackward,
  },
]);

function ExportIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function Editor() {
  const { currentNote, updateNote, deleteNote, isSaving, pendingSave, setPendingSave, navigateToNoteByTitle } = useNotesStore();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [title, setTitle] = useState("");
  const titleRef = useRef(title);
  const saveTimeoutRef = useRef<number | null>(null);
  const noteIdRef = useRef<string | null>(null);
  const navigateRef = useRef(navigateToNoteByTitle);

  // Keep navigateRef in sync
  useEffect(() => {
    navigateRef.current = navigateToNoteByTitle;
  }, [navigateToNoteByTitle]);

  const handleWikilinkClick = useCallback((linkTitle: string) => {
    navigateRef.current(linkTitle);
  }, []);

  // Keep titleRef in sync
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const saveNote = (noteId: string, newTitle: string, newContent: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Register pending save so it can be flushed on lock
    setPendingSave({ id: noteId, title: newTitle, content: newContent });

    saveTimeoutRef.current = window.setTimeout(async () => {
      await updateNote(noteId, newTitle, newContent);
      setPendingSave(null);
    }, 500);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (viewRef.current && currentNote) {
      saveNote(currentNote.id, newTitle, viewRef.current.state.doc.toString());
    }
  };

  const handleDelete = async () => {
    if (!currentNote) return;
    if (window.confirm(t("editor.confirmDelete"))) {
      await deleteNote(currentNote.id);
    }
  };

  const handleExport = async () => {
    if (!currentNote) return;
    try {
      const noteTitle = currentNote.title || "Untitled";
      const path = await save({
        defaultPath: `${noteTitle}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await api.exportNote(currentNote.id, path);
      alert(t("export.success"));
    } catch {
      alert(t("export.error"));
    }
  };

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current || !currentNote) return;

    noteIdRef.current = currentNote.id;

    const state = EditorState.create({
      doc: currentNote.content,
      extensions: [
        markdown({ addKeymap: false }),
        history(),
        customMarkdownKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        baseTheme,
        themeCompartment.of(resolvedTheme === "dark" ? darkTheme : lightTheme),
        highlightCompartment.of(
          syntaxHighlighting(resolvedTheme === "dark" ? darkHighlightStyle : lightHighlightStyle)
        ),
        placeholderCompartment.of(placeholder(t("editor.contentPlaceholder"))),
        wikilink(handleWikilinkClick),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && noteIdRef.current) {
            saveNote(noteIdRef.current, titleRef.current, update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setEditorView(view);

    return () => {
      // Clear pending save timeout to prevent stale saves after note switch (M-11)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
  }, [currentNote?.id]);

  // Update CodeMirror theme when resolved theme changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [
          themeCompartment.reconfigure(
            resolvedTheme === "dark" ? darkTheme : lightTheme
          ),
          highlightCompartment.reconfigure(
            syntaxHighlighting(resolvedTheme === "dark" ? darkHighlightStyle : lightHighlightStyle)
          ),
        ],
      });
    }
  }, [resolvedTheme]);

  // Update CodeMirror placeholder when language changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: placeholderCompartment.reconfigure(
          placeholder(t("editor.contentPlaceholder"))
        ),
      });
    }
  }, [t]);

  // Sync title when note changes
  useEffect(() => {
    if (currentNote) {
      setTitle(currentNote.title);
    }
  }, [currentNote?.id]);

  if (!currentNote) {
    return (
      <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">{t("editor.selectNote")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col h-screen overflow-hidden">
      {/* Title */}
      <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder={t("editor.titlePlaceholder")}
            className="flex-1 text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
          />
          <button
            onClick={handleExport}
            className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title={t("editor.export")}
          >
            <ExportIcon />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title={t("editor.deleteTitle")}
          >
            <TrashIcon />
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-600 mt-2">
          {isSaving || pendingSave ? t("editor.saving") : t("editor.saved")}
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar view={editorView} />

      {/* Editor */}
      <div ref={editorRef} className="flex-1 overflow-auto" />
    </div>
  );
}
