import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { useTranslation } from "../../i18n";

interface ToolbarProps {
  view: EditorView | null;
}

// Toggle wrap: if cursor is inside prefix...suffix, remove them; otherwise wrap/insert
function toggleWrap(view: EditorView, prefix: string, suffix: string) {
  const { state } = view;
  const { from, to } = state.selection.main;

  if (from !== to) {
    // Has selection: check if markers are directly outside the selection
    if (
      from >= prefix.length &&
      state.sliceDoc(from - prefix.length, from) === prefix &&
      state.sliceDoc(to, to + suffix.length) === suffix
    ) {
      view.dispatch({
        changes: [
          { from: from - prefix.length, to: from, insert: "" },
          { from: to, to: to + suffix.length, insert: "" },
        ],
        selection: EditorSelection.range(from - prefix.length, to - prefix.length),
      });
      view.focus();
      return;
    }
    // Wrap selection
    const selectedText = state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: prefix + selectedText + suffix },
      selection: EditorSelection.range(from + prefix.length, to + prefix.length),
    });
  } else {
    // No selection: check if cursor is inside a wrapped region on the same line
    const line = state.doc.lineAt(from);
    const lineText = line.text;
    const cursorCol = from - line.from;
    const textBefore = lineText.slice(0, cursorCol);
    const textAfter = lineText.slice(cursorCol);
    const prefixIdx = textBefore.lastIndexOf(prefix);
    const suffixIdx = textAfter.indexOf(suffix);

    if (prefixIdx !== -1 && suffixIdx !== -1) {
      // Make sure there's no closing suffix between the prefix and the cursor
      const between = textBefore.slice(prefixIdx + prefix.length);
      if (!between.includes(suffix)) {
        const absPrefix = line.from + prefixIdx;
        const absSuffix = line.from + cursorCol + suffixIdx;
        view.dispatch({
          changes: [
            { from: absPrefix, to: absPrefix + prefix.length, insert: "" },
            { from: absSuffix, to: absSuffix + suffix.length, insert: "" },
          ],
          selection: EditorSelection.cursor(from - prefix.length),
        });
        view.focus();
        return;
      }
    }
    // Not inside: insert placeholder
    view.dispatch({
      changes: { from, insert: prefix + suffix },
      selection: EditorSelection.cursor(from + prefix.length),
    });
  }
  view.focus();
}

// Toggle list marker
function toggleList(view: EditorView, marker: string) {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const lineText = line.text;

  // Check if line already has this marker
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^(\\s*)${escapedMarker}`);
  const match = regex.exec(lineText);

  if (match) {
    // Remove the marker
    const indent = match[1];
    const cursorOffset = from - line.from;
    const newCursorOffset = Math.max(indent.length, cursorOffset - marker.length + indent.length);
    view.dispatch({
      changes: { from: line.from, to: line.from + indent.length + marker.length, insert: indent },
      selection: EditorSelection.cursor(line.from + Math.min(newCursorOffset, indent.length + lineText.length - indent.length - marker.length)),
    });
  } else {
    // Check if line has a different list marker and replace it
    const anyListMatch = /^(\s*)([-*+]|\d+[.)]) /.exec(lineText);
    if (anyListMatch) {
      const indent = anyListMatch[1];
      const existingMarker = anyListMatch[2] + " ";
      const cursorOffset = from - line.from;
      const newCursorOffset = cursorOffset - existingMarker.length + marker.length;
      view.dispatch({
        changes: {
          from: line.from + indent.length,
          to: line.from + indent.length + existingMarker.length,
          insert: marker,
        },
        selection: EditorSelection.cursor(line.from + Math.max(indent.length + marker.length, newCursorOffset)),
      });
    } else {
      // Add marker at line start (after existing indentation)
      const indentMatch = /^(\s*)/.exec(lineText);
      const indent = indentMatch ? indentMatch[1] : "";
      view.dispatch({
        changes: { from: line.from + indent.length, to: line.from + indent.length, insert: marker },
        selection: EditorSelection.cursor(from + marker.length),
      });
    }
  }
  view.focus();
}

// Toggle external link: if cursor is inside [text](url), remove link syntax; otherwise insert
function toggleLink(view: EditorView) {
  const { state } = view;
  const { from, to } = state.selection.main;

  // Check if cursor is inside a [text](url) pattern on the current line
  const line = state.doc.lineAt(from);
  const lineText = line.text;
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
  let match;
  while ((match = linkRegex.exec(lineText)) !== null) {
    const matchStart = line.from + match.index;
    const matchEnd = matchStart + match[0].length;
    if (matchStart <= from && from <= matchEnd) {
      // Cursor is inside this link - remove link syntax, keep text
      const linkText = match[1];
      view.dispatch({
        changes: { from: matchStart, to: matchEnd, insert: linkText },
        selection: EditorSelection.cursor(matchStart + linkText.length),
      });
      view.focus();
      return;
    }
  }

  if (from === to) {
    const template = "[](url)";
    view.dispatch({
      changes: { from, to, insert: template },
      selection: EditorSelection.cursor(from + 1),
    });
  } else {
    const selectedText = state.sliceDoc(from, to);
    const link = `[${selectedText}](url)`;
    view.dispatch({
      changes: { from, to, insert: link },
      selection: EditorSelection.range(from + selectedText.length + 3, from + selectedText.length + 6),
    });
  }
  view.focus();
}

// Toggle wiki link: if cursor is inside [[...]], remove markers; otherwise insert
function toggleWikiLink(view: EditorView) {
  const { state } = view;
  const { from, to } = state.selection.main;

  if (from !== to) {
    // Has selection: check if markers are directly outside
    if (
      from >= 2 &&
      state.sliceDoc(from - 2, from) === "[[" &&
      state.sliceDoc(to, to + 2) === "]]"
    ) {
      const selectedText = state.sliceDoc(from, to);
      view.dispatch({
        changes: { from: from - 2, to: to + 2, insert: selectedText },
        selection: EditorSelection.range(from - 2, from - 2 + selectedText.length),
      });
      view.focus();
      return;
    }
    const selectedText = state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `[[${selectedText}]]` },
      selection: EditorSelection.range(from + 2, from + 2 + selectedText.length),
    });
  } else {
    // No selection: check if cursor is inside [[...]]
    const line = state.doc.lineAt(from);
    const lineText = line.text;
    const cursorCol = from - line.from;
    const textBefore = lineText.slice(0, cursorCol);
    const textAfter = lineText.slice(cursorCol);
    const prefixIdx = textBefore.lastIndexOf("[[");
    const suffixIdx = textAfter.indexOf("]]");

    if (prefixIdx !== -1 && suffixIdx !== -1 && !textBefore.slice(prefixIdx + 2).includes("]]")) {
      const absPrefix = line.from + prefixIdx;
      const absSuffix = line.from + cursorCol + suffixIdx;
      view.dispatch({
        changes: [
          { from: absPrefix, to: absPrefix + 2, insert: "" },
          { from: absSuffix, to: absSuffix + 2, insert: "" },
        ],
        selection: EditorSelection.cursor(from - 2),
      });
      view.focus();
      return;
    }
    view.dispatch({
      changes: { from, insert: "[[]]" },
      selection: EditorSelection.cursor(from + 2),
    });
  }
  view.focus();
}

// Cycle through heading levels (none -> H1 -> H2 -> H3 -> none)
function cycleHeading(view: EditorView) {
  const { state } = view;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  const lineText = line.text;

  const headingMatch = /^(#{1,6})\s/.exec(lineText);
  if (headingMatch) {
    const currentLevel = headingMatch[1].length;
    if (currentLevel >= 3) {
      // Remove heading
      const removed = currentLevel + 1; // "### " length
      view.dispatch({
        changes: { from: line.from, to: line.from + removed, insert: "" },
        selection: EditorSelection.cursor(Math.max(line.from, from - removed)),
      });
    } else {
      // Increase level (add one #)
      view.dispatch({
        changes: { from: line.from, to: line.from + currentLevel, insert: "#".repeat(currentLevel + 1) },
        selection: EditorSelection.cursor(from + 1),
      });
    }
  } else {
    // Add H1
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: "# " },
      selection: EditorSelection.cursor(from + 2),
    });
  }
  view.focus();
}

function BoldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
    </svg>
  );
}

function HeadingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 4v3h5.5v12h3V7H19V4z" />
    </svg>
  );
}

function ListBulletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
    </svg>
  );
}

function ListNumberIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
    </svg>
  );
}

function WikiLinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 9h-2v1h2v2H9v-1h2v-1H9V9h4v2zm5 9H6V4h7v5h5v11z" />
    </svg>
  );
}

export function Toolbar({ view }: ToolbarProps) {
  const { t } = useTranslation();

  if (!view) return null;

  return (
    <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      <button
        onClick={() => toggleWrap(view, "**", "**")}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.bold")}
      >
        <BoldIcon />
      </button>
      <button
        onClick={() => toggleWrap(view, "*", "*")}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.italic")}
      >
        <ItalicIcon />
      </button>
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <button
        onClick={() => cycleHeading(view)}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.heading")}
      >
        <HeadingIcon />
      </button>
      <button
        onClick={() => toggleList(view, "- ")}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.bulletList")}
      >
        <ListBulletIcon />
      </button>
      <button
        onClick={() => toggleList(view, "1. ")}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.numberedList")}
      >
        <ListNumberIcon />
      </button>
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <button
        onClick={() => toggleWikiLink(view)}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.wikiLink")}
      >
        <WikiLinkIcon />
      </button>
      <button
        onClick={() => toggleLink(view)}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
        title={t("toolbar.externalLink")}
      >
        <LinkIcon />
      </button>
    </div>
  );
}
