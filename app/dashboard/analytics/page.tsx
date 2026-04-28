"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser, getBookings } from "@/lib/storage";
import type { User, Booking } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookingsState] = useState<Booking[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"analytics" | "customers">("analytics");

  useEffect(() => {
    setUser(getUser());
    setMounted(true);

    // Load bookings from API (source of truth), fallback to localStorage
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
        setBookingsState(mapped);
      })
      .catch(() => setBookingsState(getBookings()));
  }, []);

  if (!mounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-10 w-48 bg-gray-100 rounded-xl shimmer mb-6" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-2xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const isPro = user?.plan === "pro";

  if (!isPro) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="animate-fadeInUp">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 sm:p-12 shadow-2xl shadow-blue-600/20">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute right-12 bottom-8 w-20 h-20 bg-indigo-500/30 rounded-full" />
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Analytics & Customers</h1>
              <p className="text-blue-100 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                Track revenue, popular services, busiest days, and manage your full customer database — all in one place.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {[
                  "Revenue trends & forecasting",
                  "Booking volume over time",
                  "Most popular services",
                  "Complete customer profiles",
                  "Booking & revenue per customer",
                  "Customer lifetime value",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-white/90 text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Build customer data from bookings
  const customerMap = new Map<string, { name: string; email: string; phone: string; vehicles: string[]; bookings: number; totalSpent: number; lastVisit: string }>();
  bookings.forEach((b) => {
    const key = b.customerEmail.toLowerCase();
    const existing = customerMap.get(key);
    const vehicle = `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}`;
    if (existing) {
      existing.bookings++;
      existing.totalSpent += b.servicePrice;
      if (!existing.vehicles.includes(vehicle)) existing.vehicles.push(vehicle);
      if (b.date > existing.lastVisit) existing.lastVisit = b.date;
    } else {
      customerMap.set(key, {
        name: b.customerName, email: b.customerEmail, phone: b.customerPhone,
        vehicles: [vehicle], bookings: 1, totalSpent: b.servicePrice, lastVisit: b.date,
      });
    }
  });
  const customers = Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  const repeatCustomers = customers.filter(c => c.bookings > 1).length;
  const avgLifetimeValue = customers.length > 0 ? Math.round(customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length) : 0;

  // Analytics data
  const completedBookings = bookings.filter(b => b.status === "completed");
  const thisMonthRevenue = completedBookings
    .filter(b => b.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, b) => s + b.servicePrice, 0);
  const avgPerBooking = completedBookings.length > 0 ? Math.round(completedBookings.reduce((s, b) => s + b.servicePrice, 0) / completedBookings.length) : 0;
  const completionRate = bookings.length > 0 ? Math.round((completedBookings.length / bookings.length) * 100) : 0;

  const chartAreas = [
    {
      title: "Revenue Trends", description: "Monthly revenue over the last 12 months",
      icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      gradient: "from-blue-50 to-indigo-50",
      barColors: ["bg-blue-300","bg-blue-400","bg-blue-500","bg-blue-400","bg-blue-600","bg-blue-500","bg-blue-700","bg-blue-500","bg-blue-600","bg-blue-400","bg-blue-500","bg-blue-600"],
      barHeights: [40,55,65,50,72,60,85,68,78,58,70,80],
    },
    {
      title: "Booking Trends", description: "Weekly booking volume",
      icon: <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      gradient: "from-emerald-50 to-green-50",
      barColors: ["bg-emerald-300","bg-emerald-400","bg-emerald-500","bg-emerald-400","bg-emerald-600","bg-emerald-500","bg-emerald-400","bg-emerald-500"],
      barHeights: [35,50,70,45,80,60,55,65],
    },
    {
      title: "Popular Services", description: "Most booked service packages",
      icon: <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
      gradient: "from-purple-50 to-fuchsia-50",
      barColors: ["bg-purple-600","bg-purple-500","bg-purple-400","bg-purple-300"],
      barHeights: [90,72,55,38],
      horizontal: true as const,
      labels: ["Full Detail","Ceramic Coating","Interior Detail","Basic Wash"],
    },
    {
      title: "Busiest Days", description: "Bookings by day of the week",
      icon: <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      gradient: "from-amber-50 to-orange-50",
      barColors: ["bg-amber-300","bg-amber-500","bg-amber-600","bg-amber-500","bg-amber-700","bg-amber-400","bg-amber-300"],
      barHeights: [30,55,70,60,85,45,25],
      labels: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeInUp">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1 text-sm">Insights, trends, and customer data</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "analytics" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Charts
            </span>
          </button>
          <button onClick={() => setActiveTab("customers")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "customers" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Customers
            </span>
          </button>
        </div>
      </div>

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "This Month", value: `$${thisMonthRevenue.toLocaleString()}`, sub: "Revenue", color: "from-blue-500 to-blue-700" },
              { label: "This Month", value: String(bookings.filter(b => b.date.startsWith(new Date().toISOString().slice(0,7))).length), sub: "Bookings", color: "from-emerald-500 to-emerald-700" },
              { label: "Average", value: `$${avgPerBooking}`, sub: "Per Booking", color: "from-purple-500 to-purple-700" },
              { label: "Completion", value: `${completionRate}%`, sub: "Rate", color: "from-amber-500 to-orange-600" },
            ].map((stat, i) => (
              <div key={stat.label + stat.sub}
                className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${stat.color} shadow-lg animate-fadeInUp`}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="relative">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-extrabold mt-1">{stat.value}</p>
                  <p className="text-white/70 text-xs mt-0.5">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {chartAreas.map((chart, i) => (
              <div key={chart.title}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp"
                style={{ animationDelay: `${(i + 4) * 80}ms`, animationFillMode: "both" }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${chart.gradient} flex items-center justify-center`}>{chart.icon}</div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{chart.title}</h3>
                      <p className="text-xs text-gray-400">{chart.description}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {chart.horizontal ? (
                    <div className="space-y-3">
                      {chart.labels?.map((label, j) => (
                        <div key={label} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 font-medium w-24 text-right flex-shrink-0">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                            <div className={`h-full rounded-full ${chart.barColors[j]} transition-all duration-700`} style={{ width: `${chart.barHeights[j]}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 font-semibold w-8">{chart.barHeights[j]}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 h-36">
                      {chart.barHeights.map((h, j) => (
                        <div key={j} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full rounded-t-md ${chart.barColors[j]} transition-all duration-500`} style={{ height: `${(h / 100) * 128}px` }} />
                          {chart.labels && <span className="text-[10px] text-gray-400 font-medium">{chart.labels[j]}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">Data populates as bookings grow. Check back for real insights.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Customers Tab ── */}
      {activeTab === "customers" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Customers", value: String(customers.length), icon: "👥", color: "from-blue-500 to-blue-700" },
              { label: "Repeat Customers", value: String(repeatCustomers), icon: "🔄", color: "from-emerald-500 to-emerald-700" },
              { label: "Avg. Lifetime Value", value: `$${avgLifetimeValue}`, icon: "💰", color: "from-purple-500 to-purple-700" },
              { label: "New This Month", value: String(customers.filter(c => c.lastVisit.startsWith(new Date().toISOString().slice(0, 7))).length), icon: "✨", color: "from-amber-500 to-orange-600" },
            ].map((stat, i) => (
              <div key={stat.label}
                className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${stat.color} shadow-lg animate-fadeInUp`}
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="relative">
                  <span className="text-2xl mb-2 block">{stat.icon}</span>
                  <p className="text-2xl font-extrabold">{stat.value}</p>
                  <p className="text-white/70 text-xs mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">All Customers</h2>
              <span className="text-xs text-gray-400 font-medium">{customers.length} total</span>
            </div>

            {customers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-semibold text-sm mb-1">Customer tracking is active</p>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Your customer database will populate as bookings come in. Each booking automatically creates or updates a customer profile.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/70">
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Customer</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3 hidden sm:table-cell">Phone</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3 hidden md:table-cell">Vehicle(s)</th>
                      <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3">Bookings</th>
                      <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Total Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customers.map((c) => (
                      <tr key={c.email} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-blue-600 font-bold text-xs">{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                              <p className="text-xs text-gray-400">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 hidden sm:table-cell">
                          <p className="text-sm text-gray-600">{c.phone}</p>
                        </td>
                        <td className="px-3 py-4 hidden md:table-cell">
                          <p className="text-sm text-gray-600 truncate max-w-[200px]">{c.vehicles.join(", ")}</p>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${c.bookings > 1 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                            {c.bookings}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-bold text-gray-900">${c.totalSpent.toLocaleString()}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <DashboardHelp page="analytics" />
    </div>
  );
}
