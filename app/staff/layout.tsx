"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogoIcon, LogoWordmark } from "@/components/Logo";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  user: { businessName: string; slug: string; logo?: string };
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/staff/login";

  useEffect(() => {
    if (isLoginPage) { setChecked(true); return; }
    fetch("/api/staff-auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { router.push("/login"); return; }
        setStaff(data.staff);
        setChecked(true);
      })
      .catch(() => router.push("/login"));
  }, [pathname, isLoginPage, router]);

  const handleLogout = async () => {
    await fetch("/api/staff-auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (isLoginPage) return <>{children}</>;

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const navItems = [
    {
      label: "Dashboard",
      href: "/staff/dashboard",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 14a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3z" /></svg>,
    },
    {
      label: "My Bookings",
      href: "/staff/bookings",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    },
    {
      label: "Calendar",
      href: "/staff/calendar",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-[#0B1120] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {/* Logo / Business */}
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            {staff?.user.logo ? (
              <img src={staff.user.logo} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <LogoIcon size={22} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate">{staff?.user.businessName}</p>
              <p className="text-slate-500 text-[11px]">Staff Portal</p>
            </div>
          </div>
        </div>

        {/* Staff info */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: staff?.color || "#3B82F6" }}
            >
              {staff ? getInitials(staff.name) : ""}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{staff?.name}</p>
              <p className="text-slate-500 text-[11px] capitalize">{staff?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-100 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <LogoIcon size={22} />
            <LogoWordmark darkText size="text-sm" />
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: staff?.color || "#3B82F6" }}
          >
            {staff ? getInitials(staff.name) : ""}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
