"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror the shape of /api/admin/metrics

interface MetricsResponse {
  range: { from: string; to: string; days: number };
  current: {
    totalSignups: number;
    signupsLast7: number;
    activationRate: number;
    activatedUsers: number;
    activeUsers7d: number;
    dropoffRate: number;
    dropoffUsers: number;
    paying: { total: number; starter: number; pro: number };
    trialToPaidRate: number | null;
    trialsEnded: number;
    funnel: {
      signups: number;
      createdPackage: number;
      sharedLink: number;
      gotFirstBooking: number;
      paidSubscriber: number;
    };
  };
  previous: { totalSignups: number; signupsLast7: number };
}

interface PlatformSettings {
  adsCampaignStartDate: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date preset helpers — each returns {from,to} or null when unavailable
// (e.g. "since-ads" before the campaign date is configured).

type PresetKey =
  | "today" | "yesterday"
  | "last7" | "last14" | "last30" | "last90"
  | "thisWeek" | "lastWeek"
  | "thisMonth" | "lastMonth"
  | "sinceAds"
  | "all"
  | "custom";

interface DateRange { from: Date; to: Date }

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today",      label: "Today" },
  { key: "yesterday",  label: "Yesterday" },
  { key: "last7",      label: "Last 7 days" },
  { key: "last14",     label: "Last 14 days" },
  { key: "last30",     label: "Last 30 days" },
  { key: "last90",     label: "Last 90 days" },
  { key: "thisWeek",   label: "This week" },
  { key: "lastWeek",   label: "Last week" },
  { key: "thisMonth",  label: "This month" },
  { key: "lastMonth",  label: "Last month" },
  { key: "sinceAds",   label: "Since Ads Started" },
  { key: "all",        label: "All time" },
  { key: "custom",     label: "Custom range…" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function presetToRange(key: PresetKey, adsStart: Date | null): DateRange | null {
  const now = new Date();
  const today = startOfDay(now);
  switch (key) {
    case "today":      return { from: today, to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y) };
    }
    case "last7":  return { from: startOfDay(new Date(now.getTime() - 7 * 86400000)),  to: endOfDay(now) };
    case "last14": return { from: startOfDay(new Date(now.getTime() - 14 * 86400000)), to: endOfDay(now) };
    case "last30": return { from: startOfDay(new Date(now.getTime() - 30 * 86400000)), to: endOfDay(now) };
    case "last90": return { from: startOfDay(new Date(now.getTime() - 90 * 86400000)), to: endOfDay(now) };
    case "thisWeek": {
      // ISO week starts Monday — Sunday=0 from getDay, so shift to 6.
      const day = (now.getDay() + 6) % 7;
      const start = startOfDay(now); start.setDate(start.getDate() - day);
      return { from: start, to: endOfDay(now) };
    }
    case "lastWeek": {
      const day = (now.getDay() + 6) % 7;
      const thisWeekStart = startOfDay(now); thisWeekStart.setDate(thisWeekStart.getDate() - day);
      const start = new Date(thisWeekStart); start.setDate(start.getDate() - 7);
      const end = new Date(thisWeekStart); end.setMilliseconds(end.getMilliseconds() - 1);
      return { from: start, to: end };
    }
    case "thisMonth": {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      return { from: start, to: endOfDay(now) };
    }
    case "lastMonth": {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from: start, to: end };
    }
    case "sinceAds":
      if (!adsStart) return null;
      return { from: startOfDay(adsStart), to: endOfDay(now) };
    case "all":     return { from: new Date(0), to: endOfDay(now) };
    case "custom":  return null;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function toInputDate(d: Date): string {
  // <input type="date"> wants "YYYY-MM-DD" in local time, not ISO UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export default function AdminMetricsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading…</div>}>
      <MetricsInner />
    </Suspense>
  );
}

function MetricsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state — initialized from URL search params so a refresh keeps
  // the selected period. ?preset=... wins; if absent we fall back to
  // ?from=...&to=... pairing; if nothing is set we default to all-time.
  const [preset, setPreset] = useState<PresetKey>(() => {
    const p = searchParams.get("preset") as PresetKey | null;
    if (p && PRESETS.some((x) => x.key === p)) return p;
    if (searchParams.get("from") || searchParams.get("to")) return "custom";
    return "all";
  });
  const [customFrom, setCustomFrom] = useState<string>(searchParams.get("from") || "");
  const [customTo, setCustomTo] = useState<string>(searchParams.get("to") || "");

  // Load settings once for adsCampaignStartDate.
  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((s) => setSettings(s))
      .catch(() => { /* ignore — preset will just be unavailable */ });
  }, []);

  const adsStart = settings?.adsCampaignStartDate ? new Date(settings.adsCampaignStartDate) : null;

  // Resolve the active date range from preset + custom inputs.
  const activeRange: DateRange | null = useMemo(() => {
    if (preset === "custom") {
      if (!customFrom || !customTo) return null;
      const f = new Date(customFrom);
      const t = new Date(customTo);
      if (isNaN(f.getTime()) || isNaN(t.getTime()) || f > t) return null;
      return { from: startOfDay(f), to: endOfDay(t) };
    }
    return presetToRange(preset, adsStart);
  }, [preset, customFrom, customTo, adsStart]);

  // Re-fetch metrics whenever the active range changes. Also keep the
  // URL in sync so refreshing preserves the view.
  const fetchMetrics = useCallback(async (range: DateRange | null) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (range) {
        qs.set("from", range.from.toISOString());
        qs.set("to", range.to.toISOString());
      }
      const r = await fetch(`/api/admin/metrics?${qs.toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: MetricsResponse = await r.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(activeRange);

    // Mirror state into URL params. ?preset=PRESET, plus from/to only
    // when custom (URL stays clean for presets).
    const qs = new URLSearchParams();
    qs.set("preset", preset);
    if (preset === "custom" && customFrom && customTo) {
      qs.set("from", customFrom);
      qs.set("to", customTo);
    }
    router.replace(`/admin/metrics?${qs.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, adsStart?.getTime()]);

  // Helper to render delta line ("+5 vs previous period" with arrow).
  const renderDelta = (current: number, previous: number) => {
    const diff = current - previous;
    const pct = previous === 0
      ? (current === 0 ? 0 : 100)
      : Math.round(Math.abs((diff / previous) * 100));
    const up = diff > 0;
    const flat = diff === 0;
    return (
      <span className={`text-xs font-semibold flex items-center gap-1 ${
        flat ? "text-gray-400" : up ? "text-green-600" : "text-red-600"
      }`}>
        <span aria-hidden>{flat ? "→" : up ? "↑" : "↓"}</span>
        {flat ? "Same" : `${up ? "+" : "−"}${Math.abs(diff)}`}
        {previous > 0 && !flat && <span className="text-gray-400">({pct}%)</span>}
      </span>
    );
  };

  // Color rules from the brief.
  const activationTone = (r: number) =>
    r >= 35 ? "green" : r >= 20 ? "amber" : "red";
  const dropoffTone = (r: number) =>
    r >= 50 ? "red" : r >= 30 ? "amber" : "green";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Metrics Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Activation, retention, and conversion at a glance.</p>
        </div>

        {/* Filter row */}
        <FilterBar
          preset={preset}
          setPreset={setPreset}
          customFrom={customFrom}
          customTo={customTo}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
          adsStart={adsStart}
          onAdsStartChange={async (val) => {
            // Persist the new ads-campaign start date. Reload settings
            // so the preset becomes usable immediately.
            await fetch("/api/admin/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adsCampaignStartDate: val || null }),
            });
            const r = await fetch("/api/admin/settings", { cache: "no-store" });
            if (r.ok) setSettings(await r.json());
          }}
        />

        {/* Active range indicator */}
        <ActiveRangeStrip
          range={activeRange}
          preset={preset}
          totalSignups={metrics?.current.totalSignups ?? null}
          loading={loading}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-5">{error}</div>
        )}

        {/* 8 metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Total Signups"
            value={metrics?.current.totalSignups}
            sub="Selected period"
            extra={metrics ? renderDelta(metrics.current.totalSignups, metrics.previous.totalSignups) : null}
          />
          <MetricCard
            label="Signups This Week"
            value={metrics?.current.signupsLast7}
            sub="Last 7 days"
            extra={metrics ? renderDelta(metrics.current.signupsLast7, metrics.previous.signupsLast7) : null}
          />
          <MetricCard
            label="Activation Rate"
            value={metrics ? `${metrics.current.activationRate}%` : undefined}
            sub="Users who created 1+ package"
            tone={metrics ? activationTone(metrics.current.activationRate) : undefined}
          />
          <MetricCard
            label="Activated Users"
            value={metrics?.current.activatedUsers}
            sub={metrics ? `out of ${metrics.current.totalSignups} total` : undefined}
          />
          <MetricCard
            label="Active Users (7-day)"
            value={metrics?.current.activeUsers7d}
            sub="Logged in last 7 days"
          />
          <MetricCard
            label="Drop-off Rate"
            value={metrics ? `${metrics.current.dropoffRate}%` : undefined}
            sub="Abandoned after signup"
            tone={metrics ? dropoffTone(metrics.current.dropoffRate) : undefined}
          />
          <MetricCard
            label="Paying Customers"
            value={metrics?.current.paying.total}
            sub={metrics ? `${metrics.current.paying.starter} Starter · ${metrics.current.paying.pro} Pro` : "Active subscriptions"}
          />
          <MetricCard
            label="Trial → Paid"
            value={
              !metrics
                ? undefined
                : metrics.current.trialToPaidRate === null
                  ? "—"
                  : `${metrics.current.trialToPaidRate}%`
            }
            sub={
              metrics?.current.trialToPaidRate === null
                ? "Not enough data"
                : metrics
                  ? `Of ${metrics.current.trialsEnded} expired trial${metrics.current.trialsEnded === 1 ? "" : "s"}`
                  : undefined
            }
          />
        </div>

        {/* Funnel */}
        <FunnelCard funnel={metrics?.current.funnel} loading={loading} />

        {/* Link out to the full users table */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-gray-500">
            Need to drill down into who&apos;s in this cohort? Open the users table — it lists every signup with full setup status.
          </p>
          <button
            onClick={() => router.push("/admin/users")}
            className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            Open Users →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI parts

function FilterBar({
  preset, setPreset,
  customFrom, customTo,
  setCustomFrom, setCustomTo,
  adsStart, onAdsStartChange,
}: {
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  customFrom: string; customTo: string;
  setCustomFrom: (s: string) => void; setCustomTo: (s: string) => void;
  adsStart: Date | null;
  onAdsStartChange: (val: string) => Promise<void>;
}) {
  const [adsEditing, setAdsEditing] = useState(false);
  const [adsDraft, setAdsDraft] = useState(adsStart ? toInputDate(adsStart) : "");
  useEffect(() => { setAdsDraft(adsStart ? toInputDate(adsStart) : ""); }, [adsStart]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as PresetKey)}
          className="text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          {PRESETS.map((p) => (
            <option
              key={p.key}
              value={p.key}
              disabled={p.key === "sinceAds" && !adsStart}
            >
              {p.label}{p.key === "sinceAds" && !adsStart ? " (set date first)" : ""}
            </option>
          ))}
        </select>

        {preset === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Ads start:</span>
          {adsEditing ? (
            <>
              <input
                type="date"
                value={adsDraft}
                onChange={(e) => setAdsDraft(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                onClick={async () => { await onAdsStartChange(adsDraft); setAdsEditing(false); }}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md"
              >
                Save
              </button>
              <button
                onClick={() => { setAdsEditing(false); setAdsDraft(adsStart ? toInputDate(adsStart) : ""); }}
                className="text-xs text-gray-500 hover:text-gray-900 px-1"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setAdsEditing(true)}
              className="text-xs font-semibold text-gray-700 hover:text-blue-700 underline-offset-2 hover:underline"
            >
              {adsStart ? formatDate(adsStart) : "Set date"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveRangeStrip({
  range, preset, totalSignups, loading,
}: {
  range: DateRange | null;
  preset: PresetKey;
  totalSignups: number | null;
  loading: boolean;
}) {
  const days = range
    ? Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86400000))
    : 0;
  return (
    <div className="bg-blue-50 border border-blue-100 text-blue-900 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden>📅</span>
        {!range ? (
          <span>Pick a range to see metrics.</span>
        ) : preset === "all" ? (
          <span>Showing data from <strong>all time</strong></span>
        ) : (
          <span>
            Showing data from <strong>{formatDate(range.from)}</strong>
            {" → "}
            <strong>{formatDate(range.to)}</strong>{" "}
            <span className="text-blue-700/70">({days} day{days === 1 ? "" : "s"})</span>
          </span>
        )}
      </div>
      <div className="text-xs font-semibold text-blue-700">
        {loading ? "Loading…" : totalSignups !== null ? `Total signups in this period: ${totalSignups}` : ""}
      </div>
    </div>
  );
}

type Tone = "green" | "amber" | "red";
const TONE_STYLES: Record<Tone, { value: string; chip: string }> = {
  green: { value: "text-green-700",  chip: "bg-green-100 text-green-700 border-green-200" },
  amber: { value: "text-amber-700",  chip: "bg-amber-100 text-amber-700 border-amber-200" },
  red:   { value: "text-red-700",    chip: "bg-red-100 text-red-700 border-red-200" },
};

function MetricCard({
  label, value, sub, extra, tone,
}: {
  label: string;
  value: number | string | undefined;
  sub?: string;
  extra?: React.ReactNode;
  tone?: Tone;
}) {
  const toneCls = tone ? TONE_STYLES[tone].value : "text-gray-900";
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5 ${toneCls}`}>
        {value === undefined ? <span className="inline-block h-7 w-16 bg-gray-100 rounded shimmer align-middle" /> : value}
      </p>
      {sub && <p className="text-xs text-gray-500 font-medium mt-1">{sub}</p>}
      {extra && <div className="mt-1.5">{extra}</div>}
    </div>
  );
}

function FunnelCard({
  funnel, loading,
}: {
  funnel: MetricsResponse["current"]["funnel"] | undefined;
  loading: boolean;
}) {
  const rows = funnel ? [
    { label: "Signups",           value: funnel.signups },
    { label: "Created Package",   value: funnel.createdPackage },
    { label: "Shared Link",       value: funnel.sharedLink },
    { label: "Got First Booking", value: funnel.gotFirstBooking },
    { label: "Paid Subscriber",   value: funnel.paidSubscriber },
  ] : [];
  const denom = funnel?.signups || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-900">Activation Funnel</h2>
        <span className="text-[11px] text-gray-400 font-medium">% of signups in this period</span>
      </div>
      {loading || !funnel ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 bg-gray-100 rounded-md shimmer" />
          ))}
        </div>
      ) : denom === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">No users in this period yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, i) => {
            const pct = denom > 0 ? (row.value / denom) * 100 : 0;
            const pctStr = `${Math.round(pct * 10) / 10}%`;
            return (
              <div key={row.label} className="grid grid-cols-[140px_1fr_70px_50px] sm:grid-cols-[180px_1fr_80px_60px] gap-2 items-center">
                <span className="text-xs font-semibold text-gray-700 truncate">{row.label}</span>
                <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: ["#2563eb", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7"][i % 5],
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-900 text-right tabular-nums">{pctStr}</span>
                <span className="text-xs text-gray-500 text-right tabular-nums">{row.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
