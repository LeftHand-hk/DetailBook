"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, syncFromServer } from "@/lib/storage";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed. Please try again.");
        setLoading(false);
        return;
      }
      login();
      await syncFromServer();
      setLoading(false);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "mike@demo.com", password: "demo123" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Demo login failed.");
        setLoading(false);
        return;
      }
      login();
      await syncFromServer();
      setLoading(false);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-[#060c18] flex-col justify-between p-12 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-700/30 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-700/20 rounded-full blur-3xl" />
        </div>
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="lgrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lgrid)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <Logo size="md" href="/" />
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 w-fit uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Platform for detailers
          </div>
          <h2 className="text-4xl font-black text-white leading-snug mb-4">
            Run your detailing<br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              business smarter.
            </span>
          </h2>
          <p className="text-white/50 text-base leading-relaxed max-w-sm mb-10">
            Online booking, deposits, SMS reminders, and a professional calendar — all built for detailers.
          </p>

          {/* Trust stats */}
          <div className="flex flex-col gap-4">
            {[
              { icon: "🛡️", label: "Mandatory deposits to eliminate no-shows" },
              { icon: "📲", label: "Automated SMS & email reminders" },
              { icon: "🗓️", label: "Real-time calendar with staff scheduling" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-white/60 text-sm">
                <span className="text-lg">{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 lg:border-none">
          <div className="lg:hidden">
            <Logo size="sm" href="/" darkText />
          </div>
          <Link href="/"
            className="hidden lg:flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm font-medium transition-colors ml-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to site
          </Link>
          <Link href="/"
            className="lg:hidden flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900 mb-1.5">Welcome back</h1>
              <p className="text-gray-400 text-sm">Sign in to your DetailBook account</p>
            </div>

            {/* Demo banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
              <p className="text-blue-800 text-sm font-semibold mb-0.5">Try the demo</p>
              <p className="text-blue-500 text-xs mb-3">Explore Mike&apos;s Mobile Detailing with real sample data.</p>
              <button
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
              >
                {loading ? "Loading..." : "Log In as Demo User"}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@yourbusiness.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white placeholder-gray-400 transition-all text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <a href="#" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot password?</a>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white placeholder-gray-400 transition-all text-sm pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? (
                      <svg className="w-4.5 h-4.5 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded accent-blue-600"
                />
                <label htmlFor="remember" className="text-sm text-gray-500">Keep me signed in</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign In →"
                )}
              </button>
            </form>

            <p className="text-center text-gray-400 text-sm mt-7">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
                Start your free trial
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-gray-300">
            © {new Date().getFullYear()} DetailBook · Built for auto detailers ·{" "}
            <a href="/privacy" className="hover:text-gray-500 transition-colors">Privacy</a>
            {" · "}
            <a href="/terms" className="hover:text-gray-500 transition-colors">Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}
