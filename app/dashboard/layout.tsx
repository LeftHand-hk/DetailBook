"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { isLoggedIn, logout, getUser, getPackages, syncFromServer } from "@/lib/storage";
import type { User } from "@/types";
import Logo from "@/components/Logo";
import TrialEndedModal from "@/components/TrialEndedModal";
import { getTrialPhase } from "@/lib/trial";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  pro?: boolean;
  badge?: string;
}

const mainNav: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 14a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3z" /></svg>,
  },
  {
    label: "Bookings",
    href: "/dashboard/bookings",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
  {
    label: "Packages",
    href: "/dashboard/packages",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  },
  {
    label: "Booking Page",
    href: "/dashboard/booking-page",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>,
  },
  {
    label: "Deposit Payments",
    href: "/dashboard/payments",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  },
];

const businessNav: NavItem[] = [
  {
    label: "Staff",
    href: "/dashboard/staff",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    pro: true,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    pro: true,
  },
  {
    label: "Reminders",
    href: "/dashboard/messages",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    pro: true,
  },
];

const settingsNav: NavItem[] = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  },
  {
    label: "Support",
    href: "/dashboard/support",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Customers sidebar badge — fetched once on dashboard mount and
  // refreshed when /dashboard/customers signals a change via the
  // customers-changed window event (see customers list page).
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => {
      fetch("/api/customers?count=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data: { count?: number }) => setCustomerCount(Number(data.count) || 0))
        .catch(() => {});
    };
    // The customer-count badge is cosmetic — defer it so it doesn't compete
    // with the critical user sync for a DB connection on first paint (that
    // contention is what made writes like the design switch time out).
    const t = window.setTimeout(refresh, 2500);
    window.addEventListener("detailbook:customers-changed", refresh);
    return () => { window.clearTimeout(t); window.removeEventListener("detailbook:customers-changed", refresh); };
  }, []);
  const [checked, setChecked] = useState(false);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  // Dashboard dark mode. Persisted in localStorage; applied as a
  // `db-dark` class on the dashboard root, which a scoped block in
  // globals.css restyles (so we don't need dark: variants on every
  // element). Seeded from storage in the initializer to avoid a
  // light→dark flash on load.
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("db_dark") === "1"; } catch { return false; }
  });
  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      try { localStorage.setItem("db_dark", next ? "1" : "0"); } catch { /* private mode */ }
      return next;
    });
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    setImpersonating(document.cookie.split("; ").some((c) => c.startsWith("detailbook_impersonating=1")));
  }, []);

  const stopImpersonating = async () => {
    try {
      await fetch("/api/admin/users/impersonate", { method: "DELETE" });
    } catch { /* ignore */ }
    try {
      localStorage.setItem("detailbook_logged_in", "false");
      localStorage.removeItem("detailbook_user");
    } catch { /* ignore */ }
    window.location.href = "/admin/users";
  };

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("upgrade_banner_dismissed") === "true") {
      setUpgradeDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    const u = getUser();
    setUserState(u);
    // Only release the loading screen if we already have cached user
    // data. After a fresh redirect from /onboarding the local cache can
    // be empty — flashing the dashboard chrome with no user data looks
    // half-broken, so we keep the loader up until syncFromServer lands.
    if (u) setChecked(true);

    // Pull fresh data from the database
    syncFromServer()
      .then(() => {
        const freshUser = getUser();
        if (freshUser) {
          setUserState(freshUser);
          // Suspended OR expired users are confined to /billing until
          // they reactivate. Avoid redirect loops by allowing the page.
          const fu = freshUser as any;
          if ((fu.suspended === true || fu.subscriptionStatus === "expired") && pathname !== "/dashboard/billing") {
            router.replace("/dashboard/billing");
            return;
          }
          // New signups must complete onboarding before reaching the
          // dashboard. The current onboarding can create the first package
          // without Paddle, so packages are now a valid completion signal.
          const NEW_FLOW_SHIP_DATE = new Date("2026-05-13T00:00:00Z");
          const createdAt = (freshUser as any).createdAt;
          const isNewSignup = createdAt && new Date(createdAt) >= NEW_FLOW_SHIP_DATE;
          const hasPaddle = Boolean((freshUser as any).paddleCustomerId);
          const hasPackages = getPackages().length > 0;
          if (isNewSignup && !hasPaddle && !hasPackages) {
            router.replace("/onboarding");
            return;
          }
        }
        setChecked(true);
      })
      .catch(() => {
        // Server sync failed; local data remains as fallback. Release
        // the loader anyway so the user isn't stuck on a spinner.
        setChecked(true);
      });
    // Run once on mount only — pathname changes shouldn't re-sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lockout guard for suspended / expired accounts. The mount effect above
  // catches first paint; this one keeps them pinned to /billing on every
  // subsequent navigation so they can't open another dashboard page.
  useEffect(() => {
    if (!user) return;
    const u = user as any;
    if ((u.suspended === true || u.subscriptionStatus === "expired") && pathname !== "/dashboard/billing") {
      router.replace("/dashboard/billing");
    }
  }, [pathname, user, router]);

  // "Last active" heartbeat — pings /api/auth/me on mount and every 5
  // minutes after that. The endpoint already has its own throttled
  // lastLoginAt refresh, so a remember-me user looks active in the admin
  // dashboard without paying the cost per authenticated API call.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ping = () => { fetch("/api/auth/me", { cache: "no-store" }).catch(() => {}); };
    // Defer the first heartbeat off the first-paint burst — it's just a
    // "last active" timestamp, nothing renders from it.
    const first = window.setTimeout(ping, 4000);
    const id = window.setInterval(ping, 5 * 60 * 1000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, []);

  // Reset the main scroll area to top on every *real* route change.
  // We compare against the last pathname we acted on because a few
  // pages (booking-page editor, dashboard home) re-render with the
  // same pathname when query params or in-page state change — without
  // the ref guard the scroll snapped back to the top mid-scroll, which
  // was the "scroll keeps resetting / can't reach the bottom" bug. We
  // also no longer call window.scrollTo: the dashboard scrolls through
  // the nested <main>, and a window scroll-to-zero on top of that was
  // jerking mobile users back when they tried to scroll down.
  const mainRef = useRef<HTMLElement | null>(null);
  const lastScrolledPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastScrolledPathRef.current === pathname) return;
    lastScrolledPathRef.current = pathname;
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl animate-pulse" />
            <svg className="relative animate-spin w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-gray-700 font-semibold text-sm">Preparing your dashboard…</p>
          <p className="text-gray-400 text-xs">Loading bookings, calendar, and settings</p>
        </div>
      </div>
    );
  }

  const isPro = user?.plan === "pro";

  const trialDaysLeft = (() => {
    if (!user?.trialEndsAt) return null;
    const diff = new Date(user.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  })();
  const showTrialStatus = (user as any)?.subscriptionStatus !== "active" && trialDaysLeft !== null;
  const trialStatusLabel = showTrialStatus
    ? trialDaysLeft > 0
      ? `${trialDaysLeft} trial day${trialDaysLeft === 1 ? "" : "s"} left`
      : "Trial ended"
    : null;
  const trialDays = trialDaysLeft ?? 0;

  // Top-of-dashboard trial UX. Locked accounts (suspended / admin-expired /
  // canceled) are already confined to /billing by the redirects above, so
  // the banner + modal only drive the no-card trial → paid conversion.
  const trialPhase = getTrialPhase(user as any);
  const trialLocked =
    (user as any)?.suspended === true ||
    ["expired", "canceled"].includes(String((user as any)?.subscriptionStatus || "").toLowerCase());
  const showTrialEndedModal = !trialLocked && trialPhase === "paused" && pathname !== "/dashboard/billing";

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = pathname === item.href;
    const locked = item.pro && !isPro;

    if (locked) {
      return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 cursor-not-allowed opacity-50 select-none">
          {item.icon}
          <span className="flex-1">{item.label}</span>
          <span className="text-[10px] font-bold bg-white/10 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>
        </div>
      );
    }

    return (
      <Link
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
          active
            ? "bg-white/[0.10] text-white"
            : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        <span className={active ? "text-white" : "text-slate-500 group-hover:text-slate-300 transition-colors"}>{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.href === "/dashboard/support" && isPro && (
          <span className="text-[9px] font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Priority</span>
        )}
        {item.badge && (
          <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{item.badge}</span>
        )}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em] px-3 mb-1.5 mt-5">{label}</p>
  );

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full bg-[#0B1120]">
      {/* Logo */}
      <div className="px-5 py-5 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center" onClick={() => setSidebarOpen(false)}>
          <Logo size="sm" />
        </Link>
      </div>

      {/* Business Card */}
      {user && (
        <div className="mx-4 mb-2">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
            <div className="flex items-center gap-3">
              {user.logo ? (
                <img src={user.logo} alt="" className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                  {user.businessName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-semibold truncate">{user.businessName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isPro ? (
                    <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Pro</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-wider">Starter</span>
                  )}
                  <span className="text-[11px] text-slate-500">${isPro ? "50" : "24"}/mo</span>
                </div>
                {trialStatusLabel && (
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setSidebarOpen(false)}
                    className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                      trialDays === 0
                        ? "text-red-300 hover:text-red-200"
                        : trialDays <= 2
                          ? "text-amber-300 hover:text-amber-200"
                          : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      trialDays === 0
                        ? "bg-red-400"
                        : trialDays <= 2
                          ? "bg-amber-400"
                          : "bg-green-400"
                    }`} />
                    {trialStatusLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation — on Starter the entire Business section is
          Pro-locked (Staff / Analytics / Reminders), so it gets pushed
          BELOW System and visually marked as upgrade material. Pro
          accounts keep the original order: Main → Business → System. */}
      <div className="flex-1 px-3 overflow-y-auto scrollbar-thin">
        <SectionLabel label="Main" />
        <nav className="space-y-0.5">
          {mainNav.map((item) => (
            <NavLink
              key={item.href}
              item={
                item.href === "/dashboard/customers" && customerCount && customerCount > 0
                  ? { ...item, badge: String(customerCount) }
                  : item
              }
            />
          ))}
        </nav>

        {isPro && (
          <>
            <SectionLabel label="Business" />
            <nav className="space-y-0.5">
              {businessNav.map((item) => <NavLink key={item.href} item={item} />)}
            </nav>
          </>
        )}

        <SectionLabel label="System" />
        <nav className="space-y-0.5">
          {settingsNav.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        {!isPro && (
          <>
            <SectionLabel label="Pro features" />
            <nav className="space-y-0.5">
              {businessNav.map((item) => <NavLink key={item.href} item={item} />)}
            </nav>
          </>
        )}
      </div>

      {/* Upgrade Banner (Starter only, dismissible) */}
      {!isPro && !upgradeDismissed && (
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 relative">
            <button
              onClick={() => { setUpgradeDismissed(true); localStorage.setItem("upgrade_banner_dismissed", "true"); }}
              className="absolute top-2 right-2 text-white/20 hover:text-white/50 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <p className="text-white/60 text-xs font-bold">Upgrade to Pro</p>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed mb-3">
              Unlock analytics, SMS & more
            </p>
            <Link
              href="/dashboard/billing"
              className="block w-full text-center bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold py-2 rounded-lg transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}


      {/* Bottom Actions */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-white/[0.04] pt-3 flex-shrink-0">
        <Link
          href={`/book/${user?.slug}`}
          target="_blank"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Booking Page
        </Link>
        <button
          onClick={toggleDark}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          {dark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span className="flex-1 text-left">{dark ? "Light mode" : "Dark mode"}</span>
          <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${dark ? "bg-blue-500" : "bg-white/15"}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${dark ? "translate-x-4.5" : "translate-x-1"}`} style={{ transform: dark ? "translateX(18px)" : "translateX(3px)" }} />
          </span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    // `h-screen` resolves to 100vh, which on iOS Safari is taller than
    // the visible viewport (it counts the address bar's space). The
    // result was the bottom of the dashboard hiding under the bar and
    // the mobile top-bar getting pushed above the visible area when
    // Safari animated its chrome. `100dvh` is the dynamic viewport
    // height — it shrinks when the address bar shows and grows when it
    // hides, keeping the whole dashboard inside the visible area at
    // all times. Supported in iOS Safari 15.4+ (March 2022); we keep
    // h-screen as a fallback for anything older.
    <div className={`flex h-screen bg-gray-50 overflow-hidden ${dark ? "db-dark" : ""}`} style={{ height: "100dvh" }}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#0B1120] flex-shrink-0 border-r border-white/[0.04]">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full w-[75vw] max-w-[280px] shadow-2xl animate-slideInLeft"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Logo size="xs" darkText />
          </div>
          <div className="flex items-center gap-2">
            {trialStatusLabel ? (
              <Link
                href="/dashboard/billing"
                aria-label={trialDays === 0 ? "Trial ended. Open billing." : `${trialDays} trial days left. Open billing.`}
                className={`inline-flex h-9 items-center overflow-hidden rounded-lg border shadow-sm transition-colors ${
                  trialDays === 0
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : trialDays <= 2
                      ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                }`}
              >
                <span className="flex h-full items-center gap-1.5 px-2.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-wider">Trial</span>
                </span>
                <span className={`flex h-full items-center border-l px-2.5 text-xs font-black ${
                  trialDays === 0
                    ? "border-red-200 bg-red-100/70"
                    : trialDays <= 2
                      ? "border-amber-200 bg-amber-100/70"
                      : "border-blue-200 bg-blue-100/70"
                }`}>
                  {trialDays === 0 ? "Ended" : `${trialDays} day${trialDays === 1 ? "" : "s"}`}
                </span>
              </Link>
            ) : isPro ? (
              <span className="text-[10px] font-bold bg-gray-700 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">Pro</span>
            ) : null}
          </div>
        </div>

        {/* Impersonation banner — admin viewing as this client */}
        {impersonating && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-sm bg-purple-600 text-white">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span><strong>Admin view:</strong> you are viewing this dashboard as <strong>{user?.businessName || user?.email}</strong>. Any changes you make will affect their account.</span>
            </div>
            <button
              onClick={stopImpersonating}
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-purple-700 hover:bg-purple-50 transition-colors"
            >
              Exit & return to admin
            </button>
          </div>
        )}


        {/* Trial banner — non-blocking, pinned above the scrolling content
            so it stays visible for the whole 7-day trial. */}
        {/* Page Content. iOS safe-area padding so content at the very
            bottom isn't hidden behind the home indicator on devices
            with a gesture bar. */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto bg-gray-50/80"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {children}
        </main>
      </div>

      {/* Trial-ended blocking modal — the only hard gate; appears once the
          trial lapses unpaid, on every dashboard page except /billing. */}
      {showTrialEndedModal && <TrialEndedModal />}
    </div>
  );
}
