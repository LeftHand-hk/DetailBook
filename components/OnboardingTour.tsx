"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

type Step = {
  id: "packages" | "business_hours" | "booking_page" | "booking_link" | "deposit";
  title: string;
  description: string;
  cta: string;
  href: string;
  done: boolean;
};

type Status = {
  steps: Step[];
  completed: number;
  total: number;
  percent: number;
  dismissed: boolean;
  completedAt: string | null;
};

const STORAGE_KEY = "detailbook_tour_seen_initial";

export default function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);

  // The booking-page editor has a sticky autosave bar pinned to bottom-0
  // (~52px tall) that would otherwise hide the floating buttons. Lift them
  // when we're on that route.
  const hasStickyBar = pathname === "/dashboard/booking-page";
  const buttonBottomPx = hasStickyBar ? 96 + 56 : 96;

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
  }, [fetchStatus, pathname]);

  // Refresh when the tab regains focus so a step the user just completed in
  // another tab (or after returning from a settings save) shows as done
  // without needing a manual refetch.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStatus]);

  // Auto-open when arriving with ?tour=true (post-signup redirect) OR on the
  // first dashboard visit ever, as long as the user hasn't dismissed and
  // hasn't completed. Strips the query param so refresh doesn't re-trigger.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromSignup = params.get("tour") === "true";
    const seenInitial = localStorage.getItem(STORAGE_KEY) === "1";

    (async () => {
      const s = await fetchStatus();
      if (!s) return;
      if (s.completedAt) return;

      if (fromSignup) {
        setOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        localStorage.setItem(STORAGE_KEY, "1");
        return;
      }

      if (!seenInitial && !s.dismissed && s.percent < 100) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, "1");
      }
    })();
  }, [fetchStatus]);

  // Optimistic close + fire-and-forget PATCH so the UI never waits on the
  // network round-trip. We don't refetch — `dismissed` is purely UI state
  // and the next page load will GET fresh data anyway.
  const dismiss = useCallback(() => {
    setOpen(false);
    fetch("/api/onboarding/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    }).catch(() => { /* ignore */ });
  }, []);

  // Optimistically flip the step locally so the checkmark appears instantly,
  // then PATCH in the background. If the request fails the next focus/route
  // change will reconcile from the server.
  const markStep = useCallback((stepId: Step["id"]) => {
    setStatus((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.map((s) =>
        s.id === stepId ? { ...s, done: true } : s
      );
      const completed = steps.filter((s) => s.done).length;
      const percent = Math.round((completed / steps.length) * 100);
      return { ...prev, steps, completed, percent };
    });
    fetch("/api/onboarding/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markStep: stepId }),
    }).catch(() => { /* ignore */ });
  }, []);

  const goToStep = (step: Step) => {
    setOpen(false);
    if (pathname === step.href) return;
    router.push(step.href);
  };

  // Hide the floating button while in admin views (component is mounted in
  // /dashboard layout but staff/impersonation flows might land here too).
  if (!status) return null;
  if (status.completedAt) return null;

  const nextStep = status.steps.find((s) => !s.done);

  return (
    <>
      {/* Floating progress button — sits above the Need Help button (which
          lives at bottom-6 right-6) so they don't overlap on tap. */}
      {!open && (
        <button
          onClick={() => { fetchStatus(); setOpen(true); }}
          style={{ bottom: buttonBottomPx, right: 24 }}
          className="fixed z-30 flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white pl-4 pr-5 py-3 rounded-2xl shadow-2xl shadow-blue-600/30 transition-all hover:scale-[1.02] group"
        >
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="white" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(status.percent / 100) * 94.25} 94.25`}
              />
            </svg>
            <span className="absolute text-[10px] font-black">{status.percent}%</span>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold leading-tight">Setup your business</p>
            <p className="text-[11px] text-white/70 leading-tight">
              {status.completed}/{status.total} steps complete
            </p>
          </div>
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop blur */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={dismiss}
          />

          {/* Modal panel */}
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6 sm:px-8 pt-6 pb-7">
              <button
                onClick={dismiss}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-2">
                Quick Start
              </p>
              <h2 className="text-2xl sm:text-3xl font-black mb-1.5 leading-tight">
                Let&apos;s set up your business in 5 minutes
              </h2>
              <p className="text-blue-100 text-sm mb-5 max-w-md">
                Knock out these {status.total} quick steps and your booking page is ready to take real customers.
              </p>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${status.percent}%` }}
                  />
                </div>
                <span className="text-sm font-bold whitespace-nowrap">
                  {status.percent}% done
                </span>
              </div>
            </div>

            {/* Steps list */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-gray-50">
              <ol className="space-y-3">
                {status.steps.map((step, idx) => {
                  const isNext = step === nextStep;
                  return (
                    <li
                      key={step.id}
                      className={`bg-white rounded-2xl border transition-all ${
                        step.done
                          ? "border-green-200"
                          : isNext
                          ? "border-blue-300 ring-2 ring-blue-100"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-4 p-4 sm:p-5">
                        {/* Step indicator */}
                        <div className="flex-shrink-0">
                          {step.done ? (
                            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                              isNext
                                ? "border-blue-600 text-blue-600 bg-blue-50"
                                : "border-gray-300 text-gray-400"
                            }`}>
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-bold text-base mb-0.5 ${
                            step.done ? "text-gray-500 line-through" : "text-gray-900"
                          }`}>
                            {step.title}
                          </h3>
                          <p className={`text-sm leading-relaxed ${
                            step.done ? "text-gray-400" : "text-gray-600"
                          }`}>
                            {step.description}
                          </p>

                          {!step.done && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={() => goToStep(step)}
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors"
                              >
                                {step.cta}
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                              {(step.id === "booking_link" || step.id === "deposit") && (
                                <button
                                  onClick={() => markStep(step.id)}
                                  className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                  Mark as done
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={dismiss}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                I&apos;ll do it later
              </button>
              {status.percent === 100 ? (
                <span className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  All done — you&apos;re ready!
                </span>
              ) : nextStep ? (
                <button
                  onClick={() => goToStep(nextStep)}
                  className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  Continue → {nextStep.title}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
