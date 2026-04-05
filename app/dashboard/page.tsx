"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getUser, getBookings, getPackages } from "@/lib/storage";
import type { User, Booking, Package } from "@/types";

const statusColors: Record<string, string> = {
  confirmed: "bg-gray-800 text-white",
  pending:   "bg-gray-50 text-gray-500 border border-gray-200",
  completed: "bg-gray-50 text-gray-400 border border-gray-200",
  cancelled: "bg-gray-50 text-gray-300 border border-gray-200",
};

const statusDots: Record<string, string> = {
  confirmed: "bg-gray-700",
  pending:   "bg-gray-400",
  completed: "bg-gray-300",
  cancelled: "bg-gray-200",
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dismissedGuide, setDismissedGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    setUser(getUser());
    setBookings(getBookings());
    setPackages(getPackages());
    setMounted(true);
    setDismissedGuide(localStorage.getItem("detailbook_guide_dismissed") === "true");
  }, []);

  const dismissGuide = () => {
    setDismissedGuide(true);
    localStorage.setItem("detailbook_guide_dismissed", "true");
  };

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

  const totalRevenue = bookings
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + b.servicePrice, 0);

  const totalDeposits = bookings.reduce((sum, b) => sum + b.depositPaid, 0);

  const recentBookings = [...bookings]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const activePackages = packages.filter((p) => p.active);

  // Completion rate
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

  const starterGuideSteps = [
    { icon: "📦", title: "1. Create Your Service Packages", desc: "Go to Packages and add the services you offer (e.g. Full Detail, Interior Clean, Ceramic Coating). Set prices, duration, and deposit amounts.", action: { label: "Go to Packages", href: "/dashboard/packages" } },
    { icon: "⚙️", title: "2. Set Up Your Business Profile", desc: "Add your business name, logo, phone number, service areas, and business hours in Settings. This info shows on your public booking page.", action: { label: "Go to Settings", href: "/dashboard/settings" } },
    { icon: "🔗", title: "3. Share Your Booking Link", desc: "Copy your unique booking link and share it with customers via text, social media, or your website. Customers can book and pay deposits online.", action: { label: "Copy Link", onClick: handleCopyLink } },
    { icon: "📋", title: "4. Manage Your Bookings", desc: "When bookings come in, you'll see them here and in the Bookings tab. Confirm, complete, or cancel appointments. Track deposits and payments.", action: { label: "View Bookings", href: "/dashboard/bookings" } },
    { icon: "💳", title: "5. Subscribe Before Trial Ends", desc: "Your 15-day free trial includes the Starter plan. Subscribe before it ends to keep your booking page live and continue receiving appointments.", action: { label: "Subscribe Now", href: "/dashboard/settings" } },
  ];

  const proGuideSteps = [
    { icon: "📦", title: "1. Create Your Service Packages", desc: "Go to Packages and add the services you offer. Set prices, duration, deposit amounts, and which vehicle types each service applies to.", action: { label: "Go to Packages", href: "/dashboard/packages" } },
    { icon: "⚙️", title: "2. Set Up Your Business Profile", desc: "Add your business name, logo, phone number, service areas, and business hours in Settings. This info shows on your public booking page.", action: { label: "Go to Settings", href: "/dashboard/settings" } },
    { icon: "👥", title: "3. Add Your Staff", desc: "Add team members, set their roles, and give them their own login. Customers can choose a specific staff member when booking.", action: { label: "Manage Staff", href: "/dashboard/staff" } },
    { icon: "🔗", title: "4. Share Your Booking Link", desc: "Copy your unique booking link and share it with customers via text, social media, or your website. Customers can book and pay deposits online.", action: { label: "Copy Link", onClick: handleCopyLink } },
    { icon: "📋", title: "5. Manage Your Bookings", desc: "When bookings come in, you'll see them here and in the Bookings tab. Confirm, complete, or cancel appointments. Track deposits and payments.", action: { label: "View Bookings", href: "/dashboard/bookings" } },
    { icon: "💬", title: "6. Customize Your Messages", desc: "Go to Messages to customize confirmation texts, reminders, and follow-up messages sent to your customers automatically.", action: { label: "Edit Templates", href: "/dashboard/messages" } },
    { icon: "📊", title: "7. Track Analytics", desc: "Monitor your revenue trends, top services, and customer data in the Analytics tab. Use this to grow your business strategically.", action: { label: "View Analytics", href: "/dashboard/analytics" } },
  ];

  const guideSteps = isPro ? proGuideSteps : starterGuideSteps;

  const formatDate = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const formatDateFull = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!mounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl shimmer" />
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeInUp">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Welcome back, {user?.name?.split(" ")[0] || "there"}
            </h1>
            {isPro && (
              <span className="text-[10px] font-bold bg-gray-700 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">Pro</span>
            )}
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {todayBookings.length > 0 && <span className="text-gray-900 font-semibold ml-2">· {todayBookings.length} job{todayBookings.length > 1 ? "s" : ""} today</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleCopyLink}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-200 ${
              copied ? "bg-gray-100 border-gray-300 text-gray-700" : "bg-white border-gray-200 text-gray-700 hover:border-gray-400 shadow-sm"
            }`}>
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
            {copied ? "Copied!" : "Share Link"}
          </button>
          <Link href="/dashboard/bookings"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
            View Bookings
          </Link>
        </div>
      </div>

      {/* ── Getting Started Banner ── */}
      {!dismissedGuide && (
        <div className="mb-6 bg-gray-800 rounded-2xl p-5 animate-fadeInUp delay-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">New here? Let us show you around!</h3>
                <p className="text-white/50 text-xs mt-0.5">Follow these simple steps to get your booking page live in under 5 minutes.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowGuide(true)} className="bg-white text-gray-900 font-bold text-xs px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                Show Guide
              </button>
              <button onClick={dismissGuide} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Total Bookings", value: bookings.length,
            sub: `${pendingBookings.length} pending`,
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
          },
          {
            label: "This Month", value: `$${monthRevenue.toLocaleString()}`,
            sub: "Completed revenue",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
          },
          {
            label: "Deposits", value: `$${totalDeposits.toLocaleString()}`,
            sub: "Collected upfront",
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />,
          },
          {
            label: "Completion", value: `${completionRate}%`,
            sub: `${completedCount} of ${bookings.length} jobs`,
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-fadeInUp"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">{stat.icon}</svg>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">

        {/* Recent Bookings (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp delay-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
              </div>
              <h2 className="font-bold text-gray-900 text-sm">Recent Bookings</h2>
            </div>
            <Link href="/dashboard/bookings" className="text-xs text-gray-500 hover:text-gray-700 font-semibold">
              View all →
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
              </div>
              <p className="text-gray-900 font-semibold mb-1">No bookings yet</p>
              <p className="text-gray-500 text-sm mb-4">Share your booking link to start receiving appointments</p>
              <button onClick={handleCopyLink} className="bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-600 transition-colors">
                Copy Booking Link
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentBookings.map((booking, i) => (
                <Link key={booking.id} href="/dashboard/bookings"
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 font-bold text-xs">{booking.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{booking.customerName}</p>
                      {booking.date === today && (
                        <span className="text-[10px] border border-gray-300 text-gray-500 font-semibold px-1.5 py-0.5 rounded">TODAY</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{booking.serviceName} · {booking.vehicle.year} {booking.vehicle.make}</p>
                  </div>
                  <div className="hidden sm:block text-right flex-shrink-0">
                    <p className="text-xs text-gray-600 font-medium">{formatDate(booking.date)}</p>
                    <p className="text-xs text-gray-400">{booking.time}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${statusDots[booking.status]}`} />
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold capitalize ${statusColors[booking.status]}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block text-right flex-shrink-0 w-20">
                    <p className="text-sm font-bold text-gray-900">${booking.servicePrice}</p>
                    {booking.depositPaid > 0 && (
                      <p className="text-[10px] text-gray-400 font-semibold">${booking.depositPaid} dep.</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-5">

          {/* Upcoming Jobs */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp delay-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h2 className="font-bold text-gray-900 text-sm">Upcoming</h2>
              </div>
              <Link href="/dashboard/calendar" className="text-xs text-gray-500 font-semibold hover:text-gray-700">Calendar →</Link>
            </div>
            <div className="p-3">
              {upcomingBookings.slice(0, 4).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm mb-1">No upcoming bookings</p>
                  <button onClick={handleCopyLink} className="text-xs text-gray-500 font-semibold hover:text-gray-700">
                    Share your booking link →
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcomingBookings.slice(0, 4).map((booking) => (
                    <div key={booking.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-500 font-bold text-xs">{booking.customerName.charAt(0)}</span>
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-fadeInUp delay-400">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <h2 className="font-bold text-gray-900 text-sm">Revenue</h2>
              </div>
              <span className="text-xs text-gray-400 font-medium">Last 7 days</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mb-4 pl-[42px]">${weekTotal.toLocaleString()}</p>
            <div className="flex items-end gap-1.5 h-20">
              {last7.map(({ label, rev }, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full rounded-md transition-all duration-500 relative group"
                    style={{
                      height: `${Math.max((rev / maxRev) * 64, rev > 0 ? 8 : 3)}px`,
                      background: rev > 0 ? "#4B5563" : "#f9fafb",
                    }}>
                    {rev > 0 && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
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

      {/* ── Bottom Row ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Active Services */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp delay-500">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <h2 className="font-bold text-gray-900 text-sm">Active Services</h2>
            </div>
            <Link href="/dashboard/packages" className="text-xs text-gray-500 font-semibold hover:text-gray-700">Manage →</Link>
          </div>
          <div className="p-4">
            {activePackages.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm">No active packages</p>
                <Link href="/dashboard/packages" className="text-xs text-gray-500 font-semibold mt-1 inline-block">Add package →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activePackages.slice(0, 4).map((pkg) => (
                  <div key={pkg.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{pkg.name}</p>
                      <p className="text-xs text-gray-500">{Math.floor(pkg.duration / 60)}h {pkg.duration % 60 > 0 ? `${pkg.duration % 60}m` : ""}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-bold text-gray-900">${pkg.price}</p>
                      {pkg.deposit && pkg.deposit > 0 && (
                        <p className="text-[10px] text-gray-500">${pkg.deposit} dep.</p>
                      )}
                    </div>
                  </div>
                ))}
                {activePackages.length > 4 && (
                  <Link href="/dashboard/packages" className="block text-xs text-center text-blue-600 font-semibold pt-1">
                    +{activePackages.length - 4} more
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-[#0B1120] to-[#1a2744] rounded-2xl p-5 animate-fadeInUp delay-500">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="font-bold text-white text-sm">Quick Actions</h2>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Share Booking Link", onClick: handleCopyLink, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />, color: "bg-white/10 hover:bg-white/[0.15] border-white/10" },
              { label: "Add New Package", href: "/dashboard/packages", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />, color: "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.04]" },
              { label: "Edit Messages", href: "/dashboard/messages", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />, color: "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.04]" },
              { label: "Booking Page", href: `/book/${user?.slug}`, target: "_blank", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />, color: "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.04]" },
              { label: "Business Settings", href: "/dashboard/settings", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0" />, color: "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.04]" },
            ].map((action, i) =>
              action.href ? (
                <Link key={i} href={action.href} target={(action as any).target}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border ${action.color} text-white text-sm font-medium transition-all`}>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">{action.icon}</svg>
                  {action.label}
                </Link>
              ) : (
                <button key={i} onClick={action.onClick}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border ${action.color} text-white text-sm font-medium transition-all`}>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">{action.icon}</svg>
                  {action.label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Pro Features / Upgrade */}
        {isPro ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp delay-500">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                </div>
                <h2 className="font-bold text-gray-900 text-sm">Pro Tools</h2>
              </div>
            </div>
            <div className="p-4 space-y-1.5">
              {[
                { label: "Analytics & Customers", href: "/dashboard/analytics", desc: "Revenue trends & client data", icon: "📊" },
                { label: "Review Management", href: "/dashboard/reviews", desc: "Automate review requests", icon: "⭐" },
                { label: "SMS & Email Templates", href: "/dashboard/messages", desc: "Custom notifications", icon: "💬" },
              ].map((tool, i) => (
                <Link key={i} href={tool.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <span className="text-lg">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-600 transition-colors">{tool.label}</p>
                    <p className="text-xs text-gray-500">{tool.desc}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] to-[#162040] rounded-2xl p-5 animate-fadeInUp delay-500">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-600/10 rounded-full" />
            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-indigo-600/10 rounded-full" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <h3 className="text-white font-bold text-sm">Unlock Pro Features</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                Get powerful tools to grow your business faster
              </p>
              <div className="space-y-2 mb-5">
                {[
                  "Analytics & customer database",
                  "Revenue trends & reports",
                  "Automated review requests",
                  "SMS reminders (Twilio)",
                  "Unlimited packages",
                  "Priority support",
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/dashboard/settings"
                className="block w-full text-center bg-white text-gray-900 text-sm font-bold py-3 rounded-xl hover:bg-gray-100 transition-all">
                Upgrade to Pro — $50/mo
              </Link>
              <p className="text-[10px] text-slate-500 text-center mt-2">Currently on Starter ($25/mo)</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Help Button ── */}
      <button
        onClick={() => setShowGuide(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white pl-4 pr-5 py-3 rounded-full shadow-lg transition-all hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold">Need Help?</span>
      </button>

      {/* ── Help / Guide Modal ── */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-800 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Getting Started {isPro ? "— Pro Plan" : "— Starter Plan"}</h2>
                  <p className="text-white/50 text-xs mt-0.5">Get your booking page live in 5 minutes</p>
                </div>
                <button onClick={() => setShowGuide(false)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex gap-1.5 mt-4">
                {guideSteps.map((_, i) => (
                  <button key={i} onClick={() => setGuideStep(i)}
                    className={`h-1.5 rounded-full transition-all ${i === guideStep ? "bg-white flex-[2]" : "bg-white/30 flex-1 hover:bg-white/50"}`} />
                ))}
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl">
                  {guideSteps[guideStep].icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-1.5">{guideSteps[guideStep].title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{guideSteps[guideStep].desc}</p>
                </div>
              </div>
              {guideSteps[guideStep].action && (
                <div className="mb-6">
                  {guideSteps[guideStep].action.href ? (
                    <Link href={guideSteps[guideStep].action.href!} onClick={() => setShowGuide(false)}
                      className="inline-flex items-center gap-2 bg-gray-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-600 transition-colors">
                      {guideSteps[guideStep].action.label}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </Link>
                  ) : (
                    <button onClick={() => { guideSteps[guideStep].action.onClick?.(); }}
                      className="inline-flex items-center gap-2 bg-gray-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-600 transition-colors">
                      {guideSteps[guideStep].action.label}
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <button onClick={() => setGuideStep(Math.max(0, guideStep - 1))} disabled={guideStep === 0}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${guideStep === 0 ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Previous
                </button>
                <span className="text-xs text-gray-400 font-semibold">{guideStep + 1} of {guideSteps.length}</span>
                {guideStep < guideSteps.length - 1 ? (
                  <button onClick={() => setGuideStep(guideStep + 1)}
                    className="flex items-center gap-1.5 text-sm font-bold text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors">
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : (
                  <button onClick={() => { setShowGuide(false); dismissGuide(); }}
                    className="flex items-center gap-1.5 text-sm font-bold text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors">
                    Got it!
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                )}
              </div>
            </div>
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Quick Reference</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "📦", label: "Packages", desc: "Add/edit your services" },
                  { icon: "📋", label: "Bookings", desc: "View & manage appointments" },
                  { icon: "📅", label: "Calendar", desc: "See your schedule" },
                  { icon: "💬", label: "Messages", desc: "SMS & email templates" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-gray-100">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-gray-700">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
