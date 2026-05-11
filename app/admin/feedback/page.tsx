"use client";

import { useEffect, useMemo, useState } from "react";

type FeedbackType = "suggestion" | "review" | "bug";

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  rating: number | null;
  message: string;
  read: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    businessName: string | null;
  } | null;
}

const TYPE_META: Record<FeedbackType, { label: string; emoji: string; chip: string }> = {
  suggestion: { label: "Suggestion", emoji: "💡", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  review:     { label: "Review",     emoji: "⭐", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  bug:        { label: "Bug",        emoji: "🐛", chip: "bg-red-50 text-red-700 border-red-200" },
};

const FILTER_OPTIONS: { value: "all" | FeedbackType; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "suggestion", label: "Suggestions" },
  { value: "review",     label: "Reviews" },
  { value: "bug",        label: "Bugs" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-3.5 h-3.5 ${n <= rating ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | FeedbackType>("all");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/feedback", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: FeedbackItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleRead = async (id: string, read: boolean) => {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, read } : it)));
    try {
      await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read }),
      });
    } catch { /* optimistic */ }
  };

  const filtered = useMemo(
    () => items.filter((it) => filter === "all" || it.type === filter),
    [items, filter],
  );

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
            <p className="text-sm text-gray-500 mt-1">
              Suggestions, reviews, and bug reports from customers.{" "}
              {unreadCount > 0 && (
                <span className="font-semibold text-gray-700">{unreadCount} unread.</span>
              )}
            </p>
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            Loading…
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            No feedback yet.
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((f) => {
            const meta = TYPE_META[f.type];
            return (
              <div
                key={f.id}
                className={`bg-white border rounded-2xl p-4 transition-colors ${
                  f.read ? "border-gray-200" : "border-blue-300 shadow-sm"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{meta.emoji}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${meta.chip}`}>
                      {meta.label}
                    </span>
                    {f.type === "review" && f.rating && <Stars rating={f.rating} />}
                    {!f.read && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{timeAgo(f.createdAt)}</span>
                    <button
                      onClick={() => toggleRead(f.id, !f.read)}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {f.read ? "Mark unread" : "Mark read"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className="font-semibold text-gray-700">{f.user?.businessName || f.user?.name || "—"}</span>
                  {f.user?.email && (
                    <a href={`mailto:${f.user.email}`} className="hover:underline">
                      &lt;{f.user.email}&gt;
                    </a>
                  )}
                </div>

                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{f.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
