import { convertFileSrc } from "@tauri-apps/api/tauri";

/**
 * Generate a platform-appropriate URL for a knot-image.
 * - Windows: https://knot-image.localhost/{uuid}
 * - macOS/Linux: knot-image://localhost/{uuid}
 */
export function imageUrl(imageId: string): string {
  return convertFileSrc(imageId, "knot-image");
}

/** Extract image ID from a knot-image URL (both platform formats) */
export function extractImageId(url: string): string | null {
  // knot-image://localhost/{uuid} (macOS/Linux)
  const match1 = /^knot-image:\/\/localhost\/([0-9a-f-]{36})$/i.exec(url);
  if (match1) return match1[1];
  // https://knot-image.localhost/{uuid} (Windows)
  const match2 =
    /^https?:\/\/knot-image\.localhost\/([0-9a-f-]{36})$/i.exec(url);
  if (match2) return match2[1];
  return null;
}

/** Check if a URL is a knot-image URL (either platform format) */
export function isKnotImageUrl(url: string): boolean {
  return (
    url.startsWith("knot-image://") ||
    url.startsWith("https://knot-image.localhost/") ||
    url.startsWith("http://knot-image.localhost/")
  );
}

/** Maximum image size in bytes (10MB) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types */
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

/** Check if a MIME type is an allowed image type */
export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}
