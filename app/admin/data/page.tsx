"use client";

import { useEffect, useMemo, useState } from "react";

interface UserSummary {
  id: string;
  email: string;
  businessName: string | null;
  name: string | null;
  plan: string;
  createdAt: string;
}

type FullUser = Record<string, unknown> & {
  id: string;
  email: string;
  _count?: { packages?: number; bookings?: number; staff?: number };
};

// Whitelist of editable field names — must stay in sync with
// EDITABLE_FIELDS in /api/admin/users/[id]/route.ts. Anything not
// listed here renders as read-only (e.g. id, createdAt, paddleCustomerId).
const EDITABLE_FIELDS = new Set<string>([
  "email", "name", "businessName", "phone",
  "slug", "address", "city", "serviceType", "timezone", "bio",
  "yearsInBusiness", "instagram", "facebook", "website",
  "serviceAreas", "businessHours",
  "bookingPageTitle", "bookingPageSubtitle", "bookingPageTheme",
  "accentColor", "serviceLayout", "bannerOverlayOpacity",
  "showRating", "showSocialLinks", "showServiceAreas",
  "showBusinessHours", "showTrustBadges",
  "thankYouMessage", "termsText", "customMessage", "advanceBookingDays",
  "plan", "trialEndsAt", "subscriptionStatus", "suspended",
]);

const BOOLEAN_FIELDS = new Set<string>([
  "showRating", "showSocialLinks", "showServiceAreas",
  "showBusinessHours", "showTrustBadges", "suspended",
]);

const NUMBER_FIELDS = new Set<string>([
  "yearsInBusiness", "advanceBookingDays", "bannerOverlayOpacity",
]);

const TEXTAREA_FIELDS = new Set<string>([
  "bio", "thankYouMessage", "termsText", "customMessage",
]);

const JSON_FIELDS = new Set<string>([
  "businessHours",
]);

// Group every User column into a labelled section so the admin can scan
// what each customer filled in. Keys not listed here fall into "Other"
// at the bottom — keeps the page resilient when new schema fields land.
const SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: "Account",
    keys: ["id", "email", "name", "businessName", "phone", "createdAt", "updatedAt", "lastLoginAt", "signupIp", "signupCountry"],
  },
  {
    title: "Business Profile",
    keys: ["slug", "address", "city", "serviceType", "timezone", "bio", "yearsInBusiness", "instagram", "facebook", "website", "rating", "reviewCount", "serviceAreas", "businessHours"],
  },
  {
    title: "Booking Page",
    keys: ["bookingPageTitle", "bookingPageSubtitle", "bookingPageTheme", "accentColor", "serviceLayout", "bannerOverlayOpacity", "showRating", "showSocialLinks", "showServiceAreas", "showBusinessHours", "showTrustBadges", "thankYouMessage", "termsText", "customMessage", "advanceBookingDays", "logo", "coverImage", "bannerImage"],
  },
  {
    title: "Deposits & Payments",
    keys: ["requireDeposit", "depositPercentage", "paymentMethods"],
  },
  {
    title: "Subscription",
    keys: ["plan", "trialEndsAt", "subscriptionStatus", "paddleCustomerId", "paddleSubscriptionId", "promoCodeUsed", "promoDiscount", "suspended"],
  },
  {
    title: "Notifications",
    keys: ["emailReminders", "emailConfirmations", "emailRemindersEnabled", "smsConfirmations", "smsRemindersEnabled", "smsTemplates", "emailTemplates"],
  },
  {
    title: "Google Calendar",
    keys: ["googleCalendarEnabled", "googleCalendarId"],
  },
  {
    title: "Onboarding",
    keys: ["onboardingDismissed", "onboardingCompletedAt", "onboardingProgress"],
  },
];

// The welcome-email columns are rendered by <WelcomeEmailsCard /> with
// status badges + Resend/Test buttons rather than the generic FieldRow
// view, so we exclude them from the generic SECTIONS catch-all.
const WELCOME_EMAIL_KEYS = new Set([
  "welcomeEmailDay0At",
  "welcomeEmailDay2At",
  "welcomeEmailDay2Skipped",
  "welcomeEmailDay5At",
  "welcomeEmailDay13At",
  "welcomeEmailsSent",
  "welcomeEmailLastSentAt",
  "welcomeEmailsPaused",
]);

type WelcomeKey = "day0" | "day2";
const WELCOME_DEFS: { key: WelcomeKey; label: string; col: string }[] = [
  { key: "day0", label: "Day 0 — Welcome",    col: "welcomeEmailDay0At" },
  { key: "day2", label: "Day 2 — Engagement", col: "welcomeEmailDay2At" },
];

function formatTs(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

function WelcomeEmailsCard({ user, onAction }: { user: Record<string, unknown>; onAction: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testStatus, setTestStatus] = useState<string>("");

  const paused = Boolean(user.welcomeEmailsPaused);
  const day2Skipped = Boolean(user.welcomeEmailDay2Skipped);

  const resend = async (key: WelcomeKey) => {
    setPending(key);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/resend-welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(`Failed: ${data.error || res.status}`);
      onAction();
    } finally {
      setPending(null);
    }
  };

  const runTestSequence = async () => {
    if (!testTo.trim()) return;
    setPending("test");
    setTestStatus("Sending…");
    try {
      const res = await fetch(`/api/admin/welcome-email-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim(), all: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestStatus(`Failed: ${data.error || res.status}`);
      } else {
        setTestStatus(`Sent 4 emails to ${data.sentTo || testTo}.`);
      }
    } catch (err: any) {
      setTestStatus(`Failed: ${err.message || "network error"}`);
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Welcome Emails</h3>
      <div className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 space-y-2">
        {paused && (
          <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            User unsubscribed — no more welcome emails will be sent.
          </div>
        )}
        {WELCOME_DEFS.map((def) => {
          const ts = formatTs(user[def.col]);
          const skipped = def.key === "day2" && day2Skipped;
          const statusText = ts
            ? skipped ? `Skipped (had packages) on ${ts}` : `Sent on ${ts}`
            : "Pending";
          const statusClass = ts
            ? skipped ? "text-gray-500" : "text-green-700"
            : "text-blue-700";
          return (
            <div key={def.key} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{def.label}</p>
                <p className={`text-xs font-medium ${statusClass}`}>{statusText}</p>
              </div>
              <button
                onClick={() => resend(def.key)}
                disabled={pending === def.key}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {pending === def.key ? "Sending…" : ts ? "Resend" : "Send now"}
              </button>
            </div>
          );
        })}

        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Test sequence</p>
          <p className="text-[11px] text-gray-500 mb-2">Send all 4 welcome emails to a test address (uses this user&apos;s businessName for personalisation, doesn&apos;t touch their tracking).</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="test@example.com"
              className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={runTestSequence}
              disabled={!testTo.trim() || pending === "test"}
              className="text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
            >
              {pending === "test" ? "Sending…" : "Send all 4"}
            </button>
          </div>
          {testStatus && (
            <p className="text-[11px] text-gray-600 mt-2">{testStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function isImageDataUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // ISO date heuristic — render in local short form
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toLocaleString();
    }
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function FieldRow({ label, value }: { label: string; value: unknown }) {
  // Render base64 images as a thumbnail instead of dumping ~50KB of text.
  if (isImageDataUrl(value)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="max-h-32 rounded-lg border border-gray-200 bg-gray-50" />
        </div>
      </div>
    );
  }

  const formatted = formatValue(value);
  const isMultiline = formatted.includes("\n") || formatted.length > 120;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      {isMultiline ? (
        <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-mono bg-gray-50 rounded-md p-2 border border-gray-100">{formatted}</pre>
      ) : (
        <div className="text-sm text-gray-900 break-words">{formatted}</div>
      )}
    </div>
  );
}

// One editable input per row. The shape (text / textarea / number /
// checkbox / textarea-JSON) is picked from the field name so the
// admin gets a sensible control without us hand-building a form.
function EditableRow({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  // Booleans render as a toggle so the admin can flip flags quickly.
  if (BOOLEAN_FIELDS.has(fieldKey)) {
    const checked = Boolean(value);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0 items-center">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldKey}</div>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-gray-900"
          />
          <span className="text-sm text-gray-700">{checked ? "Yes" : "No"}</span>
        </label>
      </div>
    );
  }

  if (NUMBER_FIELDS.has(fieldKey)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldKey}</div>
        <input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full max-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>
    );
  }

  // serviceAreas — comma-separated text → array on save.
  if (fieldKey === "serviceAreas") {
    const text = Array.isArray(value) ? value.join(", ") : String(value || "");
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldKey}</div>
        <div>
          <input
            type="text"
            value={text}
            onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="Austin, Round Rock, Cedar Park"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <p className="text-[11px] text-gray-400 mt-1">Comma-separated.</p>
        </div>
      </div>
    );
  }

  // businessHours and any other JSON field — give the admin a JSON
  // textarea. Invalid JSON keeps the previous value (set on blur).
  if (JSON_FIELDS.has(fieldKey)) {
    const stringified = (() => {
      try { return JSON.stringify(value ?? {}, null, 2); } catch { return ""; }
    })();
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldKey}</div>
        <div>
          <textarea
            defaultValue={stringified}
            onBlur={(e) => {
              try { onChange(JSON.parse(e.target.value)); }
              catch { /* leave previous value, indicate error */ }
            }}
            rows={Math.min(12, Math.max(4, stringified.split("\n").length))}
            className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <p className="text-[11px] text-gray-400 mt-1">Save on blur. Invalid JSON is ignored.</p>
        </div>
      </div>
    );
  }

  if (TEXTAREA_FIELDS.has(fieldKey)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldKey}</div>
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>
    );
  }

  // Default: single-line text input. Slug field gets a help line so
  // the admin knows what they're editing changes the public URL.
  const isSlug = fieldKey === "slug";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{fieldKey}</div>
      <div>
        <input
          type="text"
          value={typeof value === "string" ? value : value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
        {isSlug && (
          <p className="text-[11px] text-gray-400 mt-1">
            Public booking-page URL — appears at <code className="font-mono">/book/{`{slug}`}</code>. Lowercase letters, digits, and hyphens only.
          </p>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  rows,
  userId,
  onSaved,
}: {
  title: string;
  rows: { key: string; value: unknown }[];
  userId: string;
  onSaved: (updated: FullUser) => void;
}) {
  const editableRows = rows.filter((r) => EDITABLE_FIELDS.has(r.key));
  const readOnlyRows = rows.filter((r) => !EDITABLE_FIELDS.has(r.key));
  const canEdit = editableRows.length > 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    const seed: Record<string, unknown> = {};
    for (const r of editableRows) seed[r.key] = r.value;
    setDraft(seed);
    setEditing(true);
    setError("");
  };

  const cancel = () => {
    setEditing(false);
    setDraft({});
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      onSaved(data as FullUser);
      setEditing(false);
      setDraft({});
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={cancel}
              disabled={saving}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 px-3 py-1 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-50/50 border border-gray-100 rounded-xl px-4">
        {editing
          ? editableRows.map((r) => (
              <EditableRow
                key={r.key}
                fieldKey={r.key}
                value={r.key in draft ? draft[r.key] : r.value}
                onChange={(next) => setDraft((d) => ({ ...d, [r.key]: next }))}
              />
            ))
          : rows.map((r) => <FieldRow key={r.key} label={r.key} value={r.value} />)}

        {/* When editing, surface read-only rows separately so the admin
            still sees the full record (e.g. createdAt next to email). */}
        {editing && readOnlyRows.length > 0 && (
          <div className="pt-2 mt-2 border-t border-dashed border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-1">Read-only</p>
            {readOnlyRows.map((r) => <FieldRow key={r.key} label={r.key} value={r.value} />)}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-2 font-medium">{error}</p>
      )}
    </div>
  );
}

export default function AdminDataPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FullUser | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: UserSummary[]) => {
        if (cancelled) return;
        setUsers(Array.isArray(data) ? data : []);
        setLoadingList(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err.message || "Failed to load users");
        setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError("");
    setDetail(null);
    fetch(`/api/admin/users/${selectedId}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: FullUser) => {
        if (cancelled) return;
        setDetail(data);
        setLoadingDetail(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err.message || "Failed to load user");
        setLoadingDetail(false);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.email, u.businessName, u.name].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [users, search]);

  const reloadDetail = () => {
    if (!selectedId) return;
    fetch(`/api/admin/users/${selectedId}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: FullUser) => setDetail(data))
      .catch(() => { /* leave previous detail in place */ });
  };

  // Build the section payload for the selected user. Welcome-email
  // columns are rendered by <WelcomeEmailsCard /> separately so we
  // hide them here to avoid duplicating the info.
  const detailSections = useMemo(() => {
    if (!detail) return [];
    const consumed = new Set<string>();
    const sections = SECTIONS.map((sec) => ({
      title: sec.title,
      rows: sec.keys
        .filter((k) => k in detail)
        .map((k) => { consumed.add(k); return { key: k, value: detail[k] }; }),
    })).filter((s) => s.rows.length > 0);

    const otherRows = Object.keys(detail)
      .filter((k) => !consumed.has(k) && k !== "_count" && !WELCOME_EMAIL_KEYS.has(k))
      .map((k) => ({ key: k, value: detail[k] }));
    if (otherRows.length > 0) {
      sections.push({ title: "Other", rows: otherRows });
    }
    return sections;
  }, [detail]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Customer Data</h1>
          <p className="text-sm text-gray-500 mt-1">
            Everything each customer filled in at signup, onboarding, and in their settings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* User list */}
          <aside className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
            <div className="p-3 border-b border-gray-100 flex-shrink-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email, name, business…"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingList && <div className="p-4 text-sm text-gray-400">Loading…</div>}
              {listError && <div className="p-4 text-sm text-red-600">{listError}</div>}
              {!loadingList && !listError && filtered.length === 0 && (
                <div className="p-4 text-sm text-gray-400">No users match.</div>
              )}
              {filtered.map((u) => {
                const active = u.id === selectedId;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
                      active ? "bg-gray-900 text-white" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`text-sm font-semibold truncate ${active ? "text-white" : "text-gray-900"}`}>
                      {u.businessName || u.name || u.email}
                    </div>
                    <div className={`text-xs truncate ${active ? "text-white/70" : "text-gray-500"}`}>
                      {u.email}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${active ? "text-white/50" : "text-gray-400"}`}>
                      {u.plan} · joined {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Detail panel */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 min-h-[400px]">
            {!selectedId && (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 py-20">
                Select a user from the list to see everything they filled in.
              </div>
            )}
            {selectedId && loadingDetail && (
              <div className="text-sm text-gray-400 py-10">Loading…</div>
            )}
            {selectedId && detailError && (
              <div className="text-sm text-red-600 py-4">{detailError}</div>
            )}
            {selectedId && detail && (
              <div className="space-y-6">
                <header className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {(detail.businessName as string) || (detail.name as string) || (detail.email as string)}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">{detail.email as string}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      Plan: {(detail.plan as string) || "—"}
                    </span>
                    {Boolean(detail.suspended) && (
                      <span className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-100">Suspended</span>
                    )}
                    {detail._count && (
                      <span className="px-2 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-100">
                        {detail._count.packages || 0} pkg · {detail._count.bookings || 0} bk
                      </span>
                    )}
                  </div>
                </header>

                <WelcomeEmailsCard user={detail} onAction={reloadDetail} />

                {detailSections.map((sec) => (
                  <SectionCard
                    key={sec.title}
                    title={sec.title}
                    rows={sec.rows}
                    userId={detail.id as string}
                    onSaved={(updated) => setDetail(updated)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
