"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getUser, getBookings, getPackages } from "@/lib/storage";
import type { User, Booking, Package } from "@/types";

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
  const [packages, setPackages] = useState<Package[]>([]);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dismissedGuide, setDismissedGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);

    fetch("/api/packages")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Package[]) => setPackages(data))
      .catch(() => setPackages(getPackages()));
    setDismissedGuide(localStorage.getItem("detailbook_guide_dismissed") === "true");

    fetch("/api/bookings")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const mapped: Booking[] = data.map((b: any) => ({
          ...b,
          vehicle: b.vehicle || {
            make: b.vehicleMake || "",
            model: b.vehicleModel || "",
            year: b.vehicleYear || "",
            color: b.vehicleColor || "",
          },
        }));
        setBookings(mapped);
      })
      .catch(() => setBookings(getBookings()));
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

  const starterGuideSteps = [
    { icon: "📦", title: "1. Create Your Service Packages", desc: "Go to Packages and add the services you offer (e.g. Full Detail, Interior Clean, Ceramic Coating). Set prices, duration, and deposit amounts.", action: { label: "Go to Packages", href: "/dashboard/packages" } },
    { icon: "⚙️", title: "2. Set Up Your Business Profile", desc: "Add your business name, logo, phone number, service areas, and business hours in Settings. This info shows on your public booking page.", action: { label: "Go to Settings", href: "/dashboard/settings" } },
    { icon: "🔗", title: "3. Share Your Booking Link", desc: "Copy your unique booking link and share it with customers via text, social media, or your website. Customers can book and pay deposits online.", action: { label: "Copy Link", onClick: handleCopyLink } },
    { icon: "📋", title: "4. Manage Your Bookings", desc: "When bookings come in, you'll see them here and in the Bookings tab. Confirm, complete, or cancel appointments. Track deposits and payments.", action: { label: "View Bookings", href: "/dashboard/bookings" } },
    { icon: "💳", title: "5. Subscribe Before Trial Ends", desc: "Your 15-day free trial includes the Starter plan. Subscribe before it ends to keep your booking page live and continue receiving appointments.", action: { label: "Subscribe Now", href: "/dashboard/billing" } },
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeInUp">
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

      {/* ── Getting Started Banner ── */}
      {!dismissedGuide && (
        <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 animate-fadeInUp delay-100 shadow-sm shadow-blue-600/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">New here? Let us show you around!</h3>
                <p className="text-blue-100 text-xs mt-0.5">Follow these simple steps to get your booking page live in under 5 minutes.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowGuide(true)} className="bg-white text-blue-700 font-bold text-xs px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                Show Guide
              </button>
              <button onClick={dismissGuide} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Bookings", value: bookings.length, sub: `${pendingBookings.length} pending` },
          { label: "This Month", value: `$${monthRevenue.toLocaleString()}`, sub: "Completed revenue" },
          { label: "Deposits", value: `$${totalDeposits.toLocaleString()}`, sub: "Collected upfront" },
          { label: "Completion", value: `${completionRate}%`, sub: `${completedCount} of ${bookings.length} jobs` },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-fadeInUp"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mt-2">{stat.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">

        {/* Recent Bookings (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp delay-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">Recent Bookings</h2>
            <Link href="/dashboard/bookings" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
              View all →
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>
              </div>
              <p className="text-gray-900 font-semibold mb-1">No bookings yet</p>
              <p className="text-gray-500 text-sm mb-4">Share your booking link to start receiving appointments</p>
              <button onClick={handleCopyLink} className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                Copy Booking Link
              </button>
            </div>
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp delay-300">
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-fadeInUp delay-400">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 mb-6 animate-fadeInUp delay-500 shadow-lg shadow-blue-600/20">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative grid sm:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <h3 className="text-white font-extrabold text-lg">Unlock Pro Features</h3>
              </div>
              <p className="text-blue-100 text-sm mb-3">Get powerful tools to grow your business faster — analytics, SMS reminders, automated review tracking, and more.</p>
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

      {/* ── Floating Help Button ── */}
      <button
        onClick={() => setShowGuide(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white pl-4 pr-5 py-3 rounded-full shadow-xl shadow-blue-600/30 transition-all hover:scale-105"
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
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Getting Started {isPro ? "— Pro Plan" : "— Starter Plan"}</h2>
                  <p className="text-blue-100 text-xs mt-0.5">Get your booking page live in 5 minutes</p>
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
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl">
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
                      className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                      {guideSteps[guideStep].action.label}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </Link>
                  ) : (
                    <button onClick={() => { guideSteps[guideStep].action.onClick?.(); }}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
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
                    className="flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : (
                  <button onClick={() => { setShowGuide(false); dismissGuide(); }}
                    className="flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">
                    Got it!
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
