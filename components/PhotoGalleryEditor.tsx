"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Photo Gallery editor used on /dashboard/booking-page. Handles its
// own data lifecycle against /api/photos so the parent autosave (which
// wraps /api/user) stays lean. Gallery layout/title settings ARE
// parent state — they live on the User row.

interface BusinessPhoto {
  id: string;
  photoType: "single" | "before_after";
  photoUrl: string;
  beforePhotoUrl: string | null;
  caption: string | null;
  displayOrder: number;
}

const MAX_PHOTOS = 12;

type Layout = "grid" | "carousel" | "masonry";

export default function PhotoGalleryEditor({
  layout, showTitle, title,
  onLayoutChange, onShowTitleChange, onTitleChange,
}: {
  layout: Layout;
  showTitle: boolean;
  title: string;
  onLayoutChange: (v: Layout) => void;
  onShowTitleChange: (v: boolean) => void;
  onTitleChange: (v: string) => void;
}) {
  const [photos, setPhotos] = useState<BusinessPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pairOpen, setPairOpen] = useState(false);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);

  // Reorder state. We hold the in-flight order locally so the UI
  // doesn't flash back to the server order before the PUT completes.
  const [dragId, setDragId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/photos", { cache: "no-store" });
      if (r.ok) setPhotos(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Compress an image client-side. Tuning notes:
  //   · maxW = 1200 px (down from 1600) — matches the brief's
  //     recommended 1200×800. Going from 1600→1200 ≈ 44% fewer pixels,
  //     translates to ~40% smaller files at the same quality.
  //   · WebP @ 0.85 first, JPEG @ 0.82 fallback — WebP is ~25% smaller
  //     than JPEG at the same perceived quality and is universally
  //     supported in modern browsers; Safari < 14 falls through to
  //     JPEG automatically (toDataURL returns the requested type only
  //     when supported, otherwise it silently returns image/png).
  //   · 500 KB skip threshold — under this size the round trip through
  //     canvas would cost more than it'd save. Above it, we always
  //     re-encode so the API never sees a 5 MB raw JPEG from a phone.
  // Combined effect: typical 3-4 MB phone photo lands on the API as
  // ~250-400 KB — uploads finish 4-6× faster on average mobile
  // networks with no visible quality loss.
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) return reject(new Error("Read failed"));
        if (result.length < 500 * 1024) return resolve(result);
        const img = new Image();
        img.onload = () => {
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas unsupported"));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Try WebP first. If the browser doesn't support it, toDataURL
          // returns a PNG by default (much larger than our JPEG path),
          // so we detect that and fall back to JPEG explicitly.
          const webp = canvas.toDataURL("image/webp", 0.85);
          if (webp.startsWith("data:image/webp")) return resolve(webp);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadSingle = useCallback(async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      const r = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoType: "single", photoUrl: dataUrl }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setError(body.error || "Upload failed");
      else setPhotos((p) => [...p, body]);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [compressImage]);

  const uploadPair = useCallback(async (
    beforeFile: File, afterFile: File, caption: string,
  ) => {
    setError("");
    setUploading(true);
    try {
      const [beforeUrl, afterUrl] = await Promise.all([
        compressImage(beforeFile), compressImage(afterFile),
      ]);
      const r = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoType: "before_after",
          photoUrl: afterUrl,
          beforePhotoUrl: beforeUrl,
          caption: caption.trim() || undefined,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setError(body.error || "Upload failed");
      else {
        setPhotos((p) => [...p, body]);
        setPairOpen(false);
      }
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [compressImage]);

  const deletePhoto = useCallback(async (id: string) => {
    setDeletingId(null);
    const optimistic = photos.filter((p) => p.id !== id);
    setPhotos(optimistic);
    try {
      const r = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!r.ok) {
        await reload(); // restore on failure
      }
    } catch {
      await reload();
    }
  }, [photos, reload]);

  const saveCaption = useCallback(async (id: string) => {
    const newCaption = captionDraft.trim().slice(0, 60);
    setEditingCaptionId(null);
    setPhotos((cur) => cur.map((p) => p.id === id ? { ...p, caption: newCaption || null } : p));
    try {
      await fetch(`/api/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: newCaption }),
      });
    } catch { /* optimistic */ }
  }, [captionDraft]);

  // HTML5 drag/drop reorder. We swap items locally first, then PUT the
  // new order. Mobile users won't have drag — they can delete + re-add
  // in the order they want for now.
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const dragIdx = photos.findIndex((p) => p.id === dragId);
    const targetIdx = photos.findIndex((p) => p.id === targetId);
    if (dragIdx < 0 || targetIdx < 0) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setPhotos(reordered);
    setDragId(null);
    try {
      await fetch("/api/photos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((p) => p.id) }),
      });
    } catch { /* optimistic */ }
  };

  const remaining = MAX_PHOTOS - photos.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base">📸 Photo Gallery</h2>
          <p className="text-blue-100 text-xs mt-0.5">Show your work. Detailers with photos get more bookings.</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Add buttons */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add Photo</p>
          <div className="flex flex-wrap gap-2">
            <input ref={singleInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadSingle(f);
                if (singleInputRef.current) singleInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading || remaining <= 0}
              onClick={() => singleInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading…
                </>
              ) : (
                <><span aria-hidden>+</span> Single Photo</>
              )}
            </button>
            <button
              type="button"
              disabled={uploading || remaining <= 0}
              onClick={() => setPairOpen(true)}
              className="flex items-center gap-1.5 bg-white border border-blue-300 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed text-blue-700 text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
            >
              <span aria-hidden>+</span> Before/After Pair
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
            <strong>Single</strong> = one finished photo (e.g. ceramic coating result).{" "}
            <strong>Before/After</strong> = two photos showing the transformation (e.g. paint correction).
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Recommended: 1200×800px. JPG / PNG / WEBP. Max {MAX_PHOTOS} items.</p>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        {/* Gallery list */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Your Photos ({photos.length} of {MAX_PHOTOS})
            </p>
            {photos.length > 1 && (
              <p className="text-[11px] text-gray-400">Drag to reorder</p>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1,2,3].map((i) => <div key={i} className="aspect-square bg-gray-100 rounded-xl shimmer" />)}
            </div>
          ) : photos.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
              No photos yet. Add a Single or a Before/After pair to start your portfolio.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, p.id)}
                  className={`relative rounded-xl overflow-hidden border bg-white group transition-shadow ${
                    dragId === p.id ? "border-blue-500 shadow-md" : "border-gray-200 hover:shadow"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-gray-100">
                    {p.photoType === "before_after" && p.beforePhotoUrl ? (
                      <div className="grid grid-cols-2 h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.photoUrl} alt="After" className="w-full h-full object-cover border-l-2 border-white" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt={p.caption || "Photo"} className="w-full h-full object-cover" />
                    )}

                    {/* Type badge */}
                    <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      p.photoType === "before_after"
                        ? "bg-amber-500 text-white"
                        : "bg-white/90 text-gray-700 border border-gray-200"
                    }`}>
                      {p.photoType === "before_after" ? "Before/After" : "Single"}
                    </span>

                    {/* Actions */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditingCaptionId(p.id); setCaptionDraft(p.caption || ""); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/95 hover:bg-white text-gray-700 hover:text-blue-700 shadow-sm transition-colors"
                        aria-label="Edit caption"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(p.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/95 hover:bg-red-50 text-gray-700 hover:text-red-600 shadow-sm transition-colors"
                        aria-label="Delete photo"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Caption row */}
                  <div className="px-2.5 py-2 text-[11px] text-gray-600 min-h-[28px]">
                    {p.caption || <span className="text-gray-300 italic">No caption</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Display options */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Display Options</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Gallery Layout</label>
              <div className="grid grid-cols-3 gap-2">
                {(["grid", "carousel", "masonry"] as Layout[]).map((opt) => {
                  const active = layout === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onLayoutChange(opt)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all border-2 ${
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-gray-700">Show gallery title</label>
              <button
                type="button"
                onClick={() => onShowTitleChange(!showTitle)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showTitle ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  showTitle ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
            {showTitle && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value.slice(0, 40))}
                  placeholder="Our Work"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pair upload modal */}
      {pairOpen && (
        <PairUploadModal
          uploading={uploading}
          error={error}
          onCancel={() => setPairOpen(false)}
          onSubmit={uploadPair}
        />
      )}

      {/* Caption edit modal */}
      {editingCaptionId && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditingCaptionId(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">Edit caption</h3>
            <input
              type="text"
              value={captionDraft}
              maxLength={60}
              onChange={(e) => setCaptionDraft(e.target.value)}
              placeholder="e.g. Paint correction on BMW M3"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-[11px] text-gray-400 mt-1">{captionDraft.length}/60</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingCaptionId(null)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              <button onClick={() => saveCaption(editingCaptionId)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDeletingId(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">Delete this photo?</h3>
            <p className="text-sm text-gray-500 mb-4">This can&apos;t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingId(null)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              <button onClick={() => deletePhoto(deletingId)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PairUploadModal({
  uploading, error, onCancel, onSubmit,
}: {
  uploading: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (before: File, after: File, caption: string) => void;
}) {
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const onPick = (which: "before" | "after", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (which === "before") { setBeforeFile(file); setBeforePreview(result); }
      else { setAfterFile(file); setAfterPreview(result); }
    };
    reader.readAsDataURL(file);
  };

  const canSubmit = beforeFile && afterFile && !uploading;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
          <h3 className="text-white font-bold text-base">Add Before/After Photos</h3>
          <button onClick={onCancel} className="text-white/80 hover:text-white p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <PairSlot label="BEFORE" preview={beforePreview} onPick={(f) => onPick("before", f)} />
            <PairSlot label="AFTER"  preview={afterPreview}  onPick={(f) => onPick("after", f)}  />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Caption (optional)</label>
            <input
              type="text"
              value={caption}
              maxLength={60}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Paint correction on BMW M3"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">{caption.length}/60</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
            <button
              onClick={() => canSubmit && onSubmit(beforeFile!, afterFile!, caption)}
              disabled={!canSubmit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              {uploading ? "Uploading…" : "Save Pair"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PairSlot({
  label, preview, onPick,
}: {
  label: string;
  preview: string | null;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="relative aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/30 transition-colors overflow-hidden"
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
            {label}
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 group-hover:text-blue-600">
          <span className="text-xs font-bold tracking-wider">{label}</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="text-[11px]">Upload</span>
        </div>
      )}
    </button>
  );
}
