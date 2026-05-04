"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

export default function ReviewsPage() {
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
                Reviews & Reputation
              </h1>
              <p className="text-blue-100 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                Track your reputation in one place — see your rating, total reviews, and how customers are responding to your work.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {[
                  "Review performance dashboard",
                  "Average rating tracking",
                  "Total reviews count",
                  "Recent reviews timeline",
                  "Reputation score tracking",
                  "Customer feedback insights",
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Reviews</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your reputation and collect customer reviews.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[
          { label: "Average Rating", value: "0.0", icon: "⭐", color: "from-amber-500 to-orange-600" },
          { label: "Total Reviews", value: "0", icon: "💬", color: "from-blue-500 to-blue-700" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${stat.color} shadow-lg`}
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">Recent Reviews</h3>
          <p className="text-xs text-gray-400 mt-0.5">Customer feedback shows up here as it comes in.</p>
        </div>
        <div className="p-6">
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">No reviews yet</p>
            <p className="text-xs text-gray-500 leading-relaxed max-w-md">
              Once customers leave reviews, they&apos;ll appear here so you can track your reputation at a glance.
            </p>
          </div>
        </div>
      </div>
      <DashboardHelp page="reviews" />
    </div>
  );
}
