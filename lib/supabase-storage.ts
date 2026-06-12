import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase Storage client for booking-page brand images (banner / cover /
// logo). Images are uploaded straight to a public bucket and only their URL
// is stored in the DB — so saves stay tiny and never time out (HTTP 504),
// and old base64 images keep working because the serving routes already
// redirect when a column holds an http(s) URL.
//
// The publishable/anon key is meant to live in the browser bundle, so this
// is safe to expose. When the env vars are absent (e.g. a fork without
// Supabase configured) the helpers degrade gracefully to base64.

// Fall back to the known public values so production works even if the
// Netlify env vars aren't set. The publishable key is client-safe by design
// (it ships in the browser bundle and is gated by the bucket's RLS policy),
// so hardcoding it as a default is fine. Override via env if you ever rotate.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ubbjxjuoqoxwjyafawhl.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_9BcFGoyMzt-Yg1TarC1qZg__DCGei5o";

export const SUPABASE_BUCKET = "images";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function isStorageConfigured(): boolean {
  return !!client();
}

// Upload a Blob and return its public CDN URL. Throws on failure so the
// caller can fall back to an inline image.
export async function uploadToStorage(blob: Blob, path: string): Promise<string> {
  const sb = client();
  if (!sb) throw new Error("Supabase Storage is not configured.");
  const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || "image/jpeg",
    cacheControl: "31536000", // 1 year — the path is unique per upload
  });
  if (error) throw error;
  const { data } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not resolve the uploaded image URL.");
  return data.publicUrl;
}
