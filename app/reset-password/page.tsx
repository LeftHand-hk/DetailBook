"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Logo from "@/components/Logo";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing or invalid reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-extrabold text-gray-900 mb-2">Invalid link</h1>
        <p className="text-sm text-gray-500 mb-6">This reset link is invalid or has already been used.</p>
        <Link href="/forgot-password" className="inline-block bg-gray-900 text-white text-sm font-bold py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors">
          Request new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 mb-2">Password reset!</h1>
        <p className="text-sm text-gray-500">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-extrabold text-gray-900 mb-1.5">Set a new password</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a strong password (at least 8 characters).</p>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl transition-all text-sm"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100 bg-white">
        <Logo size="sm" href="/" darkText />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[420px] bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <Suspense fallback={<div className="text-center text-sm text-gray-400">Loading...</div>}>
            <ResetPasswordInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
