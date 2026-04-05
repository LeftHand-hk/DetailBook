"use client";

import Link from "next/link";
import { useState } from "react";
import SiteLayout from "@/components/SiteLayout";

const categories = [
  {
    title: "Getting Started",
    description: "Set up your account, booking page, and first services",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    articles: 12,
    color: "text-blue-400",
    bg: "bg-blue-600/20 border-blue-500/30",
  },
  {
    title: "Billing & Plans",
    description: "Manage your subscription, payments, and invoices",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    articles: 8,
    color: "text-green-400",
    bg: "bg-green-600/20 border-green-500/30",
  },
  {
    title: "Booking Page",
    description: "Customize your public page, services, and availability",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    articles: 15,
    color: "text-purple-400",
    bg: "bg-purple-600/20 border-purple-500/30",
  },
  {
    title: "Technical Issues",
    description: "Troubleshoot errors, integrations, and account access",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    articles: 10,
    color: "text-orange-400",
    bg: "bg-orange-600/20 border-orange-500/30",
  },
];

const faqs = [
  {
    q: "How do I set up my booking page for the first time?",
    a: "After signing up, go to your Dashboard and click 'Set Up Booking Page'. You'll be guided through adding your business name, services, pricing, availability hours, and deposit settings. The whole process takes about 15 minutes. Once published, you'll get a shareable link at detailbook.app/book/your-handle.",
  },
  {
    q: "How does deposit collection work?",
    a: "On the Pro plan, customers pay a deposit via Stripe when they book through your page. The deposit is automatically deducted from their total at the appointment. If they cancel within your policy window (typically 24 hours), the deposit is forfeited and transferred to you. You need to connect a Stripe account in Settings > Payments to enable this.",
  },
  {
    q: "Can I sync DetailBook with my Google Calendar?",
    a: "Yes! Google Calendar sync is available on the Pro plan. Go to Settings > Integrations and click 'Connect Google Calendar'. Once connected, all new bookings automatically appear in your Google Calendar, and any events you block on Google are reflected as unavailable on your booking page.",
  },
  {
    q: "How do I cancel or reschedule a booking?",
    a: "From your Dashboard, find the appointment and click the three-dot menu. You can cancel or reschedule from there. If you reschedule, the customer receives an automated text with the new time. If you cancel, they receive a cancellation confirmation. For customer-initiated cancellations, customers can use the link in their confirmation text.",
  },
  {
    q: "What happens if a customer disputes a charge?",
    a: "Disputes are handled through Stripe's standard chargeback process. Your deposit policy (displayed on your booking page) serves as documentation. We recommend keeping your cancellation policy clearly stated and enabling email confirmations so there's always a paper trail. Contact support if you need help responding to a dispute.",
  },
  {
    q: "Can I have multiple service providers on one account?",
    a: "Currently, each DetailBook account supports one primary service provider. If you have employees or subcontractors, each would need their own account. Multi-provider accounts with shared calendars and routing are on our roadmap for 2026. Join the waitlist at detailbook.app/pro-teams.",
  },
  {
    q: "How do SMS reminders work?",
    a: "When SMS reminders are enabled (Pro plan), DetailBook automatically sends two text messages to your customer's phone number: one 24 hours before the appointment and one 1 hour before. The messages include the service name, time, and address. You can customize the message text in Settings > Reminders.",
  },
  {
    q: "Can I offer different pricing for different vehicle sizes?",
    a: "Yes! When creating a service in the Package Builder, you can add pricing tiers for different vehicle categories (e.g., Sedan, SUV, Truck). The customer selects their vehicle type during booking and the price adjusts automatically. This is available on both Starter and Pro plans.",
  },
  {
    q: "What payment methods can customers use?",
    a: "Customers can pay deposits using any major credit or debit card (Visa, Mastercard, Amex, Discover) through Stripe's secure checkout. Stripe also supports Apple Pay and Google Pay for mobile customers. ACH bank transfers and other payment methods are available for accounts in the US on the Pro plan.",
  },
  {
    q: "How do I upgrade, downgrade, or cancel my plan?",
    a: "Go to Settings > Billing in your dashboard. From there you can upgrade to Pro, downgrade to Starter, or cancel your subscription entirely. Changes take effect at the start of your next billing cycle. If you cancel, you retain access to all features until the end of your current billing period.",
  },
];

const popularArticles = [
  "How to share your booking link with customers",
  "Setting up deposit collection with Stripe",
  "Connecting your Google Calendar",
  "How to create and manage service packages",
  "Customizing your SMS reminder messages",
];

export default function SupportPage() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <SiteLayout>
      {/* ── Hero with Search ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute bottom-[-5%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/15 rounded-full blur-[100px] animate-blobFloat delay-400" />
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
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6 animate-fadeInUp">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            HELP CENTER
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp delay-100">
            How can we help?
          </h1>
          <p className="text-gray-400 text-lg mb-8 animate-fadeInUp delay-200">
            Search our knowledge base or browse by category below.
          </p>
          {/* Search */}
          <div className="relative max-w-xl mx-auto animate-fadeInUp delay-300">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles... (e.g. 'deposit', 'calendar sync')"
              className="w-full bg-slate-800/80 border border-white/15 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-lg"
            />
          </div>
        </div>
      </section>

      {/* ── Category Cards ── */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-white mb-7 text-center">Browse by Category</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map((cat, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fadeInUp"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className={`w-12 h-12 ${cat.bg} border rounded-xl flex items-center justify-center ${cat.color} mb-4`}>
                  {cat.icon}
                </div>
                <h3 className="text-white font-bold mb-1">{cat.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-3">{cat.description}</p>
                <span className="text-xs text-gray-500">{cat.articles} articles</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular Articles ── */}
      <section className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-white mb-5">Popular Articles</h2>
          <div className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden">
            {popularArticles.map((article, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-6 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                  i < popularArticles.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-gray-300 hover:text-white transition-colors text-sm">{article}</span>
                <svg className="w-4 h-4 text-gray-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-14 bg-slate-900/50 border-y border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-white mb-2 text-center">Frequently Asked Questions</h2>
          <p className="text-gray-400 text-center mb-10">Can&apos;t find what you need? Contact us below.</p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-slate-800/60 border border-white/10 rounded-xl overflow-hidden animate-fadeInUp"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-white font-semibold text-sm leading-snug">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 border-t border-white/10">
                    <p className="text-gray-300 text-sm leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Still need help ── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Still need help?</h2>
          <p className="text-gray-400 mb-8">
            Our support team responds within 24 hours, Monday through Saturday.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25"
            >
              Contact Support
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="mailto:info@detailbookapp.com"
              className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200"
            >
              Email Us Directly
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
