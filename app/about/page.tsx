"use client";

import Link from "next/link";
import SiteLayout from "@/components/SiteLayout";

const stats = [
  { value: "500+", label: "Active Detailers" },
  { value: "$2.1M", label: "Revenue Processed" },
  { value: "4.9/5", label: "Average Rating" },
  { value: "127", label: "Verified Reviews" },
];

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
      "Your customers are booking and paying through DetailBook. We take uptime seriously. Our systems are built to be available 24/7, every day of the year.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "Value",
    description:
      "We price DetailBook fairly for solo operators and small teams. You shouldn't have to pay enterprise software prices to run a professional detailing business.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const team = [
  {
    name: "Alex Rivera",
    role: "Founder & CEO",
    initials: "AR",
    bio: "Former mobile detailer who built DetailBook after losing $800 in one month to no-shows. Now on a mission to give every detailer the tools they deserve.",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    name: "Jordan Kim",
    role: "Head of Product",
    initials: "JK",
    bio: "Product designer with 8 years building mobile-first SaaS tools. Obsessed with removing friction from workflows that tradespeople deal with every day.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    name: "Taylor Brooks",
    role: "Customer Success",
    initials: "TB",
    bio: "Spent 5 years in field service management before joining DetailBook. Personally onboards every new customer and knows detailers' pain points inside out.",
    gradient: "from-cyan-500 to-blue-600",
  },
];

export default function AboutPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-700/15 rounded-full blur-[100px] animate-blobFloat delay-400" />
        </div>
        {/* Grid */}
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
            Built by Detailers,{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              for Detailers
            </span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto animate-fadeInUp delay-200">
            DetailBook exists because one detailer got fed up with losing money to no-shows and cobbling together spreadsheets, texts, and Square. We built the tool we wished existed.
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 bg-slate-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center animate-fadeInUp" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="text-4xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                  {s.value}
                </div>
                <div className="text-sm text-gray-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission / Values ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">What We Stand For</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Three principles guide every decision we make at DetailBook.
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

      {/* ── Origin Story ── */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-10 md:p-14">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              THE ORIGIN STORY
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              How DetailBook Started
            </h2>
            <div className="space-y-5 text-gray-300 leading-relaxed text-lg">
              <p>
                In the summer of 2024, Alex Rivera was running a mobile detailing business out of
                a van in Phoenix, Arizona. Business was good — he had regulars, steady referrals,
                and a growing reputation on Instagram.
              </p>
              <p>
                But every week, someone would ghost. A customer would book, Alex would drive to
                their house, and nobody would answer the door. No call, no text. Just an empty
                driveway and a wasted morning. In July alone, no-shows cost him over $800 in lost
                revenue.
              </p>
              <p>
                He tried every booking tool he could find — Square Appointments, Calendly, Jobber.
                None of them were built with detailers in mind. They didn&apos;t understand deposits,
                they didn&apos;t send the right kind of reminders, and they were loaded with features he
                didn&apos;t need while missing the ones he did.
              </p>
              <p>
                So Alex teamed up with a developer friend and built DetailBook — a scheduling tool
                designed from the ground up for mobile auto detailers. The deposit system alone cut
                his no-shows by 90% in the first month.
              </p>
              <p>
                By early 2025, Alex was sharing the tool with other detailers in online groups. The
                response was overwhelming. Today, DetailBook powers hundreds of detailing businesses
                across the US, and the team is growing with one mission: give every detailer the
                tools to run a professional, profitable business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Meet the Team</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              A small, passionate crew committed to building the best tool for mobile detailers.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 text-center hover:border-blue-500/30 hover:-translate-y-1 transition-all duration-300 animate-fadeInUp"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {/* Avatar */}
                <div className={`w-20 h-20 bg-gradient-to-br ${member.gradient} rounded-2xl flex items-center justify-center text-2xl font-black text-white mx-auto mb-5 shadow-lg`}>
                  {member.initials}
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{member.name}</h3>
                <p className="text-blue-400 text-sm font-semibold mb-4">{member.role}</p>
                <p className="text-gray-400 leading-relaxed text-sm">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to grow your detailing business?
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Join 500+ detailers who use DetailBook to stop no-shows, collect deposits, and look professional online.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 text-lg"
          >
            Start Your Free 30-Day Trial
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <p className="text-gray-500 text-sm mt-4">No credit card required. Cancel anytime.</p>
        </div>
      </section>
    </SiteLayout>
  );
}
