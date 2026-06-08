"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login as setLocalLoggedIn, syncFromServer } from "@/lib/storage";

// One-click landing for prospects coming from the onboarding "See
// dashboard demo" button. Performs the demo login server-side, then
// shoots them straight into the dashboard. We can't bypass auth without
// swapping the cookie, so this page is opened in a NEW TAB by the
// onboarding link — the visitor's own onboarding session in the
// original tab stays put unless they interact with it.
export default function DemoDashboardRedirect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "mike@demo.com", password: "demo123" }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const j = await res.json().catch(() => ({} as any));
          setError(j?.error || `Demo login failed (HTTP ${res.status}).`);
          return;
        }
        setLocalLoggedIn();
        await syncFromServer().catch(() => {});
        if (cancelled) return;
        router.replace("/dashboard");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't reach the demo login.");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        {!error ? (
          <>
            <div className="w-10 h-10 mx-auto mb-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <h1 className="text-lg font-bold text-gray-900">Loading demo dashboard…</h1>
            <p className="text-sm text-gray-500 mt-1">One moment.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900">Couldn&rsquo;t load the demo</h1>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <a href="/onboarding" className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
              Back to onboarding
            </a>
          </>
        )}
      </div>
    </div>
  );
}
