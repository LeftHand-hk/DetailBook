"use client";

import Link from "next/link";
import { useState } from "react";
import SiteLayout from "@/components/SiteLayout";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "General",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  };

  const contactCards = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: "Email",
      value: "info@detailbookapp.com",
      href: "mailto:info@detailbookapp.com",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: "Twitter / X",
      value: "@DetailBook",
      href: "https://twitter.com/DetailBook",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: "Response Time",
      value: "Within 24 hours",
      href: null,
    },
  ];

  return (
    <SiteLayout>
      {/* ── Hero ── */}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            CONTACT US
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4 animate-fadeInUp delay-100">
            Get in Touch
          </h1>
          <p className="text-xl text-gray-400 animate-fadeInUp delay-200">
            Have a question or want to learn more? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* ── Contact Section ── */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-10">

            {/* Left: contact info */}
            <div className="lg:col-span-2 space-y-5">
              <h2 className="text-xl font-bold text-white mb-2">Contact Information</h2>
              {contactCards.map((card, i) => (
                <div
                  key={i}
                  className="bg-slate-800/60 border border-white/10 rounded-xl p-5 flex items-center gap-4 animate-fadeInUp"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">{card.label}</p>
                    {card.href ? (
                      <a href={card.href} className="text-white font-semibold hover:text-blue-400 transition-colors">
                        {card.value}
                      </a>
                    ) : (
                      <p className="text-white font-semibold">{card.value}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Looking for help */}
              <div className="bg-gradient-to-br from-indigo-600/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-5 mt-8 animate-fadeInUp delay-300">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Looking for help?
                </h3>
                <p className="text-gray-400 text-sm mb-3 leading-relaxed">
                  Check our Help Center for instant answers to common questions about billing, setup, and features.
                </p>
                <Link
                  href="/support"
                  className="text-blue-400 hover:text-blue-300 text-sm font-semibold flex items-center gap-1 transition-colors"
                >
                  Visit Help Center
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right: contact form */}
            <div className="lg:col-span-3">
              <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-8 animate-fadeInUp delay-100">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3">Message Sent!</h3>
                    <p className="text-gray-400 mb-6">
                      Thanks for reaching out. We&apos;ll get back to you within 24 hours.
                    </p>
                    <button
                      onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "General", message: "" }); }}
                      className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <h2 className="text-xl font-bold text-white mb-1">Send Us a Message</h2>
                    <p className="text-gray-400 text-sm mb-4">We read and respond to every message.</p>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                          Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          required
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Your name"
                          className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                          Email <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          required
                          value={form.email}
                          onChange={handleChange}
                          placeholder="you@example.com"
                          className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Subject <span className="text-red-400">*</span>
                      </label>
                      <select
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="General">General Inquiry</option>
                        <option value="Billing">Billing</option>
                        <option value="Technical Support">Technical Support</option>
                        <option value="Partnership">Partnership</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                        Message <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        name="message"
                        required
                        value={form.message}
                        onChange={handleChange}
                        rows={5}
                        placeholder="Tell us how we can help..."
                        className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25"
                    >
                      {loading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
