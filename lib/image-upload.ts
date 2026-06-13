import { isStorageConfigured, uploadToStorage } from "@/lib/supabase-storage";

// Shared client-side image pipeline for the booking-page editors (classic
// + v2). Both editors funnel brand-image uploads (logo / banner / cover)
// through here so they behave identically and can't drift apart again —
// the HTTP 504 save bug came from the classic editor shipping raw, multi-MB
// base64 long after the v2 editor had been fixed to compress + offload to
// object storage.
//
// Browser-only: uses Image/canvas/FileReader. Import from "use client"
// components and call inside event handlers.

export type BrandImageKey = "bannerImage" | "logo" | "coverImage";

// Per-image tuning. These mirror the values the v2 editor shipped with:
// smaller, lower-quality encodes for things that render small (logo), and a
// hard char cap so even a huge phone photo can never produce a payload big
// enough to time out a save when it falls back to inline base64.
//   ~150KB logo · ~410KB cover · ~525KB banner at typical photos.
const IMAGE_SPECS: Record<BrandImageKey, { maxW: number; quality: number; cap: number }> = {
  logo:        { maxW: 400,  quality: 0.82, cap: 200_000 },
  coverImage:  { maxW: 1000, quality: 0.82, cap: 550_000 },
  bannerImage: { maxW: 1366, quality: 0.8,  cap: 700_000 },
};

// Downscale + compress an uploaded image to a SMALL base64 string. The hard
// `maxChars` cap is the important part: a save used to time out (HTTP 504)
// when a phone photo — or any PNG, which is lossless and balloons to several
// MB — was sent at full weight. We force photos to JPEG and keep dropping
// quality, then dimensions, until the payload is guaranteed small, so the
// save always uploads well within the serverless timeout no matter how big
// the source file is.
export function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.82,
  maxChars = 700_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the image."));
      img.onload = () => {
        // Keep PNG only for small graphics that may need transparency (logos).
        // A PNG of a *photo* stays lossless and huge — that's what timed out.
        const keepPng = file.type === "image/png" && maxWidth <= 600;
        const mime = keepPng ? "image/png" : "image/jpeg";
        const encode = (targetW: number, q: number): string => {
          const scale = Math.min(1, targetW / img.width);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reader.result as string;
          // White matte so a transparent PNG flattened to JPEG isn't black.
          if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL(mime, mime === "image/jpeg" ? q : undefined);
        };
        let targetW = Math.min(maxWidth, img.width);
        let q = quality;
        let out = encode(targetW, q);
        let guard = 0;
        while (out.length > maxChars && guard < 10) {
          guard++;
          if (mime === "image/jpeg" && q > 0.45) q -= 0.12; // shed quality first
          else targetW = Math.round(targetW * 0.85);        // then shrink size
          out = encode(targetW, q);
        }
        resolve(out);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Compress an uploaded brand image and push it to object storage, returning
// the public CDN URL so the DB only ever stores a tiny URL — which is what
// keeps the save payload small and the save itself off the 504 path. If
// storage isn't configured or the upload fails, we fall back to the (capped)
// inline base64 so the editor still works, just heavier.
//
// `ns` namespaces the storage path per business (slug or id) so uploads from
// different accounts never collide.
export async function compressAndUploadImage(
  file: File,
  key: BrandImageKey,
  ns: string,
): Promise<string> {
  const spec = IMAGE_SPECS[key];
  const dataUrl = await compressImage(file, spec.maxW, spec.quality, spec.cap);

  if (isStorageConfigured()) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const safeNs = (ns || "biz").replace(/[^a-zA-Z0-9_-]/g, "") || "biz";
      const path = `${safeNs}/${key}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      return await uploadToStorage(blob, path);
    } catch (e) {
      console.error("Storage upload failed; using inline image instead:", e);
    }
  }
  return dataUrl;
}
