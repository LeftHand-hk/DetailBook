"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <Logo size="sm" href="/" darkText />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px] bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-extrabold text-gray-900 mb-2">Check your email</h1>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. The link will expire in 1 hour.
              </p>
              <Link href="/login" className="inline-block bg-gray-900 text-white text-sm font-bold py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-extrabold text-gray-900 mb-1.5">Reset your password</h1>
              <p className="text-sm text-gray-500 mb-6">Enter your email and we&apos;ll send you a link to reset your password.</p>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourbusiness.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl transition-all text-sm"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
              <p className="text-center text-gray-400 text-sm mt-6">
                Remember your password?{" "}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
