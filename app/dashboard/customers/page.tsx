"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

export default function CustomersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-10 w-48 bg-gray-100 rounded-xl shimmer mb-6" />
        <div className="h-64 bg-gray-100 rounded-2xl shimmer" />
      </div>
    );
  }

  const isPro = user?.plan === "pro";

  if (!isPro) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="animate-fadeInUp">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 sm:p-12 shadow-2xl shadow-blue-600/20">
            {/* Decorative elements */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute right-12 bottom-8 w-20 h-20 bg-indigo-500/30 rounded-full" />

            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
                Customer Database
              </h1>
              <p className="text-blue-100 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                Unlock the full customer management suite. Track every client, their vehicles, booking history, and lifetime value -- all in one place.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {[
                  "Complete customer profiles",
                  "Vehicle history tracking",
                  "Booking & revenue per customer",
                  "Customer notes & preferences",
                  "Export customer data (CSV)",
                  "Automated follow-up triggers",
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
                className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-black/10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upgrade to Pro -- $50/mo
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 animate-fadeInUp">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Customer Database</h1>
        <p className="text-gray-500 mt-1 text-sm">Track and manage your customer relationships.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Customers", value: "0", icon: "👥", color: "from-blue-500 to-blue-700" },
          { label: "Repeat Customers", value: "0", icon: "🔄", color: "from-emerald-500 to-emerald-700" },
          { label: "Avg. Lifetime Value", value: "$0", icon: "💰", color: "from-purple-500 to-purple-700" },
          { label: "New This Month", value: "0", icon: "✨", color: "from-amber-500 to-orange-600" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${stat.color} shadow-lg animate-fadeInUp`}
            style={{ animationDelay: `${i * 100}ms`, opacity: 0 }}
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="relative">
              <span className="text-2xl mb-2 block">{stat.icon}</span>
              <p className="text-2xl font-extrabold">{stat.value}</p>
              <p className="text-white/70 text-xs mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "200ms", opacity: 0 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">All Customers</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search customers..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                disabled
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3 hidden sm:table-cell">Phone</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3 hidden md:table-cell">Vehicle</th>
                <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-3">Bookings</th>
                <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">Customer tracking is active</p>
                    <p className="text-gray-500 text-sm max-w-sm">
                      Your customer database will populate as bookings come in. Each new booking automatically creates or updates a customer profile.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <DashboardHelp page="customers" />
    </div>
  );
}
