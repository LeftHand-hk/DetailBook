"use client";

import Link from "next/link";
import { useState } from "react";
import SiteLayout from "@/components/SiteLayout";

const posts = [
  {
    slug: "how-to-stop-no-shows",
    title: "How to Stop No-Shows in Your Detailing Business (5 Proven Methods)",
    category: "Business Tips",
    excerpt: "No-shows are the #1 profit killer for mobile detailers. Here's exactly how to eliminate them.",
    date: "Mar 18, 2026",
    readTime: "6 min",
  },
  {
    slug: "best-scheduling-software-2026",
    title: "Best Scheduling Software for Mobile Auto Detailers in 2026",
    category: "Reviews",
    excerpt: "We compared every booking tool on the market. Here's what actually works for detailers.",
    date: "Mar 15, 2026",
    readTime: "8 min",
  },
  {
    slug: "deposit-policy-guide",
    title: "How to Create a Deposit Policy for Your Detailing Business",
    category: "How-To",
    excerpt: "A solid deposit policy protects your time and income. Here's how to write one.",
    date: "Mar 12, 2026",
    readTime: "5 min",
  },
  {
    slug: "auto-detailing-price-list",
    title: "Auto Detailing Price List Template (Free Download)",
    category: "Resources",
    excerpt: "A proven pricing structure template built for mobile detailers.",
    date: "Mar 10, 2026",
    readTime: "4 min",
  },
  {
    slug: "get-more-detailing-customers",
    title: "7 Ways to Get More Detailing Customers Without Cold Calling",
    category: "Marketing",
    excerpt: "Build a steady stream of bookings using these proven, low-cost strategies.",
    date: "Mar 7, 2026",
    readTime: "7 min",
  },
  {
    slug: "start-mobile-detailing-business",
    title: "The Complete Guide to Starting a Mobile Auto Detailing Business",
    category: "Getting Started",
    excerpt: "Everything you need to know to launch your mobile detailing business in 2026.",
    date: "Mar 4, 2026",
    readTime: "12 min",
  },
  {
    slug: "mobile-vs-shop-detailing",
    title: "Mobile Detailing vs. Shop Detailing: Which is More Profitable?",
    category: "Business Tips",
    excerpt: "A full breakdown of costs, revenue, and lifestyle for both models.",
    date: "Feb 28, 2026",
    readTime: "6 min",
  },
  {
    slug: "online-booking-setup",
    title: "How to Set Up Online Booking for Your Detailing Business",
    category: "How-To",
    excerpt: "Step-by-step guide to accepting online bookings in under 30 minutes.",
    date: "Feb 25, 2026",
    readTime: "5 min",
  },
  {
    slug: "5-star-google-reviews",
    title: "How to Get 5-Star Google Reviews for Your Detailing Business",
    category: "Marketing",
    excerpt: "Reviews drive new customers. Here's the exact system to get more of them.",
    date: "Feb 22, 2026",
    readTime: "4 min",
  },
];

const categoryColors: Record<string, string> = {
  "Business Tips": "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Reviews":       "bg-purple-500/15 text-purple-400 border-purple-500/25",
  "How-To":        "bg-green-500/15 text-green-400 border-green-500/25",
  "Resources":     "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "Marketing":     "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "Getting Started":"bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
};

const allCategories = ["All", "Business Tips", "How-To", "Marketing", "Reviews", "Resources", "Getting Started"];

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = activeCategory === "All"
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-5%] w-[55%] h-[55%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute bottom-0 right-[-10%] w-[45%] h-[45%] bg-indigo-700/15 rounded-full blur-[100px] animate-blobFloat delay-400" />
        </div>
        <div className="absolute inset-0 overflow-hidden opacity-[0.05] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6 animate-fadeInUp">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            DETAILBOOK BLOG
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-5 animate-fadeInUp delay-100">
            The DetailBook{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Blog</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto animate-fadeInUp delay-200">
            Tips, guides, and resources for mobile auto detailers who want to run a more profitable, stress-free business.
          </p>
        </div>
      </section>

      {/* ── Category Filter ── */}
      <section className="py-6 bg-slate-900/60 border-y border-white/10 sticky top-16 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  activeCategory === cat
                    ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20"
                    : "bg-slate-800/60 text-gray-400 border-white/10 hover:text-white hover:border-white/20"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Post Grid ── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post, i) => (
              <article
                key={post.slug}
                className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300 flex flex-col animate-fadeInUp"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                {/* Category color bar */}
                <div className={`h-1 w-full ${
                  post.category === "Business Tips" ? "bg-gradient-to-r from-blue-500 to-blue-600" :
                  post.category === "Reviews"       ? "bg-gradient-to-r from-purple-500 to-purple-600" :
                  post.category === "How-To"        ? "bg-gradient-to-r from-green-500 to-emerald-600" :
                  post.category === "Resources"     ? "bg-gradient-to-r from-yellow-500 to-amber-600" :
                  post.category === "Marketing"     ? "bg-gradient-to-r from-pink-500 to-rose-600" :
                  "bg-gradient-to-r from-cyan-500 to-cyan-600"
                }`} />

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${categoryColors[post.category] ?? "bg-gray-500/15 text-gray-400 border-gray-500/25"}`}>
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {post.readTime} read
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white leading-snug mb-3 flex-1">
                    {post.title}
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-5">{post.excerpt}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs text-gray-500">{post.date}</span>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex items-center gap-1 transition-colors"
                    >
                      Read Article
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              No posts in this category yet.
            </div>
          )}
        </div>
      </section>

      {/* ── Newsletter CTA ── */}
      <section className="py-16 bg-slate-900/50 border-t border-white/10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Get New Articles in Your Inbox</h2>
          <p className="text-gray-400 mb-6">No spam. Practical content for detailers, once a week.</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
