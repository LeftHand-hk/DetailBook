"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUser } from "@/lib/storage";

type StepId =
  | "business_info"
  | "working_hours"
  | "services"
  | "deposits"
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
  const pathname = usePathname();
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
  }, [fetchStatus, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchStatus]);

  // Auto-open panel once with ?tour=true (from signup redirect).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") !== "true") return;

    (async () => {
      const s = await fetchStatus();
      if (!s || s.completedAt) return;
      setPanelOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
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
        router={router}
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
                Setup complete — start sharing your booking link!
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {showCompleteFlash ? "This banner will hide automatically." : "Great work."}
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
                  Get your booking page ready
                </p>
                <p className="text-xs text-gray-500">
                  {status.completed} of {status.total} complete
                  {status.remainingMin > 0 && ` · ~${status.remainingMin} min remaining`}
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
              Continue setup
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
  router,
}: {
  open: boolean;
  status: Status;
  onClose: () => void;
  onMarkStep: (id: StepId) => void;
  onRefresh: () => Promise<Status | null>;
  router: Router;
}) {
  const [expandedStep, setExpandedStep] = useState<StepId | null>(null);

  // Auto-expand the first incomplete required step when panel opens.
  useEffect(() => {
    if (!open) return;
    const firstIncomplete = status.steps.find((s) => !s.done && !s.optional)
      || status.steps.find((s) => !s.done);
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

      {/* Panel — slides from right */}
      <aside
        className={`fixed top-0 right-0 h-screen z-50 w-full sm:w-[440px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Setup checklist</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {status.completed} of {status.total} complete · {status.percent}%
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

        {/* Steps */}
        <div className="flex-1 overflow-y-auto">
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
}: {
  step: Step;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onMarkDone: () => void;
  onRefresh: () => Promise<Status | null>;
  router: Router;
  onClosePanel: () => void;
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
}: {
  step: Step;
  onMarkDone: () => void;
  onRefresh: () => Promise<Status | null>;
  router: Router;
  onClosePanel: () => void;
}) {
  switch (step.id) {
    case "business_info":
      return <BusinessInfoBody onClosePanel={onClosePanel} router={router} />;
    case "working_hours":
      return <WorkingHoursBody done={step.done} onSaved={onRefresh} />;
    case "services":
      return <ServicesBody done={step.done} onSaved={onRefresh} />;
    case "deposits":
      return <DepositsBody done={step.done} onSaved={onRefresh} onMarkDone={onMarkDone} />;
    case "share_link":
      return <ShareLinkBody done={step.done} onMarkDone={onMarkDone} />;
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

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={applyMondayToAll}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
      >
        Apply Monday hours to all days
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

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
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
    </div>
  );
}

// ── Step 3: Services ─────────────────────────────────────────────────────────

function ServicesBody({ done, onSaved }: { done: boolean; onSaved: () => Promise<Status | null> }) {
  const [form, setForm] = useState({ name: "", description: "", price: "", duration: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addedCount, setAddedCount] = useState(0);

  const useTemplate = (t: typeof SERVICE_TEMPLATES[number]) => {
    setForm({ name: t.name, description: t.description, price: t.price, duration: t.duration });
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!form.name || !form.price || !form.duration) {
      setError("Name, price, and duration are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          duration: parseInt(form.duration, 10),
          deposit: 0,
          active: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not save service.");
      } else {
        setAddedCount((c) => c + 1);
        setForm({ name: "", description: "", price: "", duration: "" });
        await onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">Quick-add a popular service</p>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => useTemplate(t)}
              className="text-left bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-lg p-3 transition-all"
            >
              <p className="text-xs font-bold text-gray-900">{t.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                ${t.price} · {t.duration} min
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-2.5">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Service name"
          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Short description (optional)"
          rows={2}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Price"
              className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              placeholder="Duration"
              className="w-full pl-3 pr-12 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">min</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          {saving ? "Adding..." : "Add service"}
        </button>
        {(addedCount > 0 || done) && (
          <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            {addedCount > 0
              ? `${addedCount} service${addedCount === 1 ? "" : "s"} added`
              : "Services configured"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Step 4: Deposits ─────────────────────────────────────────────────────────

function DepositsBody({
  done, onSaved, onMarkDone,
}: { done: boolean; onSaved: () => Promise<Status | null>; onMarkDone: () => void }) {
  const u = (typeof window !== "undefined" ? getUser() : null) as any;
  const [enabled, setEnabled] = useState<boolean>(Boolean(u?.requireDeposit));
  const [percent, setPercent] = useState<number>(u?.depositPercentage || 20);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireDeposit: enabled, depositPercentage: percent }),
      });
      setSavedAt(Date.now());
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Require deposit at booking</p>
          <p className="text-xs text-gray-500 mt-0.5">Reduces no-shows and locks in commitment.</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Deposit percentage</p>
          <div className="grid grid-cols-3 gap-2">
            {[10, 20, 30].map((p) => (
              <button
                key={p}
                onClick={() => setPercent(p)}
                className={`py-2 text-sm font-semibold rounded-lg border transition-colors ${
                  percent === p
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-400"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? "Saving..." : done ? "Update" : "Save"}
        </button>
        {!done && (
          <button
            onClick={onMarkDone}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        )}
        {savedAt && (
          <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ── Step 5: Share Link ───────────────────────────────────────────────────────

function ShareLinkBody({ done, onMarkDone }: { done: boolean; onMarkDone: () => void }) {
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

      <ul className="text-xs text-gray-600 space-y-1.5 pt-1">
        <li className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5">•</span>
          Add this link to your Instagram bio
        </li>
        <li className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5">•</span>
          Reply to customer DMs with the link
        </li>
        <li className="flex items-start gap-2">
          <span className="text-gray-400 mt-0.5">•</span>
          Print a QR code for your shop or van
        </li>
      </ul>
    </div>
  );
}
