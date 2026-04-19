"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "@/components/Logo";
import PlatformName from "@/components/PlatformName";

interface SiteLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function SiteLayout({ children }: SiteLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080c18] text-white overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Logo href="/" size="sm" />

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              <a
                href="/#features"
                className="text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                Features
              </a>
              <a
                href="/#pricing"
                className="text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                Pricing
              </a>
              <Link
                href="/blog"
                className="text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                Blog
              </Link>
            </div>

            {/* CTAs */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/login"
                className="text-sm font-semibold text-white/70 hover:text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all duration-200"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
              >
                Start Free Trial
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Mobile: Login + burger */}
            <div className="md:hidden flex items-center gap-2">
              <Link href="/login"
                className="text-sm font-semibold text-white/70 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition-all">
                Log In
              </Link>
              <button
                onClick={() => setMenuOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
              >
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
              <a href="/#features" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">Features</a>
              <a href="/#pricing" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">Pricing</a>
              <Link href="/blog" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">Blog</Link>
              <Link href="/about" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">About</Link>
              <Link href="/contact" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">Contact</Link>
              <Link href="/support" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/80 font-semibold text-sm hover:bg-white/[0.06] hover:text-white transition-all">Support</Link>
            </nav>

            {/* Bottom CTAs */}
            <div className="px-4 pb-6 space-y-2 border-t border-white/[0.06] pt-4">
              <Link href="/login" onClick={() => setMenuOpen(false)}
                className="block text-center text-white/80 font-semibold py-3 px-4 rounded-xl border border-white/10 hover:bg-white/[0.06] transition-colors text-sm">
                Log In
              </Link>
              <Link href="/signup" onClick={() => setMenuOpen(false)}
                className="block text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-600/20 text-sm">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Content ── */}
      <main className="pt-16">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <Logo href="/" size="xs" />

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-400">
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link href="/support" className="hover:text-white transition-colors">Support</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>

            {/* Copyright */}
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} <PlatformName />. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
