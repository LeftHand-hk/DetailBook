"use client";

import SiteLayout from "@/components/SiteLayout";

const pressReleases = [
  {
    date: "Mar 1, 2026",
    title: "DetailBook Reaches 500 Active Detailers Milestone",
    excerpt:
      "DetailBook, the scheduling and booking platform built for mobile auto detailers, today announced it has surpassed 500 active paying customers — a milestone reached in just over one year since public launch.",
    body: `PHOENIX, AZ — March 1, 2026 — DetailBook, the scheduling and booking platform purpose-built for mobile auto detailers, today announced that it has surpassed 500 active paying customers across the United States and Canada.

The company, founded by mobile detailer Alex Rivera in 2024, launched its public product in December 2025. In the months since launch, DetailBook has processed over $2.1 million in customer payments and earned a 4.9/5 average rating across 127 verified reviews.

"When we hit 100 customers, I thought we were doing something right. Reaching 500 so quickly tells us that the detailing community has been underserved by generic scheduling tools," said Alex Rivera, Founder and CEO of DetailBook. "We built this for people like me — solo operators who need professional tools without the enterprise price tag."

DetailBook offers online booking pages, deposit collection, automated SMS reminders, service package management, and Google Calendar sync. Plans start at $29/month with a 30-day free trial.`,
  },
  {
    date: "Jan 15, 2026",
    title: "DetailBook Launches Pro Plan with SMS Reminders and Google Calendar Sync",
    excerpt:
      "DetailBook today unveiled its Pro plan, adding automated SMS reminders, two-way Google Calendar sync, recurring bookings, and enhanced analytics to help mobile detailers scale their operations.",
    body: `PHOENIX, AZ — January 15, 2026 — DetailBook today announced the launch of its Pro plan, introducing a suite of advanced features designed for growing mobile detailing businesses.

The Pro plan, priced at $59/month, adds automated two-way SMS reminders, Google Calendar integration, recurring booking support, and business analytics to the platform's core scheduling and booking capabilities.

"Our Starter customers told us loud and clear what they needed next: automated reminders and Google Calendar sync," said Alex Rivera, CEO of DetailBook. "The Pro plan is our answer to that feedback."

Key features included in the Pro plan:
— Automated SMS reminders sent 2 hours before each appointment
— Two-way Google Calendar sync so appointments appear on all your devices
— Recurring bookings for regular customers
— Analytics dashboard showing revenue trends, booking sources, and no-show rates
— Custom domain support for the booking page

The Pro plan is available immediately. Existing customers can upgrade from within their account dashboard.`,
  },
];

const brandColors = [
  { name: "Brand Blue", hex: "#3B82F6", class: "bg-blue-500" },
  { name: "Brand Indigo", hex: "#6366F1", class: "bg-indigo-500" },
  { name: "Dark Background", hex: "#080C18", class: "bg-[#080c18] border border-white/20" },
  { name: "Slate 900", hex: "#0F172A", class: "bg-slate-900" },
];

export default function PressPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[55%] h-[55%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            PRESS & MEDIA
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp delay-100">
            Press &amp; Media
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto animate-fadeInUp delay-200">
            Assets, releases, and contact information for journalists and media professionals.
          </p>
        </div>
      </section>

      {/* ── Brand Assets ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white mb-8">Brand Assets</h2>
          <div className="grid md:grid-cols-3 gap-6">

            {/* Logo download */}
            <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Logo</h3>
              <div className="bg-slate-900 rounded-xl p-8 flex items-center justify-center mb-4 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500 rounded-xl blur-md opacity-60" />
                    <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <span className="text-white font-black text-lg">D</span>
                    </div>
                  </div>
                  <span className="text-xl font-black text-white tracking-tight">DetailBook</span>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Logo Pack
              </button>
            </div>

            {/* Brand Colors */}
            <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Brand Colors</h3>
              <div className="space-y-3">
                {brandColors.map((c) => (
                  <div key={c.hex} className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${c.class} shrink-0`} />
                    <div>
                      <p className="text-white text-sm font-semibold">{c.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{c.hex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Typography</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Primary Font</p>
                  <p className="text-white text-2xl font-black">Inter</p>
                  <p className="text-gray-400 text-sm">by Rasmus Andersson</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-white font-black">Black 900</p>
                  <p className="text-white font-bold">Bold 700</p>
                  <p className="text-white font-semibold">Semibold 600</p>
                  <p className="text-gray-400 font-normal">Regular 400</p>
                </div>
                <a href="https://fonts.google.com/specimen/Inter" target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex items-center gap-1 transition-colors">
                  Download Inter
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Press Releases ── */}
      <section className="py-16 bg-slate-900/50 border-y border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white mb-8">Press Releases</h2>
          <div className="space-y-6">
            {pressReleases.map((pr, i) => (
              <details
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden group animate-fadeInUp"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <summary className="flex items-start justify-between gap-4 p-7 cursor-pointer list-none hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 font-semibold mb-1 block">{pr.date}</span>
                    <h3 className="text-white font-bold text-lg leading-snug">{pr.title}</h3>
                    <p className="text-gray-400 text-sm mt-1 leading-relaxed">{pr.excerpt}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-7 pb-7">
                  <div className="border-t border-white/10 pt-5">
                    <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                      {pr.body}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Media Contact ── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-white/10 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Media Contact</h2>
            <p className="text-gray-400 mb-1">For press inquiries, interview requests, and media assets:</p>
            <a href="mailto:info@detailbookapp.com" className="text-blue-400 hover:text-blue-300 text-lg font-bold transition-colors">
              info@detailbookapp.com
            </a>
            <p className="text-gray-400 text-sm mt-6 max-w-xl mx-auto leading-relaxed">
              We welcome interview requests from journalists covering small business software, the trades industry,
              and the future of work. We typically respond to press inquiries within one business day.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
