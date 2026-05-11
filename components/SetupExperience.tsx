"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/storage";

type StepId =
  | "business_info"
  | "working_hours"
  | "services"
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

const TIME_OPTIONS = (() => {
  const out: string[] = [];
  for (let h = 5; h <= 23; h++) {
    for (const m of [0, 30]) {
      const period = h < 12 ? "AM" : "PM";
      const displayH = h === 0 ? 12 : h <= 12 ? h : h - 12;
      const mm = m === 0 ? "00" : "30";
      out.push(`${displayH}:${mm} ${period}`);
    }
  }
  return out;
})();

const DAYS: { id: string; label: string }[] = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
];

const DEFAULT_HOURS: Record<string, { open: string; close: string; closed: boolean }> = {
  monday: { open: "9:00 AM", close: "6:00 PM", closed: false },
  tuesday: { open: "9:00 AM", close: "6:00 PM", closed: false },
  wednesday: { open: "9:00 AM", close: "6:00 PM", closed: false },
  thursday: { open: "9:00 AM", close: "6:00 PM", closed: false },
  friday: { open: "9:00 AM", close: "6:00 PM", closed: false },
  saturday: { open: "9:00 AM", close: "6:00 PM", closed: false },
  sunday: { open: "10:00 AM", close: "4:00 PM", closed: true },
};

const SERVICE_TEMPLATES = [
  { name: "Basic Wash", description: "Exterior wash, tire shine, and quick interior wipe-down.", price: "45", duration: "30" },
  { name: "Full Detail", description: "Complete interior and exterior detail with premium products.", price: "150", duration: "120" },
  { name: "Ceramic Coating", description: "Long-lasting ceramic protection with paint prep and decontamination.", price: "400", duration: "240" },
  { name: "Paint Correction", description: "Multi-stage polish to remove swirls, scratches, and oxidation.", price: "300", duration: "180" },
];

const STORAGE_KEY = "detailbook_setup_seen_initial";

export default function SetupExperience() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
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

  // Auto-open panel once when arriving from onboarding. The trigger is a
  // sessionStorage flag rather than a ?tour=true URL param: a URL param
  // forced us to call history.replaceState to clean it up, and fbevents.js
  // detects that URL change and fires a duplicate PageView in Meta Pixel
  // Helper. Keeping the URL stable avoids the ghost event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let showTour = false;
    try {
      showTour = sessionStorage.getItem("dB_showTour") === "1";
      if (showTour) sessionStorage.removeItem("dB_showTour");
    } catch { /* private mode */ }
    if (!showTour) return;

    (async () => {
      const s = await fetchStatus();
      if (!s || s.completedAt) return;
      setPanelOpen(true);
      localStorage.setItem(STORAGE_KEY, "1");
    })();
  }, [fetchStatus]);

  // When status flips to 100% for the first time in this session, show a
  // brief celebration and auto-dismiss the banner after 5s.
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

  // One-shot prompt that nudges the user to customise their booking
  // page (logo, banner, intro) the moment they finish the Setup Guide.
  // Backed by User.hasSeenCustomizePrompt — see prisma/schema.prisma.
  const [customizePromptOpen, setCustomizePromptOpen] = useState(false);

  // Finish: mark share_link done, dismiss the banner, suppress the
  // celebration flash, and close the panel. If this is the first time
  // the user finishes setup, also pop the "Customize My Page" modal
  // (and mark hasSeenCustomizePrompt so we never repeat).
  const finishSetup = useCallback(async () => {
    completionFlashedRef.current = true;
    setShowCompleteFlash(false);
    setStatus((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.map((s) =>
        s.id === "share_link" ? { ...s, done: true } : s,
      );
      const completed = steps.filter((s) => s.done).length;
      return {
        ...prev,
        steps,
        completed,
        percent: Math.round((completed / steps.length) * 100),
        dismissed: true,
        completedAt: prev.completedAt ?? new Date().toISOString(),
      };
    });
    setPanelOpen(false);

    // Decide whether to show the customise prompt before issuing the
    // PATCHes. Local cache is authoritative for the flag (kept fresh
    // via syncFromServer after signup + on focus). Worst case the
    // modal shows twice if the cache is stale — small annoyance,
    // not a bug.
    const cached = getUser() as { hasSeenCustomizePrompt?: boolean } | null;
    const showPrompt = !cached?.hasSeenCustomizePrompt;
    if (showPrompt) setCustomizePromptOpen(true);

    try {
      const pendingFetches: Promise<unknown>[] = [
        fetch("/api/onboarding/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markStep: "share_link" }),
        }),
        fetch("/api/onboarding/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true }),
        }),
      ];
      if (showPrompt) {
        // Persist the seen flag immediately so refreshing the page or
        // re-clicking Finish (e.g. user re-opens the guide via the
        // floating button) doesn't show the modal twice.
        pendingFetches.push(
          fetch("/api/user", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hasSeenCustomizePrompt: true }),
          }),
        );
        try {
          // Update local cache so subsequent reads of getUser() reflect
          // the new value without a syncFromServer round-trip.
          const { setUser } = await import("@/lib/storage");
          const current = getUser();
          if (current) setUser({ ...current, hasSeenCustomizePrompt: true } as any);
        } catch { /* ignore */ }
      }
      await Promise.all(pendingFetches);
    } catch { /* optimistic; server reconciles on next focus */ }
  }, []);

  const markStep = useCallback(async (stepId: StepId) => {
    setStatus((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.map((s) => (s.id === stepId ? { ...s, done: true } : s));
      const completed = steps.filter((s) => s.done).length;
      const percent = Math.round((completed / steps.length) * 100);
      const remainingMin = steps
        .filter((s) => !s.done && s.estimate)
        .reduce((acc, s) => acc + parseInt(s.estimate || "0", 10), 0);
      return { ...prev, steps, completed, percent, remainingMin };
    });
    try {
      await fetch("/api/onboarding/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markStep: stepId }),
      });
    } catch { /* optimistic; reconcile on next focus */ }
  }, []);

  if (!status) return null;

  const hideEverything = status.completedAt && !showCompleteFlash;
  if (hideEverything) return null;

  return (
    <>
      {!status.dismissed && (
        <SetupBanner
          status={status}
          onContinue={() => setPanelOpen(true)}
          onDismiss={dismissBanner}
          showCompleteFlash={showCompleteFlash}
        />
      )}

      <SetupPanel
        open={panelOpen}
        status={status}
        onClose={() => setPanelOpen(false)}
        onMarkStep={markStep}
        onRefresh={fetchStatus}
        onFinish={finishSetup}
        router={router}
      />

      <CustomizePromptModal
        open={customizePromptOpen}
        onCustomize={() => {
          setCustomizePromptOpen(false);
          router.push("/dashboard/booking-page");
        }}
        onSkip={() => {
          setCustomizePromptOpen(false);
          router.push("/dashboard");
        }}
      />
    </>
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

// ─────────────────────────────────────────────────────────────────────────────
// Side Panel

type Router = ReturnType<typeof useRouter>;

function SetupPanel({
  open,
  status,
  onClose,
  onMarkStep,
  onRefresh,
  onFinish,
  router,
}: {
  open: boolean;
  status: Status;
  onClose: () => void;
  onMarkStep: (id: StepId) => void;
  onRefresh: () => Promise<Status | null>;
  onFinish: () => void;
  router: Router;
}) {
  const [expandedStep, setExpandedStep] = useState<StepId | null>(null);

  // Auto-expand the first incomplete step in display order so the
  // user lands on whatever they still need to do.
  useEffect(() => {
    if (!open) return;
    const firstIncomplete = status.steps.find((s) => !s.done);
    setExpandedStep(firstIncomplete?.id ?? null);
  }, [open, status]);

  return (
    <>
      {/* Backdrop — semi-transparent so dashboard stays visible. Tap to close. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel — slides from right. h-[100dvh] (dynamic viewport height)
          instead of h-screen so iOS Safari's collapsing address bar
          doesn't push the bottom of the panel below the visible area —
          the "Finish setup" button on the last step was unreachable on
          phones before this. */}
      <aside
        className={`fixed top-0 right-0 h-[100dvh] z-50 w-full sm:w-[440px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Setup guide</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {status.completed} of {status.total} done · about {status.remainingMin || 0} min left
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex-shrink-0 h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${status.percent}%` }}
          />
        </div>

        {/* Steps. overscroll-contain stops the body underneath from
            scrolling when the user reaches the top/bottom of this list
            on mobile (otherwise touch momentum bleeds through to the
            backdrop). pb-24 leaves space under the last expanded step
            so a long final body (e.g. ShareLinkBody with its Finish
            button) clears the safe-area at the bottom of the viewport
            on iOS. */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-24">
          <ol className="divide-y divide-gray-100">
            {status.steps.map((step, idx) => (
              <StepItem
                key={step.id}
                step={step}
                index={idx}
                expanded={expandedStep === step.id}
                onToggle={() =>
                  setExpandedStep((cur) => (cur === step.id ? null : step.id))
                }
                onMarkDone={() => onMarkStep(step.id)}
                onRefresh={onRefresh}
                router={router}
                onClosePanel={onClose}
                onFinish={onFinish}
              />
            ))}
          </ol>
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single step row + expansion content

function StepItem({
  step,
  index,
  expanded,
  onToggle,
  onMarkDone,
  onRefresh,
  router,
  onClosePanel,
  onFinish,
}: {
  step: Step;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onMarkDone: () => void;
  onRefresh: () => Promise<Status | null>;
  router: Router;
  onClosePanel: () => void;
  onFinish: () => void;
}) {
  const isActive = expanded && !step.done;

  return (
    <li className={`${isActive ? "bg-blue-50/40" : "bg-white"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <StepIndicator done={step.done} index={index} active={isActive} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-semibold ${
              step.done ? "text-gray-500" : "text-gray-900"
            }`}>
              {step.title}
            </h3>
            {step.optional && (
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Optional
              </span>
            )}
            {step.estimate && !step.done && (
              <span className="text-xs text-gray-400">{step.estimate}</span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${step.done ? "text-gray-400" : "text-gray-600"}`}>
            {step.description}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1">
          <StepBody
            step={step}
            onMarkDone={onMarkDone}
            onRefresh={onRefresh}
            router={router}
            onClosePanel={onClosePanel}
            onFinish={onFinish}
          />
        </div>
      )}
    </li>
  );
}

function StepIndicator({ done, index, active }: { done: boolean; index: number; active: boolean }) {
  if (done) {
    return (
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold mt-0.5 ${
      active ? "border-blue-600 text-blue-600 bg-white" : "border-gray-300 text-gray-400 bg-white"
    }`}>
      {index + 1}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-step body content

function StepBody({
  step,
  onMarkDone,
  onRefresh,
  router,
  onClosePanel,
  onFinish,
}: {
  step: Step;
  onMarkDone: () => void;
  onRefresh: () => Promise<Status | null>;
  router: Router;
  onClosePanel: () => void;
  onFinish: () => void;
}) {
  switch (step.id) {
    case "business_info":
      return <BusinessInfoBody onClosePanel={onClosePanel} router={router} />;
    case "working_hours":
      return <WorkingHoursBody done={step.done} onSaved={onRefresh} />;
    case "services":
      return <ServicesBody done={step.done} onSaved={onRefresh} router={router} onClosePanel={onClosePanel} onMarkDone={onMarkDone} />;
    case "share_link":
      return <ShareLinkBody done={step.done} onMarkDone={onMarkDone} onFinish={onFinish} />;
  }
}

// ── Step 1: Business Info ───────────────────────────────────────────────────

function BusinessInfoBody({ onClosePanel, router }: { onClosePanel: () => void; router: Router }) {
  const [info, setInfo] = useState<{ businessName?: string; name?: string; email?: string } | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u) setInfo({ businessName: u.businessName, name: u.name, email: u.email });
  }, []);

  return (
    <div className="space-y-3 text-sm">
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <Field label="Business" value={info?.businessName} />
        <Field label="Owner" value={info?.name} />
        <Field label="Email" value={info?.email} />
      </div>
      <button
        onClick={() => { onClosePanel(); router.push("/dashboard/settings"); }}
        className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
      >
        Edit in settings →
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 truncate">{value || "—"}</span>
    </div>
  );
}

// ── Step 2: Working Hours ───────────────────────────────────────────────────

function WorkingHoursBody({ done, onSaved }: { done: boolean; onSaved: () => Promise<Status | null> }) {
  const [hours, setHours] = useState(() => {
    const u = getUser() as any;
    return (u?.businessHours as typeof DEFAULT_HOURS) || DEFAULT_HOURS;
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessHours: hours }),
      });
      setSavedAt(Date.now());
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const applyMondayToAll = () => {
    const mon = hours.monday;
    const next: typeof hours = { ...hours };
    for (const d of DAYS) next[d.id] = { ...mon };
    setHours(next);
  };

  // Top action row + a footer copy of the same Save button. The form
  // is pre-filled with sensible defaults (Mon-Sat 9-6, Sunday closed)
  // so most users just need to tap Save and move on — keeping the
  // button at the top of the form makes that path obvious without
  // scrolling past 7 day pickers first.
  const SaveAction = ({ idForLabel }: { idForLabel?: string }) => (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        aria-label={idForLabel}
      >
        {saving ? "Saving..." : done ? "Update hours" : "Save hours"}
      </button>
      {savedAt && (
        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900 leading-snug">
        We&apos;ve set sensible defaults. Tap <span className="text-blue-700">Save</span> to continue, or adjust if needed.
      </p>

      <SaveAction idForLabel="Save working hours (top)" />

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Customers can only book inside these hours; anything outside is blocked automatically. Untick a day if you&apos;re closed.
      </p>

      <button
        type="button"
        onClick={applyMondayToAll}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        Use Monday&apos;s hours for every day
      </button>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {DAYS.map((d) => {
          const h = hours[d.id] || { open: "9:00 AM", close: "6:00 PM", closed: false };
          return (
            <div key={d.id} className="flex items-center gap-2 px-3 py-2.5">
              <label className="flex items-center gap-2 w-[110px] flex-shrink-0">
                <input
                  type="checkbox"
                  checked={!h.closed}
                  onChange={(e) =>
                    setHours({ ...hours, [d.id]: { ...h, closed: !e.target.checked } })
                  }
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-xs font-semibold text-gray-700">{d.label}</span>
              </label>
              {h.closed ? (
                <span className="text-xs text-gray-400 italic flex-1">Closed</span>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <select
                    value={h.open}
                    onChange={(e) => setHours({ ...hours, [d.id]: { ...h, open: e.target.value } })}
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">–</span>
                  <select
                    value={h.close}
                    onChange={(e) => setHours({ ...hours, [d.id]: { ...h, close: e.target.value } })}
                    className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SaveAction idForLabel="Save working hours (bottom)" />
    </div>
  );
}

// ── Step 3: Services ─────────────────────────────────────────────────────────

function ServicesBody({
  done, onSaved, router, onClosePanel, onMarkDone,
}: {
  done: boolean;
  onSaved: () => Promise<Status | null>;
  router: Router;
  onClosePanel: () => void;
  onMarkDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addedName, setAddedName] = useState<string | null>(null);
  // Synchronous double-click guard — setSaving is async so two fast
  // clicks can fire the POST twice. Already cost us a duplicate row
  // in production once; ref locks the critical section immediately.
  const submittingRef = useRef(false);

  const handleTemplate = async (t: typeof SERVICE_TEMPLATES[number]) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t.name,
          description: t.description,
          price: parseFloat(t.price),
          duration: parseInt(t.duration, 10),
          deposit: 0,
          active: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Could not save service.");
      } else {
        setAddedName(t.name);
        await onSaved();
        // Auto-advance: marks "services" done in onboardingProgress so
        // the panel collapses this row and expands working_hours.
        onMarkDone();
      }
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  // Custom-service flow jumps out of the slide-out panel to the full
  // /dashboard/packages page, which has the proper editor (vehicle
  // types, deposits per package, descriptions, etc.). ?newPackage=1
  // is the specific signal that the packages page should auto-open
  // the "new package" modal so the user lands inside the form, not
  // staring at the page header. The onboarding "Create Your First
  // Package" CTA deliberately doesn't pass this flag — it lands users
  // on the page itself so they can survey templates first.
  const openPackagesPage = () => {
    onClosePanel();
    router.push("/dashboard/packages?newPackage=1");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-700">Pick a common service to start:</p>

      <div className="grid grid-cols-2 gap-2">
        {SERVICE_TEMPLATES.map((t) => (
          <button
            key={t.name}
            onClick={() => handleTemplate(t)}
            disabled={saving}
            className="text-left bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-3 transition-all"
          >
            <p className="text-xs font-bold text-gray-900">{t.name}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              ${t.price} · {t.duration} min
            </p>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {addedName && (
        <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          {addedName} added
        </p>
      )}

      <button
        onClick={openPackagesPage}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        + Create custom service
      </button>

      {done && !addedName && (
        <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Services configured
        </p>
      )}
    </div>
  );
}

// ── Step 4: Share Link ───────────────────────────────────────────────────────

function ShareLinkBody({
  done, onMarkDone, onFinish,
}: { done: boolean; onMarkDone: () => void; onFinish: () => void }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setUrl(`${base}/book/${u.slug}`);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (!done) onMarkDone();
    } catch { /* clipboard not available */ }
  };

  const shareUrls = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`Book online: ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Book online: ${url}`)}`,
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1.5">Your booking link</p>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 truncate">
            {url || "—"}
          </div>
          <button
            onClick={copy}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1.5">Share to</p>
        <div className="flex gap-2">
          <a
            href={shareUrls.whatsapp}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            WhatsApp
          </a>
          <a
            href={shareUrls.facebook}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            Facebook
          </a>
          <a
            href={shareUrls.twitter}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            X / Twitter
          </a>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1.5">Where to put your link</p>
        <ul className="text-xs text-gray-600 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">•</span>
            Paste it in your Instagram bio
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">•</span>
            Reply to customer texts and DMs with it
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5">•</span>
            Print a QR code for your shop or van
          </li>
        </ul>
      </div>

      <div className="border-t border-gray-200 pt-3 mt-2">
        <button
          onClick={onFinish}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Finish setup
        </button>
        <p className="text-[11px] text-gray-500 text-center mt-1.5">
          You won&apos;t see this checklist again.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customize prompt modal — appears once, right after Finish setup.
//
// Mobile-first: full-screen sheet under sm:, centered card on desktop.
// Dismissal paths (Skip button, outside click, Escape key) all run
// the same onSkip handler so the parent can route to /dashboard.
// The "seen" flag is persisted by the parent BEFORE this opens, so
// any of these dismissals is effectively the same as opening it.

function CustomizePromptModal({
  open, onCustomize, onSkip,
}: {
  open: boolean;
  onCustomize: () => void;
  onSkip: () => void;
}) {
  // Escape closes the modal. We attach to document so the listener
  // works regardless of focus location inside the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onSkip(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onSkip]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customize-prompt-title"
      onClick={onSkip}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden animate-fadeIn"
      >
        <div className="p-6 sm:p-7 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 id="customize-prompt-title" className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2">
            Setup complete!
          </h2>
          <p className="text-sm text-gray-600 mb-1.5">
            Your booking page is live — but it&apos;s looking pretty plain right now.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Take 2 minutes to add your logo, a photo of your work, and a short intro. Customers trust polished pages — and they book more often.
          </p>

          <button
            onClick={onCustomize}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
          >
            Customize My Page
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <button
            onClick={onSkip}
            className="mt-3 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
