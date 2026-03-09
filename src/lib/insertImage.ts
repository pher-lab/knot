import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import * as api from "./api";
import { imageUrl, MAX_IMAGE_SIZE, isAllowedImageType } from "./imageUtils";

/**
 * Insert an image from a File object (clipboard paste or drag-drop).
 * Reads bytes, uploads via IPC, and inserts Markdown at cursor.
 */
export async function insertImageFile(
  view: EditorView,
  file: File,
  noteId: string
): Promise<{ error?: string }> {
  if (!isAllowedImageType(file.type)) {
    return { error: "unsupportedType" };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: "tooLarge" };
  }

  const buffer = await file.arrayBuffer();
  const data = Array.from(new Uint8Array(buffer));

  const info = await api.saveImage(noteId, data, file.type);
  const url = imageUrl(info.id);
  const md = `![image](${url})`;

  const { from } = view.state.selection.main;
  view.dispatch({
    changes: { from, insert: md },
    selection: EditorSelection.cursor(from + md.length),
  });

  return {};
}

/**
 * Insert an image from a file path (toolbar file dialog).
 * File is read on the Rust side to avoid large IPC transfers.
 */
export async function insertImageFromPath(
  view: EditorView,
  path: string,
  noteId: string
): Promise<{ error?: string }> {
  const info = await api.saveImageFromPath(noteId, path);
  const url = imageUrl(info.id);
  const md = `![image](${url})`;

  const { from } = view.state.selection.main;
  view.dispatch({
    changes: { from, insert: md },
    selection: EditorSelection.cursor(from + md.length),
  });

  return {};
}
