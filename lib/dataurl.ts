// Helpers for turning the base64 data URLs we store in the DB
// (User.logo / bannerImage / coverImage, BusinessPhoto.photoUrl, …) into
// real binary responses. Serving images as binary with long-lived cache
// headers — instead of shipping the base64 string inside a JSON payload —
// lets the browser AND the CDN cache them, which is the whole point of the
// /api/book/[slug]/img|photo routes.

export type ParsedDataUrl = { mime: string; buffer: Buffer };

/**
 * Parse a `data:<mime>;base64,<payload>` URL into its mime type and raw
 * bytes. Returns null if the string isn't a base64 data URL (e.g. it's
 * already an http(s) URL from a future object-storage migration, or it's
 * empty/garbage).
 */
export function parseDataUrl(value: string | null | undefined): ParsedDataUrl | null {
  if (!value || typeof value !== "string") return null;
  // data:image/jpeg;base64,XXXX
  // [\s\S]* instead of .* with the /s flag (dotAll needs a newer TS target).
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  try {
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf-8");
    if (buffer.length === 0) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

// One year, immutable — paired with a `?v=<updatedAt>` cache-buster on the
// URL so a new upload (which bumps updatedAt) is fetched fresh while an
// unchanged image is served from cache forever.
export const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
