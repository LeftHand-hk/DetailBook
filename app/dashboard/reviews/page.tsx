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
                Automate review collection and boost your Google reputation. Turn every happy customer into a 5-star review effortlessly.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {[
                  "Automated review request SMS",
                  "Google review link integration",
                  "Review performance dashboard",
                  "Smart timing (send after job)",
                  "Review response templates",
                  "Reputation score tracking",
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Average Rating", value: "0.0", icon: "⭐", color: "from-amber-500 to-orange-600" },
          { label: "Total Reviews", value: "0", icon: "💬", color: "from-blue-500 to-blue-700" },
          { label: "Requests Sent", value: "0", icon: "📤", color: "from-purple-500 to-purple-700" },
          { label: "Response Rate", value: "0%", icon: "📊", color: "from-emerald-500 to-emerald-700" },
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

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Automated Review Requests */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "200ms", opacity: 0 }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-sm">Automated Review Requests</h2>
                <p className="text-xs text-gray-400">SMS sent automatically after completed jobs</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">Active</span>
            </div>
          </div>

          <div className="p-6">
            {/* How it works */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">How It Works</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { step: "1", title: "Job Completed", desc: "You mark a booking as completed in your dashboard" },
                  { step: "2", title: "SMS Sent", desc: "Customer receives a friendly review request via SMS" },
                  { step: "3", title: "Review Posted", desc: "Customer clicks the link and leaves a Google review" },
                ].map((item) => (
                  <div key={item.step} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white text-xs font-bold">{item.step}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SMS Preview */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Review Request SMS Preview</h3>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="max-w-xs">
                  <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-bl-md px-4 py-3 leading-relaxed">
                    Hi {"{{customer_name}}"}, thanks for choosing {user?.businessName || "{{business_name}}"}! We&apos;d love your feedback. Leave us a quick Google review? {"{{review_link}}"}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 ml-1">Sent automatically 2 hours after job completion</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google Integration Card */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "300ms", opacity: 0 }}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Google Review Integration</h3>
              <p className="text-xs text-gray-400 mt-0.5">Connect your Google Business Profile</p>
            </div>
            <div className="p-5">
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Google Business Profile</p>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Connect your profile to automatically direct customers to leave Google reviews.
                </p>
                <button className="w-full bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                  Connect Google Profile
                </button>
              </div>
            </div>
          </div>

          {/* Recent Reviews Placeholder */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "400ms", opacity: 0 }}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Recent Reviews</h3>
            </div>
            <div className="p-5">
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">No reviews yet</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Reviews will appear here as customers respond to your automated review requests.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DashboardHelp page="reviews" />
    </div>
  );
}
