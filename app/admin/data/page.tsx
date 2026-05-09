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
    title: "Onboarding & Welcome Emails",
    keys: ["onboardingDismissed", "onboardingCompletedAt", "onboardingProgress", "welcomeEmailsSent", "welcomeEmailLastSentAt", "welcomeEmailsPaused"],
  },
];

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

  // Build the section payload for the selected user. Keys present in the
  // user record but not in any SECTIONS config end up in "Other" so we
  // never silently drop a column.
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
      .filter((k) => !consumed.has(k) && k !== "_count")
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

                {detailSections.map((sec) => (
                  <div key={sec.title}>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      {sec.title}
                    </h3>
                    <div className="bg-gray-50/50 border border-gray-100 rounded-xl px-4">
                      {sec.rows.map((row) => (
                        <FieldRow key={row.key} label={row.key} value={row.value} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
