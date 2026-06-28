"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The ONLY blocking modal in the trial flow. Shows once the 7-day trial
// has ended and the owner hasn't paid. They pick a plan, then Continue
// sends them to the billing page which auto-opens Paddle checkout for the
// plan they chose (immediate subscription — Paddle has no trial). No
// booking/package counts are shown, per spec. Not dismissible.
const PLANS = [
  { id: "starter", name: "Starter", price: 24, blurb: "Everything to take bookings" },
  { id: "pro", name: "Pro", price: 50, blurb: "SMS, staff, analytics & branding" },
] as const;

export default function TrialEndedModal() {
  const router = useRouter();
  const [plan, setPlan] = useState<"starter" | "pro">("starter");
  const [continuing, setContinuing] = useState(false);

  const handleContinue = () => {
    setContinuing(true);
    router.push(`/dashboard/billing?checkout=${plan}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeInUp">
        <div className="px-6 pt-7 pb-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900">Your trial has ended</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-gray-500">
            Your booking page is now offline — customers can&apos;t book you or pay deposits until you choose a plan.
          </p>
        </div>

        <div className="space-y-2.5 px-6">
          {PLANS.map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition-all active:scale-[0.99] ${
                  active ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-200"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-black text-gray-900">{p.name}</span>
                  <span className="block text-xs text-gray-500">{p.blurb}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="text-sm font-black text-gray-900">
                    ${p.price}
                    <span className="text-xs font-bold text-gray-400">/mo</span>
                  </span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    active ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"
                  }`}>
                    {active && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 pt-4">
          <button
            onClick={handleContinue}
            disabled={continuing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:bg-blue-400"
          >
            {continuing ? "Opening checkout…" : "Continue"}
          </button>
          <p className="mt-3 text-center text-xs text-gray-400">
            Cancel anytime · Your packages, bookings, and settings are saved.
          </p>
        </div>
      </div>
    </div>
  );
}
