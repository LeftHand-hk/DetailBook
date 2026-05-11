"use client";

import { useCallback, useEffect, useState } from "react";

// Mirror of the photo gallery editor — manages testimonial CRUD against
// /api/reviews and lets the parent (the booking-page admin) own the
// four display-toggle settings via props.

interface BusinessReview {
  id: string;
  customerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string | null;
  serviceId: string | null;
  displayOrder: number;
}

interface PackageOption {
  id: string;
  name: string;
}

const MAX_REVIEWS = 10;
const MAX_NAME_LEN = 50;
const MAX_TEXT_LEN = 300;

type Layout = "carousel" | "grid" | "list";

export default function ReviewsEditor({
  layout, showStars, showAvatars, showDates,
  onLayoutChange, onShowStarsChange, onShowAvatarsChange, onShowDatesChange,
}: {
  layout: Layout;
  showStars: boolean;
  showAvatars: boolean;
  showDates: boolean;
  onLayoutChange: (v: Layout) => void;
  onShowStarsChange: (v: boolean) => void;
  onShowAvatarsChange: (v: boolean) => void;
  onShowDatesChange: (v: boolean) => void;
}) {
  const [reviews, setReviews] = useState<BusinessReview[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessReview | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/reviews", { cache: "no-store" });
      if (r.ok) setReviews(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch packages once so the "Service Booked" dropdown in the editor
  // modal can list the owner's real package names. Falls back to a
  // hidden field if the request fails.
  useEffect(() => {
    fetch("/api/packages", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setPackages(data.map((p: any) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => { /* fine — editor just hides the dropdown */ });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const openAdd = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (r: BusinessReview) => { setEditing(r); setEditorOpen(true); };

  const upsertReview = async (payload: Omit<BusinessReview, "id" | "displayOrder">, editingId: string | null) => {
    setError("");
    try {
      if (editingId) {
        const r = await fetch(`/api/reviews/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.error || "Save failed");
          return false;
        }
        const updated = await r.json();
        setReviews((cur) => cur.map((x) => x.id === editingId ? updated : x));
      } else {
        const r = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.error || "Save failed");
          return false;
        }
        const created = await r.json();
        setReviews((cur) => [...cur, created]);
      }
      return true;
    } catch (e: any) {
      setError(e.message || "Save failed");
      return false;
    }
  };

  const deleteReview = async (id: string) => {
    setDeletingId(null);
    const optimistic = reviews.filter((r) => r.id !== id);
    setReviews(optimistic);
    try {
      const r = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!r.ok) await reload();
    } catch {
      await reload();
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const dragIdx = reviews.findIndex((r) => r.id === dragId);
    const targetIdx = reviews.findIndex((r) => r.id === targetId);
    if (dragIdx < 0 || targetIdx < 0) return;
    const reordered = [...reviews];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setReviews(reordered);
    setDragId(null);
    try {
      await fetch("/api/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((r) => r.id) }),
      });
    } catch { /* optimistic */ }
  };

  const remaining = MAX_REVIEWS - reviews.length;
  const atLimit = remaining <= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-white font-bold text-base">⭐ Customer Reviews</h2>
        <p className="text-blue-100 text-xs mt-0.5">Real reviews build trust. Add testimonials from happy customers.</p>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <button
            type="button"
            onClick={openAdd}
            disabled={atLimit}
            title={atLimit ? "Maximum reached. Delete an existing review to add a new one." : undefined}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
          >
            <span aria-hidden>+</span> Add Review
          </button>
          <p className="text-[11px] text-gray-400 mt-2">
            Max {MAX_REVIEWS} reviews. Drag to reorder.
          </p>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Your Reviews ({reviews.length} of {MAX_REVIEWS})
          </p>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl shimmer" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
              No reviews yet. Add one to start building trust with new customers.
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, r.id)}
                  className={`relative border rounded-xl bg-white p-4 transition-shadow ${
                    dragId === r.id ? "border-blue-500 shadow-md" : "border-gray-200 hover:shadow"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <svg key={n} className={`w-4 h-4 ${n <= r.rating ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-blue-50 text-gray-500 hover:text-blue-700 transition-colors"
                        aria-label="Edit review"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(r.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                        aria-label="Delete review"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-snug mb-1.5 whitespace-pre-wrap break-words">
                    &ldquo;{r.reviewText}&rdquo;
                  </p>
                  <p className="text-xs text-gray-500">
                    — {r.customerName}
                    {r.reviewDate && (
                      <span className="text-gray-400">
                        {" · "}
                        {new Date(r.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Display options */}
        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Display Options</p>
          <div className="space-y-3">
            <ToggleRow label="Show rating stars" value={showStars} onChange={onShowStarsChange} />
            <ToggleRow label="Show reviewer initial avatar" value={showAvatars} onChange={onShowAvatarsChange} />
            <ToggleRow label="Show review dates" value={showDates} onChange={onShowDatesChange} />

            <div className="pt-2">
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Layout</label>
              <div className="grid grid-cols-3 gap-2">
                {(["carousel", "grid", "list"] as Layout[]).map((opt) => {
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
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {editorOpen && (
        <ReviewEditorModal
          editing={editing}
          packages={packages}
          onCancel={() => setEditorOpen(false)}
          onSubmit={async (payload) => {
            const ok = await upsertReview(payload, editing?.id ?? null);
            if (ok) setEditorOpen(false);
          }}
        />
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setDeletingId(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-2">Delete this review?</h3>
            <p className="text-sm text-gray-500 mb-4">This can&apos;t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingId(null)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
              <button onClick={() => deleteReview(deletingId)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-gray-700">{label}</label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-200"
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-6" : "translate-x-1"
        }`} />
      </button>
    </div>
  );
}

function ReviewEditorModal({
  editing, packages, onCancel, onSubmit,
}: {
  editing: BusinessReview | null;
  packages: PackageOption[];
  onCancel: () => void;
  onSubmit: (payload: {
    customerName: string;
    rating: number;
    reviewText: string;
    reviewDate: string | null;
    serviceId: string | null;
  }) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState(editing?.customerName || "");
  const [rating, setRating] = useState(editing?.rating || 5);
  const [reviewText, setReviewText] = useState(editing?.reviewText || "");
  const [reviewDate, setReviewDate] = useState<string>(
    editing?.reviewDate
      ? new Date(editing.reviewDate).toISOString().slice(0, 10)
      : "",
  );
  const [serviceId, setServiceId] = useState<string>(editing?.serviceId || "");
  const [saving, setSaving] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const canSubmit = customerName.trim() && reviewText.trim() && rating >= 1 && rating <= 5;

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    await onSubmit({
      customerName: customerName.trim(),
      rating,
      reviewText: reviewText.trim(),
      reviewDate: reviewDate || null,
      serviceId: serviceId || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <h3 className="text-white font-bold text-base">
            {editing ? "Edit Review" : "Add Customer Review"}
          </h3>
          <button onClick={onCancel} className="text-white/80 hover:text-white p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              maxLength={MAX_NAME_LEN}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Sarah M."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">First name + last initial recommended.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1,2,3,4,5].map((n) => {
                const filled = n <= (hoverRating || rating);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    className="p-0.5 hover:scale-110 transition-transform"
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    <svg className={`w-7 h-7 ${filled ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Review Text <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reviewText}
              maxLength={MAX_TEXT_LEN}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              placeholder="What did they say about their experience?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">{reviewText.length}/{MAX_TEXT_LEN}</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Date (optional)
            </label>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Leave blank to hide the date.</p>
          </div>

          {packages.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                Service Booked (optional)
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— none —</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Links the review to a specific service.</p>
            </div>
          )}
        </div>

        <div className="p-5 pt-2 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onCancel} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
          <button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Save Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
