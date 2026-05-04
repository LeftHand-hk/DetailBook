"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";
import EmptyState, { EmptyIcons } from "@/components/EmptyState";

export default function CustomersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, []);

  const copyBookingLink = async () => {
    if (!user?.slug) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${user.slug}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* clipboard not available */ }
  };

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
          { label: "Total Customers", value: "—", sub: "Updates as bookings come in" },
          { label: "Repeat Customers", value: "—", sub: "Booked more than once" },
          { label: "Avg. Lifetime Value", value: "—", sub: "Per customer" },
          { label: "New This Month", value: "—", sub: "First-time bookers" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm"
          >
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 mt-2">{stat.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">All Customers</h2>
        </div>
        <EmptyState
          icon={EmptyIcons.Users}
          title="No customers yet"
          description="Your customers will be added automatically when they book through your link."
          action={
            <button
              onClick={copyBookingLink}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {copiedLink ? "Copied!" : "Copy Booking Link"}
            </button>
          }
        />
      </div>
      <DashboardHelp page="customers" />
    </div>
  );
}
