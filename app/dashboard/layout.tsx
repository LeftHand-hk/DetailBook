"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { isLoggedIn, logout, getUser, initializeDemo, syncFromServer } from "@/lib/storage";
import type { User } from "@/types";
import { LogoIcon, LogoWordmark } from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import SetupExperience from "@/components/SetupExperience";

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
    label: "Payments",
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
    label: "Messages",
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
  const [checked, setChecked] = useState(false);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

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
    initializeDemo();
    const u = getUser();
    setUserState(u);
    setChecked(true);

    // Pull fresh data from the database
    syncFromServer()
      .then(() => {
        const freshUser = getUser();
        if (freshUser) {
          setUserState(freshUser);
          // Suspended users are confined to /billing until they
          // reactivate. Avoid redirect loops by allowing /dashboard/billing.
          if ((freshUser as any).suspended === true && pathname !== "/dashboard/billing") {
            router.replace("/dashboard/billing");
          }
        }
      })
      .catch(() => {
        // Server sync failed; local data remains as fallback
      });
    // Run once on mount only — pathname changes shouldn't re-sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
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
  const isOnTrial = trialDaysLeft !== null && trialDaysLeft > 0;

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
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
          <LogoIcon size={32} />
          <LogoWordmark size="text-lg" />
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
                  <span className="text-[11px] text-slate-500">${isPro ? "50" : "29"}/mo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 px-3 overflow-y-auto scrollbar-thin">
        <SectionLabel label="Main" />
        <nav className="space-y-0.5">
          {mainNav.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        <SectionLabel label="Business" />
        <nav className="space-y-0.5">
          {businessNav.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        <SectionLabel label="System" />
        <nav className="space-y-0.5">
          {settingsNav.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>
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

      {/* Pro badge (Pro only) */}
      {isPro && (
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
            </div>
            <div>
              <p className="text-white text-xs font-bold">Pro Plan Active</p>
              <p className="text-slate-500 text-[10px]">All features unlocked</p>
            </div>
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
            <div className="flex items-center gap-2">
              <LogoIcon size={28} />
              <LogoWordmark darkText size="text-base" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {isPro && (
              <span className="text-[10px] font-bold bg-gray-700 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">Pro</span>
            )}
          </div>
        </div>

        {/* Desktop floating notification box — fixed in the top-right corner */}
        <div className="hidden lg:block fixed top-4 right-6 z-30">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-1">
            <NotificationBell />
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

        {/* Trial Banner — only show if NOT actively subscribed */}
        {isOnTrial && (user as any)?.subscriptionStatus !== "active" && (
          <div className={`flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
            trialDaysLeft <= 3
              ? "bg-red-50 border-b border-red-100 text-red-700"
              : "bg-amber-50 border-b border-amber-100 text-amber-700"
          }`}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</strong> left in your free trial.
                {trialDaysLeft <= 3 && " Your account will be limited when the trial ends."}
              </span>
            </div>
            <Link
              href="/dashboard/billing"
              className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                trialDaysLeft <= 3
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              Subscribe Now →
            </Link>
          </div>
        )}

        {/* Setup banner — sticky-top inside the scroll area. The component
            also renders the slide-out side panel as a fixed overlay. */}
        <SetupExperience />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/80">
          {children}
        </main>
      </div>
    </div>
  );
}
