"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/Logo";

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

  const isLoginPage = pathname === "/staff/login";

  useEffect(() => {
    if (isLoginPage) { setChecked(true); return; }

    fetch("/api/staff-auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) { router.push("/staff/login"); return; }
        setStaff(data.staff);
        setChecked(true);
      })
      .catch(() => router.push("/staff/login"));
  }, [pathname, isLoginPage, router]);

  const handleLogout = async () => {
    await fetch("/api/staff-auth/logout", { method: "POST" });
    router.push("/staff/login");
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
  ];

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first top nav */}
      <header className="bg-[#0B1120] border-b border-white/[0.06] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon size={28} />
            <div>
              <p className="text-white text-sm font-bold leading-tight">{staff?.user.businessName}</p>
              <p className="text-slate-500 text-[11px]">Staff Portal</p>
            </div>
          </div>

          {staff && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: staff.color }}
                >
                  {getInitials(staff.name)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-white text-xs font-semibold">{staff.name}</p>
                  <p className="text-slate-500 text-[10px] capitalize">{staff.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Log out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Nav tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
