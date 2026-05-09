"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Logo from "@/components/Logo";
import { usePlatformName } from "@/components/PlatformName";
import { trackEvent } from "@/lib/meta-pixel";

const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const XIcon = () => (
  <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const platformName = usePlatformName();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fire ViewContent("Pricing Page") when the visitor lands directly on the
  // #pricing anchor (e.g. from a nav click or shared link). Once per page
  // load — guarded by a sessionStorage flag so SPA navigation doesn't repeat.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#pricing") return;
    if (sessionStorage.getItem("db_pixel_pricing_view") === "1") return;
    trackEvent("ViewContent", {
      content_name: "Pricing Page",
      content_category: "lead",
    });
    sessionStorage.setItem("db_pixel_pricing_view", "1");
  }, []);

  const features = [
    { icon: "📅", title: "Online Booking Page", desc: "Your own branded booking link. Customers book appointments 24/7 — no phone calls needed." },
    { icon: "💳", title: "Deposit Collection", desc: "Require a deposit at booking to eliminate no-shows and protect your time and revenue." },
    { icon: "📱", title: "SMS Reminders", desc: "Automated text reminders sent 2 hours before each appointment to reduce no-shows." },
    { icon: "🗓️", title: "Calendar Dashboard", desc: "See all jobs at a glance — whether at your shop or out in the field. Never double-book again." },
    { icon: "🔗", title: "Google Calendar Sync", desc: "Two-way sync with Google Calendar. Your schedule, everywhere you need it." },
    { icon: "🛠️", title: "Service Package Builder", desc: "Create packages for any vehicle type — sedan, SUV, truck, luxury. Let customers choose and book instantly." },
  ];

  const faqs = [
    { q: "Do I need a credit card to start?", a: "No! You can start your 15-day free trial without entering any payment info. We'll remind you before the trial ends." },
    { q: "Do you take a cut of my bookings or deposits?", a: "Never. The monthly subscription is the only thing you pay us — no per-booking fees, no commission, no hidden cuts. When a customer pays a deposit by card, the money goes straight to your own Stripe/Square account. The only fees are the standard processor fees Stripe or Square charge directly." },
    { q: "Can my customers pay the deposit online?", a: "Yes. On both Starter and Pro, customers can pay the deposit straight from your booking page. We support card payments via Stripe, plus PayPal, Cash App, Square, bank transfer, and pay-cash-on-arrival — turn on whichever methods fit your business." },
    { q: "What happens if I exceed 5 packages on Starter?", a: "You'll be prompted to upgrade to Pro. All your existing packages stay active — you just can't add more until you upgrade." },
    { q: "Can I cancel anytime?", a: "Absolutely. No long-term contracts. Cancel any time from your Settings page. You keep access until the end of your billing period." },
    { q: "Does DetailBook work on mobile?", a: "Yes! Both your dashboard and your customer-facing booking page are fully optimized for mobile devices." },
    { q: "Can I use my own domain for the booking page?", a: "On the Pro plan, you can connect a custom domain (e.g., book.yourbusiness.com). Starter gets a detailbookapp.com/book/your-name URL." },
  ];

  const navLinks = ["Features","Pricing","FAQ"];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ═══════════════════════════════════════════════
          NAVBAR
      ═══════════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/20"
          : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <Logo href="/" size="sm" />
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((label) => (
                <a key={label} href={`#${label.toLowerCase()}`}
                  className="relative text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200 group">
                  {label}
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-blue-400 rounded-full group-hover:w-4 transition-all duration-300" />
                </a>
              ))}
              <Link href="/book/mikes-mobile-detailing" target="_blank"
                className="text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Demo
              </Link>
            </div>

            {/* CTAs */}
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login"
                className="text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200">
                Log In
              </Link>
              <Link href="/signup" onClick={() => trackEvent("Lead")}
                className="relative group flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5">
                Start Free Trial
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Mobile: Start Free Trial + burger */}
            <div className="md:hidden flex items-center gap-2">
              <Link href="/signup" onClick={() => trackEvent("Lead")}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                Start Free Trial
              </Link>
              <button onClick={() => setMenuOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile Sidebar Overlay ── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-[75vw] max-w-[300px] bg-[#0B1120] shadow-2xl flex flex-col animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
              <Logo size="sm" />
              <button onClick={() => setMenuOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navLinks.map((label) => (
                <a key={label} href={`#${label.toLowerCase()}`} onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">
                  {label}
                </a>
              ))}
              <a href="/book/mikes-mobile-detailing" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                Demo
              </a>
            </nav>

            {/* Bottom CTAs */}
            <div className="px-4 pb-6 space-y-2 border-t border-white/[0.06] pt-4">
              <Link href="/login" onClick={() => setMenuOpen(false)}
                className="block text-center text-white/80 font-semibold py-3 px-4 rounded-xl border border-white/10 hover:bg-white/[0.06] transition-colors text-sm">
                Log In
              </Link>
              <Link href="/signup" onClick={() => { trackEvent("Lead"); setMenuOpen(false); }}
                className="block text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-600/20 text-sm">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          HERO — FUTURISTIC MESH BACKGROUND
      ═══════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center text-white overflow-hidden">

        {/* Base dark background */}
        <div className="absolute inset-0 bg-[#080c18]" />

        {/* Animated gradient orbs — desktop only. The 100-120px blur radii
            multiplied by huge surface areas tank mobile GPUs (the user
            reported blank sections for ~10s on phones). The flat dark
            base + grid lines below still look polished without them. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/25 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute top-[10%] right-[-15%] w-[60%] h-[60%] bg-indigo-700/20 rounded-full blur-[100px] animate-blobFloat delay-400" />
          <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-cyan-600/15 rounded-full blur-[100px] animate-blobFloat delay-700" />
        </div>
        {/* Mobile fallback: a static, much cheaper radial gradient that
            keeps the section from looking too flat. */}
        <div
          className="absolute inset-0 pointer-events-none md:hidden"
          style={{
            background:
              "radial-gradient(ellipse at top left, rgba(37,99,235,0.18), transparent 55%), radial-gradient(ellipse at bottom right, rgba(67,56,202,0.12), transparent 55%)",
          }}
        />

        {/* SVG Grid lines */}
        <div className="absolute inset-0 overflow-hidden opacity-[0.07] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glowing horizontal lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
          <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
        </div>

        {/* Scattered dot particles — hidden on mobile to keep above-the-fold light */}
        <div className="absolute inset-0 pointer-events-none hidden sm:block">
          {[
            { top:"15%", left:"8%",  delay:"0s",   size:"w-1 h-1" },
            { top:"25%", left:"92%", delay:"0.5s", size:"w-1.5 h-1.5" },
            { top:"70%", left:"5%",  delay:"1s",   size:"w-1 h-1" },
            { top:"80%", left:"88%", delay:"1.5s", size:"w-2 h-2" },
            { top:"40%", left:"96%", delay:"2s",   size:"w-1 h-1" },
            { top:"55%", left:"3%",  delay:"2.5s", size:"w-1.5 h-1.5" },
          ].map((p, i) => (
            <div key={i} className={`absolute ${p.size} bg-blue-400 rounded-full opacity-50 animate-pulse`}
              style={{ top: p.top, left: p.left, animationDelay: p.delay }} />
          ))}
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center pt-24 sm:pt-32 pb-12 sm:pb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass border border-blue-500/30 text-blue-300 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-5 sm:mb-8 animate-fadeInUp">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            Purpose-built for auto detailers
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.05] mb-4 sm:mb-6 animate-fadeInUp delay-100">
            Booking Software<br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent animate-gradientShift">Built for Auto Detailers</span>
          </h1>

          <p className="text-base sm:text-xl text-white/60 max-w-2xl mx-auto mb-7 sm:mb-10 leading-relaxed animate-fadeInUp delay-200">
            Stop losing money to no-shows. Collect deposits, send SMS reminders, and manage your entire schedule — for shops and mobile detailers alike.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-10 sm:mb-14 animate-fadeInUp delay-300">
            <Link href="/signup" onClick={() => trackEvent("Lead")}
              className="group relative inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg px-10 py-4 rounded-2xl transition-all duration-300 shadow-2xl shadow-blue-600/40 hover:shadow-blue-500/50 hover:-translate-y-1">
              <span>Start My Free Trial</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-xl" />
            </Link>
            <Link href="/book/mikes-mobile-detailing"
              className="glass border border-white/20 text-white font-bold text-lg px-10 py-4 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5">
              See Live Demo →
            </Link>
          </div>

          <p className="text-white/35 text-sm animate-fadeInUp delay-400">
            No credit card required · 15-day free trial · Cancel anytime
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 pb-20 animate-fadeInUp delay-500">
          <div className="text-xs text-gray-500 text-center mb-2">
            Sample Dashboard Preview
          </div>
          <div className="relative">
            {/* Glow beneath card */}
            <div className="absolute -inset-4 bg-blue-600/20 rounded-3xl blur-2xl" />
            <div className="relative bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                <div className="flex-1 mx-3 bg-white/5 rounded-md h-3" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Total Bookings", value: "32", change: "+9%", from:"from-blue-500", to:"to-blue-700" },
                  { label: "Revenue / Month", value: "$1,420", change: "+6%", from:"from-emerald-500", to:"to-emerald-700" },
                  { label: "Today's Jobs", value: "2", change: "upcoming", from:"from-purple-500", to:"to-purple-700" },
                  { label: "Total Revenue", value: "$4.8k", change: "all time", from:"from-amber-500", to:"to-orange-600" },
                ].map((stat, i) => (
                  <div key={i} className={`bg-gradient-to-br ${stat.from} ${stat.to} rounded-xl p-3 relative overflow-hidden`}>
                    <div className="absolute -right-2 -top-2 w-10 h-10 bg-white/10 rounded-full" />
                    <p className="text-white/70 text-xs mb-1">{stat.label}</p>
                    <p className="text-white font-black text-lg">{stat.value}</p>
                    <p className="text-white/70 text-xs">{stat.change}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white text-sm font-bold">Recent Bookings</span>
                  <span className="text-blue-400 text-xs font-semibold">View all →</span>
                </div>
                {[
                  { name: "James Wilson",   service: "Full Detail",     date: "Mar 25", status: "confirmed", amount: "$199" },
                  { name: "Sarah Martinez", service: "Ceramic Coating", date: "Mar 27", status: "confirmed", amount: "$599" },
                  { name: "David Chen",     service: "Basic Wash",      date: "Mar 28", status: "pending",   amount: "$79"  },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-blue-600/40 rounded-lg flex items-center justify-center">
                        <span className="text-blue-300 text-xs font-bold">{row.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-white text-xs font-semibold">{row.name}</p>
                        <p className="text-white/40 text-xs">{row.service} · {row.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${row.status === "confirmed" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {row.status}
                      </span>
                      <span className="text-white text-xs font-bold">{row.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      </section>

      {/* ═══════════════════════════════════════════════
          SOCIAL PROOF BAR
      ═══════════════════════════════════════════════ */}
      <section className="bg-slate-900 border-y border-white/5 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-center">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white/80 text-sm font-semibold">Set up in 5 minutes</p>
          </div>
          <div className="hidden sm:block w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-white/80 text-sm font-semibold">Collect deposits automatically</p>
          </div>
          <div className="hidden sm:block w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-white/80 text-sm font-semibold">Shop + Mobile scheduling</p>
          </div>
          <div className="hidden sm:block w-px h-6 bg-white/10" />
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
            </svg>
            <p className="text-white/80 text-sm font-semibold">Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PROBLEM SECTION
      ═══════════════════════════════════════════════ */}
      <section className="bg-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            Stop Losing Money to No-Shows<br />and Scheduling Chaos
          </h2>
          <p className="text-xl text-gray-500 mb-16">
            No-shows, missed calls, and double bookings kill revenue. There&apos;s a better way.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon:"😤", title:"No-Shows Cost You",       desc:"Whether at your shop or on-site — a no-show means wasted time, blocked slots, and lost income with nothing to show for it.", color:"red" },
              { icon:"📞", title:"Phone Tag & Texts",       desc:"You're spending hours coordinating bookings manually instead of actually detailing cars.", color:"yellow" },
              { icon:"🗂️", title:"Disorganized Schedule",  desc:"Scattered notes, missed appointments, double bookings. It's stressful and unprofessional.", color:"orange" },
            ].map((item, i) => (
              <div key={i} className="text-center p-7 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 p-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white text-center shadow-xl shadow-blue-600/20">
            <p className="text-2xl font-black mb-2">{platformName} fixes all of this.</p>
            <p className="text-blue-200">Professional tools built specifically for auto detailing businesses — shop-based or mobile.</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════════ */}
      <section id="features" className="bg-slate-900 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Everything You Need to Run<br />Your Detailing Business
            </h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">
              Purpose-built for auto detailing businesses — shop-based, mobile, or both. Not generic software with a new coat of paint.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/60 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 group">
                <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-blue-600/30 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          WHY DETAILBOOK — DEFENSIBLE PILLARS
      ═══════════════════════════════════════════════ */}
      <section className="bg-white py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Why Detailers Choose {platformName}</h2>
            <p className="text-gray-500 text-xl">Built around the way detailing shops and mobile pros actually work.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "🎯",
                title: "Made only for auto detailers",
                desc: "Not a generic booking tool. Every feature — vehicle types, package builder, deposits — is shaped around detailing workflows.",
              },
              {
                icon: "💸",
                title: "Starts at $29/month",
                desc: "Detailing-specific software starts at one of the lowest entry prices in the category. No setup fees, no per-booking cuts.",
              },
              {
                icon: "🛡️",
                title: "Deposits stop no-shows",
                desc: "Require a deposit at booking so customers commit before they take a slot. Protect your day from cancellations.",
              },
              {
                icon: "🚐",
                title: "Shop or mobile, one calendar",
                desc: "Run your bay, your truck, or both. Drive-time aware scheduling keeps mobile jobs from colliding.",
              },
              {
                icon: "📲",
                title: "SMS + email reminders",
                desc: "Automated text and email reminders cut last-minute no-shows without you lifting a finger.",
              },
              {
                icon: "🆓",
                title: "15-day free trial, no card",
                desc: "Try the full platform with no credit card. Cancel any time, keep your data.",
              },
            ].map((pillar, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="text-4xl mb-3">{pillar.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{pillar.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          HOW IT WORKS — 3 STEPS AFTER SIGNUP
      ═══════════════════════════════════════════════ */}
      <section className="bg-slate-900 py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Up and Running in Under 5 Minutes
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              No setup fees, no installations, no salespeople. Just three steps from sign-up to taking bookings.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 relative">
            {/* connector line on desktop */}
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent pointer-events-none" />

            {[
              { num: "1", title: "Create your account", desc: "Enter your business name and you're in. No credit card needed for the 15-day trial." },
              { num: "2", title: "Add your service packages", desc: "List the details you offer — basic wash, full detail, ceramic coating. Set price, duration, and deposit." },
              { num: "3", title: "Share your booking link", desc: "Send your DetailBook link via SMS, IG bio, or your website. Customers book and pay deposits 24/7." },
            ].map((step) => (
              <div key={step.num} className="relative bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 text-center hover:border-blue-500/40 transition-all duration-300">
                <div className="relative z-10 w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-600/30">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          COMPARISON — DETAILBOOK VS GENERIC TOOLS
      ═══════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
              Why Not Just Use Square or Vagaro?
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Generic booking tools weren&apos;t built with auto detailing in mind. {platformName} is.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
              <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">Feature</div>
              <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-black text-blue-700 uppercase tracking-wide text-center">{platformName}</div>
              <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide text-center">Generic Tools</div>
            </div>
            {[
              { feature: "Vehicle-type pricing (sedan / SUV / truck)", us: true, them: false },
              { feature: "Built-in mandatory deposits", us: true, them: false },
              { feature: "Shop + mobile scheduling in one calendar", us: true, them: false },
              { feature: "Detailing service-package builder", us: true, them: false },
              { feature: "No per-booking commission", us: true, them: "Some take a cut" },
              { feature: "Starts at $29/month", us: true, them: "$30+ and up" },
            ].map((row, i) => (
              <div key={i} className={`grid grid-cols-3 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-100 last:border-0`}>
                <div className="px-4 sm:px-6 py-4 text-sm text-gray-700">{row.feature}</div>
                <div className="px-4 sm:px-6 py-4 text-center">
                  {row.us === true ? (
                    <CheckIcon />
                  ) : (
                    <span className="text-sm font-semibold text-gray-700">{row.us}</span>
                  )}
                </div>
                <div className="px-4 sm:px-6 py-4 text-center">
                  {row.them === false ? (
                    <XIcon />
                  ) : row.them === true ? (
                    <CheckIcon />
                  ) : (
                    <span className="text-xs sm:text-sm text-gray-500">{row.them}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          PRICING — EQUAL HEIGHT CARDS
      ═══════════════════════════════════════════════ */}
      <section id="pricing" className="bg-slate-900 py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-700/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-xl">Start free for 15 days. No credit card required.</p>
          </div>

          {/* Grandfather pricing notice */}
          <div className="max-w-2xl mx-auto mb-10">
            <div className="flex items-start sm:items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
              <div className="w-9 h-9 flex-shrink-0 bg-amber-500/20 border border-amber-400/30 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-amber-100 text-sm leading-snug">
                <span className="font-bold text-amber-200">Early-bird pricing.</span>{" "}
                Sign up now and lock in today&apos;s rate forever — even when our prices go up later.
              </p>
            </div>
          </div>

          {/* Equal-height grid */}
          <div className="grid sm:grid-cols-2 gap-6 items-stretch">

            {/* Starter */}
            <div className="flex flex-col bg-slate-800 border border-slate-700 rounded-2xl p-8">
              <div className="mb-6">
                <h3 className="text-xl font-black text-white mb-1">Starter</h3>
                <p className="text-gray-400 text-sm">Perfect for solo detailers just getting started.</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-black text-white">$29</span>
                <span className="text-gray-400 ml-1">/month</span>
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {["Custom booking page","Up to 5 service packages","Deposit collection","Email reminders","Calendar dashboard","Mobile-friendly dashboard","Google Calendar sync"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300 text-sm">
                    <CheckIcon />{item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mb-6">
                Need SMS reminders, multiple staff, or unlimited packages? <span className="text-gray-400">Upgrade to Pro any time.</span>
              </p>
              <Link href="/signup" onClick={() => trackEvent("Lead")}
                className="block w-full text-center bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-bold py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5">
                Get Started — Free
              </Link>
            </div>

            {/* Pro */}
            <div className="flex flex-col relative bg-gradient-to-b from-blue-600 to-indigo-700 border border-blue-500/50 rounded-2xl p-8 shadow-2xl shadow-blue-600/30">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-xs font-black px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/30">
                  ✦ MOST POPULAR
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-black text-white mb-1">Pro</h3>
                <p className="text-blue-200 text-sm">For serious detailers ready to scale.</p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-black text-white">$50</span>
                <span className="text-blue-200 ml-1">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {["Everything in Starter","Unlimited service packages","SMS + Email reminders","Multiple staff & calendars","Google Calendar sync","Custom domain","Priority support","Analytics dashboard"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white text-sm">
                    <svg className="w-5 h-5 text-blue-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" onClick={() => trackEvent("Lead")}
                className="block w-full text-center bg-white text-blue-700 hover:bg-blue-50 font-black py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5">
                Try Pro — Free for 15 Days
              </Link>
            </div>
          </div>

          <p className="text-center text-gray-500 mt-8 text-sm">
            Both plans include a 15-day free trial. Cancel anytime. No setup fees.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════════ */}
      <section id="faq" className="bg-white py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-500 text-lg">Everything you need to know before getting started.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${openFaq === i ? "border-blue-200 shadow-md shadow-blue-100" : "border-gray-200"}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <span className="font-bold text-gray-900 pr-4">{faq.q}</span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${openFaq === i ? "bg-blue-600 rotate-180" : "bg-gray-100"}`}>
                    <svg className={`w-4 h-4 ${openFaq === i ? "text-white" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 animate-fadeIn">
                    <p className="text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          BOTTOM CTA — FUTURISTIC REDESIGN
      ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-28 px-4">
        {/* Background */}
        <div className="absolute inset-0 bg-[#060b16]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Animated blobs desktop only — same mobile-perf reason as the hero. */}
          <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[120%] bg-blue-700/25 rounded-full blur-3xl animate-blobFloat hidden md:block" />
          <div className="absolute top-[-20%] right-[-15%] w-[55%] h-[100%] bg-indigo-700/20 rounded-full blur-3xl animate-blobFloat delay-500 hidden md:block" />
          <div
            className="absolute inset-0 md:hidden"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(29,78,216,0.22), transparent 60%)",
            }}
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        </div>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <svg width="100%" height="100%"><defs><pattern id="grid2" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid2)" /></svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass border border-white/10 text-white/60 text-xs font-bold px-4 py-2 rounded-full mb-8 uppercase tracking-widest">
            <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
            Now in Beta — Join Early Access
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            Ready to Grow Your<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Detailing Business?</span>
          </h2>

          <p className="text-white/50 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Start your free trial today. Set up in minutes, start collecting deposits and bookings right away.
          </p>

          {/* Value props */}
          <div className="flex flex-wrap justify-center gap-8 mb-12">
            {[
              { value: "5 min",  label: "Setup time" },
              { value: "15 days", label: "Free trial" },
              { value: "$0",     label: "To get started" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-black text-white mb-0.5">{value}</p>
                <p className="text-white/40 text-sm">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link href="/signup" onClick={() => trackEvent("Lead")}
              className="group inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg px-10 py-4 rounded-2xl transition-all duration-300 shadow-2xl shadow-blue-600/40 hover:-translate-y-1">
              Try DetailBook Free
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link href="/book/mikes-mobile-detailing"
              className="inline-flex items-center justify-center glass border border-white/20 text-white font-bold text-lg px-10 py-4 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5">
              See a Live Demo →
            </Link>
          </div>

          <p className="text-white/25 text-sm">No credit card · 15-day free trial · Setup in 5 minutes · Cancel anytime</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FOOTER — ADVANCED
      ═══════════════════════════════════════════════ */}
      <footer className="bg-slate-950 text-gray-400 pt-16 pb-8 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Top grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-10 pb-12 border-b border-white/5">

            {/* Brand col (wider) */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-2">
              <div className="mb-4">
                <Logo href="/" size="sm" />
              </div>
              <p className="text-sm leading-relaxed text-gray-500 max-w-xs mb-6">
                The professional scheduling and booking platform built exclusively for auto detailing businesses.
              </p>
              {/* Social icons */}
              <div className="flex items-center gap-3">
                <a
                  href="https://www.facebook.com/profile.php?id=100063817955495"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-blue-600/30 hover:border-blue-500/40 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Links */}
            {[
              { title: "Product", links: [
                { label:"Features",  href:"/#features" },
                { label:"Pricing",   href:"/#pricing"  },
                { label:"FAQ",       href:"/#faq"       },
                { label:"Live Demo", href:"/book/mikes-mobile-detailing" },
              ]},
              { title: "Company", links: [
                { label:"About",   href:"/about"   },
                { label:"Contact", href:"/contact" },
                { label:"Support", href:"/support" },
              ]},
              { title: "Account", links: [
                { label:"Sign Up",   href:"/signup"             },
                { label:"Log In",    href:"/login"              },
                { label:"Dashboard", href:"/dashboard"          },
                { label:"Settings",  href:"/dashboard/settings" },
                { label:"Support",   href:"/support"            },
              ]},
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-white font-bold text-sm mb-5 uppercase tracking-wider">{title}</h4>
                <ul className="space-y-3">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="text-gray-500 hover:text-white text-sm transition-colors duration-150 hover:translate-x-0.5 inline-block">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <p className="text-gray-600">© {new Date().getFullYear()} {platformName}. All rights reserved.</p>
            </div>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="text-gray-600 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-gray-600 hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/refund" className="text-gray-600 hover:text-white transition-colors">Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
