"use client";

import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";
import { usePlatformName } from "@/components/PlatformName";

const values = [
  {
    title: "Simplicity",
    description:
      "We build tools that anyone can use on day one — no training required, no bloated features. If it doesn't make your life simpler, it doesn't ship.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "Reliability",
    description:
      "Your customers are booking and paying through our platform. We take uptime seriously. Our systems are built to be available 24/7, every day of the year.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "Value",
    description:
      "We price our platform fairly for solo operators and small teams. You shouldn't have to pay enterprise software prices to run a professional detailing business.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  const platformName = usePlatformName();

  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-700/15 rounded-full blur-[100px] animate-blobFloat delay-400" />
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
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            OUR STORY
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-6 animate-fadeInUp delay-100">
            Built for Detailers,{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              by Someone Who Gets It
            </span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto animate-fadeInUp delay-200">
            {platformName} exists because detailers deserve better than generic scheduling tools that weren&apos;t built for this industry.
          </p>
        </div>
      </section>

      {/* ── The Story ── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-10 md:p-14">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              WHY WE BUILT THIS
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              The Problem We&apos;re Solving
            </h2>
            <div className="space-y-5 text-gray-300 leading-relaxed text-lg">
              <p>
                I built {platformName} because I saw detailers struggling with no-shows and scheduling chaos. Every week, customers would book and then ghost &mdash; no call, no text. Just a wasted morning and lost income.
              </p>
              <p>
                I looked at every booking tool out there &mdash; Square Appointments, Calendly, Jobber, Vagaro, Booksy. None of them were built with detailers in mind. They didn&apos;t understand deposits, vehicle types, or the difference between a mobile service and a shop appointment.
              </p>
              <p>
                So I built the tool I wished existed. {platformName} is purpose-built for auto detailing businesses &mdash; whether you&apos;re a solo mobile operator or running a full shop with a team.
              </p>
              <p>
                Deposit collection that actually prevents no-shows. SMS reminders that go out automatically. Service packages organized by vehicle type. A booking page that looks professional and builds trust with your customers.
              </p>
              <p className="text-white font-semibold">
                This is not another generic scheduling app with a fresh coat of paint. This tool is made by someone who understands the auto detailing industry.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">What We Stand For</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Three principles guide every decision we make.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 mb-5">
                  {v.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{v.title}</h3>
                <p className="text-gray-400 leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What You Get ── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">What {platformName} Gives You</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "Professional booking page with your branding",
              "Deposit collection to prevent no-shows",
              "Automated SMS & email reminders",
              "Calendar dashboard for all your jobs",
              "Service packages by vehicle type",
              "Google Calendar two-way sync",
              "Multiple staff & calendars (Pro)",
              "Analytics & revenue tracking",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800/60 border border-white/10 rounded-xl p-4 animate-fadeInUp" style={{ animationDelay: `${i * 0.05}s` }}>
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300 text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to try it?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Start your free 7-day trial. Card required, cancel anytime. See for yourself why this is different.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 text-lg"
            >
              Start Free Trial
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/book/mikes-mobile-detailing"
              className="inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 border border-white/10 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 text-lg"
            >
              See Live Demo
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
