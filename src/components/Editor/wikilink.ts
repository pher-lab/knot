import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Regex to match [[note title]]
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g;

// Decoration for wiki links
const wikilinkMark = Decoration.mark({ class: "cm-wikilink" });

// Create decorations for wiki links in the document
function getWikilinkDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    let match;

    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(text)) !== null) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      builder.add(from, to, wikilinkMark);
    }
  }

  return builder.finish();
}

// ViewPlugin to manage decorations
const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getWikilinkDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = getWikilinkDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Theme for wiki links
const wikilinkTheme = EditorView.baseTheme({
  ".cm-wikilink": {
    color: "#60a5fa",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textUnderlineOffset: "3px",
    "&:hover": {
      color: "#93c5fd",
      textDecorationStyle: "solid",
    },
  },
  ".cm-wikilink span": {
    color: "inherit !important",
  },
});

// Click handler for wiki links
function wikilinkClickHandler(onNavigate: (title: string) => void) {
  return EditorView.domEventHandlers({
    click(event, view) {
      // Check if the clicked element is within a wikilink decoration
      const target = event.target as HTMLElement;
      if (!target.closest(".cm-wikilink")) {
        return false;
      }

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const doc = view.state.doc;
      const line = doc.lineAt(pos);
      const text = line.text;
      const offset = pos - line.from;

      // Find if click is within a wikilink
      WIKILINK_REGEX.lastIndex = 0;
      let match;
      while ((match = WIKILINK_REGEX.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (offset >= start && offset <= end) {
          const title = match[1].trim();
          if (title) {
            event.preventDefault();
            onNavigate(title);
            return true;
          }
        }
      }

      return false;
    },
  });
}

// Export the extension factory
export function wikilink(onNavigate: (title: string) => void) {
  return [wikilinkPlugin, wikilinkTheme, wikilinkClickHandler(onNavigate)];
}
