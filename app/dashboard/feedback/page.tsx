"use client";

import { useEffect, useState } from "react";

type FeedbackType = "suggestion" | "review" | "bug";

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  rating: number | null;
  message: string;
  createdAt: string;
}

const TYPES: { value: FeedbackType; label: string; description: string; emoji: string; accent: string }[] = [
  {
    value: "suggestion",
    label: "Suggestion",
    description: "Something you'd like to see in DetailBook.",
    emoji: "💡",
    accent: "border-blue-500 bg-blue-50",
  },
  {
    value: "review",
    label: "Review",
    description: "Share what you think — be honest, it helps.",
    emoji: "⭐",
    accent: "border-amber-500 bg-amber-50",
  },
  {
    value: "bug",
    label: "Bug report",
    description: "Something broken or behaving weirdly.",
    emoji: "🐛",
    accent: "border-red-500 bg-red-50",
  },
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

function Stars({ rating, size = "md", onPick }: { rating: number; size?: "sm" | "md"; onPick?: (n: number) => void }) {
  const px = size === "sm" ? "w-4 h-4" : "w-7 h-7";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rating;
        const cls = `${px} ${filled ? "text-amber-400" : "text-gray-200"} ${onPick ? "cursor-pointer hover:text-amber-300 transition-colors" : ""}`;
        return (
          <svg
            key={n}
            className={cls}
            fill="currentColor"
            viewBox="0 0 20 20"
            onClick={onPick ? () => onPick(n) : undefined}
            role={onPick ? "button" : undefined}
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
    </div>
  );
}

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<FeedbackItem[]>([]);

  const loadHistory = () => {
    fetch("/api/feedback", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: FeedbackItem[]) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => { /* ignore */ });
  };

  useEffect(() => { loadHistory(); }, []);

  const canSubmit = message.trim().length > 0 && !submitting && (type !== "review" || rating > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          rating: type === "review" ? rating : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to send. Please try again.");
      } else {
        setSuccess(true);
        setMessage("");
        setRating(0);
        loadHistory();
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Feedback</h1>
        <p className="text-gray-500 text-sm mt-1">
          Tell me what works, what doesn&apos;t, what&apos;s missing. I read every message personally.
        </p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5">
          {/* Type picker */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What kind?</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => {
                const active = t.value === type;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setType(t.value); setSuccess(false); }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                      active
                        ? `${t.accent} shadow-sm`
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <span className={`text-xs font-bold ${active ? "text-gray-900" : "text-gray-700"}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {TYPES.find((t) => t.value === type)?.description}
            </p>
          </div>

          {/* Star rating, only for review */}
          {type === "review" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">How would you rate DetailBook?</label>
              <Stars rating={rating} onPick={(n) => { setRating(n); setSuccess(false); }} />
              {rating === 0 && (
                <p className="text-[11px] text-gray-400 mt-1.5">Pick at least 1 star</p>
              )}
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              {type === "bug" ? "What broke?" : type === "review" ? "Your thoughts" : "Your idea"}
            </label>
            <textarea
              required
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSuccess(false); }}
              placeholder={
                type === "bug"
                  ? "Steps to reproduce, what you expected, what happened…"
                  : type === "review"
                  ? "What's working well? What could be better?"
                  : "What would you like to see in DetailBook?"
              }
              rows={6}
              maxLength={4000}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 text-sm resize-y"
            />
            <p className="text-[11px] text-gray-400 mt-1">{message.length} / 4000</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl">
              Thanks — got it. I&apos;ll read it personally.
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            {submitting ? "Sending…" : "Send feedback"}
          </button>
        </div>
      </form>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your past feedback</h2>
          <div className="space-y-2">
            {history.map((f) => {
              const def = TYPES.find((t) => t.value === f.type);
              return (
                <div key={f.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def?.emoji}</span>
                      <span className="text-sm font-bold text-gray-900">{def?.label}</span>
                      {f.type === "review" && f.rating && (
                        <Stars rating={f.rating} size="sm" />
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{timeAgo(f.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{f.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
