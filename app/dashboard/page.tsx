"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getUser, getBookings, getPackages } from "@/lib/storage";
import type { User, Booking, Package } from "@/types";
import EmptyState, { EmptyIcons } from "@/components/EmptyState";

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 border border-green-200",
  pending:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
  completed: "bg-blue-100 text-blue-700 border border-blue-200",
  cancelled: "bg-red-100 text-red-700 border border-red-200",
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>(() => {
    if (typeof window === "undefined") return [];
    try { return getBookings() || []; } catch { return []; }
  });
  const [, setPackages] = useState<Package[]>([]);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);

    Promise.all([
      fetch("/api/packages").then((r) => (r.ok ? r.json() : [])).catch(() => null),
      fetch("/api/bookings").then((r) => (r.ok ? r.json() : [])).catch(() => null),
    ]).then(([pkgData, bkData]) => {
      if (pkgData) setPackages(pkgData as Package[]);
      else setPackages(getPackages());

      if (bkData) {
        const mapped: Booking[] = (bkData as any[]).map((b: any) => ({
          ...b,
          vehicle: b.vehicle || {
            make: b.vehicleMake || "",
            model: b.vehicleModel || "",
            year: b.vehicleYear || "",
            color: b.vehicleColor || "",
          },
        }));
        setBookings(mapped);
      } else {
        setBookings(getBookings());
      }
    });
  }, []);

  const isPro = user?.plan === "pro";
  const today = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter((b) => b.date === today);
  const upcomingBookings = bookings
    .filter((b) => b.date >= today && b.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date));
  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRevenue = bookings
    .filter((b) => b.date.startsWith(thisMonth) && b.status === "completed")
    .reduce((sum, b) => sum + b.servicePrice, 0);

  const totalDeposits = bookings.reduce((sum, b) => sum + b.depositPaid, 0);

  const recentBookings = [...bookings]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const completedCount = bookings.filter(b => b.status === "completed").length;
  const completionRate = bookings.length > 0 ? Math.round((completedCount / bookings.length) * 100) : 0;

  const handleCopyLink = () => {
    if (user) {
      const url = `${window.location.origin}/book/${user.slug}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (!mounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  // Revenue chart (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    const rev = bookings
      .filter((b) => b.date === key && b.status === "completed")
      .reduce((s, b) => s + b.servicePrice, 0);
    return { label: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()], rev, date: key };
  });
  const maxRev = Math.max(...last7.map((d) => d.rev), 1);
  const weekTotal = last7.reduce((s, d) => s + d.rev, 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Welcome back, {user?.name?.split(" ")[0] || "there"}
            </h1>
            {isPro && (
              <span className="text-[10px] font-bold bg-blue-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">Pro</span>
            )}
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {todayBookings.length > 0 && <span className="text-blue-600 font-semibold ml-2">· {todayBookings.length} job{todayBookings.length > 1 ? "s" : ""} today</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleCopyLink}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-200 ${
              copied ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700 shadow-sm"
            }`}>
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
            {copied ? "Copied!" : "Share Link"}
          </button>
          <Link href="/dashboard/bookings"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
            View Bookings
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {(() => {
          const empty = bookings.length === 0;
          return [
            { label: "Total Bookings", value: empty ? "—" : String(bookings.length), sub: empty ? "Awaiting first booking" : `${pendingBookings.length} pending` },
            { label: "This Month", value: empty ? "—" : `$${monthRevenue.toLocaleString()}`, sub: "Completed revenue" },
            { label: "Deposits", value: empty ? "—" : `$${totalDeposits.toLocaleString()}`, sub: "Collected upfront" },
            { label: "Completion", value: empty ? "—" : `${completionRate}%`, sub: empty ? "Will appear after first job" : `${completedCount} of ${bookings.length} jobs` },
          ];
        })().map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mt-2">{stat.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">

        {/* Recent Bookings (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Recent Bookings</h2>
            <Link href="/dashboard/bookings" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              View all →
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <EmptyState
              size="compact"
              icon={EmptyIcons.Calendar}
              title="No bookings yet"
              description="Once customers book through your link, their appointments will appear here."
              action={
                <button
                  onClick={handleCopyLink}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  {copied ? "Copied!" : "Copy Booking Link"}
                </button>
              }
              secondary="Share this link on Instagram, Facebook, or with existing customers."
            />
          ) : (
            <div className="divide-y divide-gray-50">
              {recentBookings.map((booking) => (
                <Link key={booking.id} href="/dashboard/bookings"
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-bold text-xs">{booking.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{booking.customerName}</p>
                      {booking.date === today && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">TODAY</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{booking.serviceName} · {booking.vehicle.year} {booking.vehicle.make}</p>
                  </div>
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <p className="text-xs text-gray-600 font-medium">{formatDate(booking.date)}</p>
                    <p className="text-xs text-gray-400">{booking.time}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold capitalize flex-shrink-0 ${statusColors[booking.status]}`}>
                    {booking.status}
                  </span>
                  <div className="hidden md:block text-right flex-shrink-0 w-16">
                    <p className="text-sm font-bold text-gray-900">${booking.servicePrice}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-5">

          {/* Upcoming Jobs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-sm">Upcoming</h2>
              <Link href="/dashboard/calendar" className="text-xs text-blue-600 font-semibold hover:text-blue-700">Calendar →</Link>
            </div>
            <div className="p-3">
              {upcomingBookings.slice(0, 4).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm mb-1">No upcoming bookings</p>
                  <button onClick={handleCopyLink} className="text-xs text-blue-600 font-semibold hover:text-blue-700">
                    Share your booking link →
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcomingBookings.slice(0, 4).map((booking) => (
                    <div key={booking.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-bold text-xs">{booking.customerName.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{booking.customerName}</p>
                        <p className="text-xs text-gray-500 font-medium">{formatDate(booking.date)} · {booking.time}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold capitalize ${statusColors[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-gray-900 text-sm">Revenue</h2>
              <span className="text-xs text-gray-400 font-medium">Last 7 days</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mb-4">${weekTotal.toLocaleString()}</p>
            <div className="flex items-end gap-1.5 h-20">
              {last7.map(({ label, rev }, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-md transition-all duration-500 relative group"
                    style={{
                      height: `${Math.max((rev / maxRev) * 64, rev > 0 ? 8 : 3)}px`,
                      background: rev > 0 ? "#2563eb" : "#f3f4f6",
                    }}>
                    {rev > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        ${rev}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pro Upgrade (only for Starter users) ── */}
      {!isPro && (
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 mb-6 shadow-lg shadow-blue-600/20">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative grid sm:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <h3 className="text-white font-extrabold text-lg">Unlock Pro Features</h3>
              </div>
              <p className="text-blue-100 text-sm mb-3">Get powerful tools to grow your business faster — analytics, SMS reminders, multi-staff calendars, and more.</p>
              <p className="text-blue-200 text-xs">Currently on Starter ($29/mo)</p>
            </div>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
            >
              Upgrade to Pro
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
