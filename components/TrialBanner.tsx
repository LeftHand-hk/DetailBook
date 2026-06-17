"use client";

import { useRouter } from "next/navigation";

// Non-blocking banner pinned at the top of the dashboard for the whole
// trial. Calm/confirming for the first few days, then a gentle nudge with
// a Continue button in the last two days. Continue routes to the billing
// page where the owner picks a plan and pays (no checkout opened here).
export default function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const router = useRouter();
  const urgent = daysLeft <= 2;
  const dayLabel = `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  if (!urgent) {
    return (
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm bg-emerald-50 border-b border-emerald-100 text-emerald-800">
        <svg className="w-4 h-4 flex-shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-bold">Your booking page is live</span>
        <span className="text-emerald-600/50">·</span>
        <span className="text-emerald-700/90">7-day trial · {dayLabel} left</span>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-sm bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-semibold truncate">
          Your trial ends in {dayLabel} — keep your booking page live from $24/mo
        </span>
      </div>
      <button
        onClick={() => router.push("/dashboard/billing")}
        className="flex-shrink-0 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
