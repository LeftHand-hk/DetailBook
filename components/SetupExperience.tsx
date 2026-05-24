"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

type StepId =
  | "business_info"
  | "working_hours"
  | "services"
  | "customize_page"
  | "share_link";

type Step = {
  id: StepId;
  title: string;
  description: string;
  estimate: string | null;
  optional: boolean;
  done: boolean;
};

type Status = {
  steps: Step[];
  completed: number;
  total: number;
  percent: number;
  remainingMin: number;
  dismissed: boolean;
  completedAt: string | null;
};

export default function SetupExperience() {
  const router = useRouter();
  // usePathname (not window.location) so server + client render the same
  // value — reading window during render caused a hydration mismatch
  // that could break event handlers across the dashboard (sidebar
  // links stopped responding).
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [showCompleteFlash, setShowCompleteFlash] = useState(false);
  const completionFlashedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as Status;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => fetchStatus();
    // Custom event fired by pages that mutate onboarding-relevant
    // state (e.g. /dashboard/packages after creating a package) so
    // the banner reflects the new completion immediately, instead of
    // waiting for the next window focus / route change.
    const onSetupChanged = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    window.addEventListener("detailbook:setup-changed", onSetupChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("detailbook:setup-changed", onSetupChanged);
    };
  }, [fetchStatus]);

  // Clear any stale tour flag from past sessions so it can't trigger a
  // modal that no longer exists. The full setup-guide panel was
  // removed in favour of the inline `SetupProgressCard` on /dashboard.
  useEffect(() => {
    try { sessionStorage.removeItem("dB_showTour"); } catch { /* private mode */ }
  }, []);

  // When status flips to 100% for the first time in this session, show a
  // brief celebration in the banner and auto-dismiss it after 5s.
  useEffect(() => {
    if (!status) return;
    if (status.percent === 100 && !completionFlashedRef.current) {
      completionFlashedRef.current = true;
      setShowCompleteFlash(true);
      const t = setTimeout(() => setShowCompleteFlash(false), 5000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const dismissBanner = useCallback(() => {
    setStatus((s) => (s ? { ...s, dismissed: true } : s));
    fetch("/api/onboarding/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => {});
  }, []);

  if (!status) return null;

  // Hide the banner once setup is fully complete (after the brief flash).
  const hideBanner = status.completedAt && !showCompleteFlash;
  if (hideBanner) return null;
  if (status.dismissed) return null;

  // "Continue" used to open a slide-out panel. The panel was removed —
  // the full step list now lives in the inline SetupProgressCard on
  // /dashboard, so clicking Continue just navigates there.
  const onContinue = () => {
    if (pathname !== "/dashboard") router.push("/dashboard");
  };

  return (
    <SetupBanner
      status={status}
      onContinue={onContinue}
      onDismiss={dismissBanner}
      showCompleteFlash={showCompleteFlash}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner

function SetupBanner({
  status,
  onContinue,
  onDismiss,
  showCompleteFlash,
}: {
  status: Status;
  onContinue: () => void;
  onDismiss: () => void;
  showCompleteFlash: boolean;
}) {
  const isComplete = status.percent === 100;

  return (
    <div className={`flex-shrink-0 border-b ${
      isComplete ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
    }`}>
      <div className="px-4 sm:px-6 py-3 flex items-center gap-4">
        {isComplete ? (
          <>
            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                You&apos;re ready! Share your link to start getting bookings.
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {showCompleteFlash ? "This will hide on its own in a few seconds." : "Nice work."}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="hidden sm:flex flex-shrink-0 items-center justify-center w-9 h-9">
              <ProgressRing percent={status.percent} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">
                  Finish setting up your booking page
                </p>
                <p className="text-xs text-gray-500">
                  {status.completed} of {status.total} done
                  {status.remainingMin > 0 && ` · about ${status.remainingMin} min left`}
                </p>
              </div>
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-md">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${status.percent}%` }}
                />
              </div>
            </div>
            <button
              onClick={onContinue}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {status.completed === 0 ? "Start" : "Continue"}
            </button>
          </>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#E5E7EB" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r} fill="none"
        stroke="#3B82F6" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${(percent / 100) * c} ${c}`}
        className="transition-all duration-500"
      />
    </svg>
  );
}

