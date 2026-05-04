"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SetupHintProps = {
  step: "services" | "deposits";
};

const COPY: Record<SetupHintProps["step"], { title: string; body: string; tips: string[] }> = {
  services: {
    title: "Setup: Add your service packages",
    body: "Add at least one package so customers have something to book.",
    tips: [
      "Click \"Add Package\" to create a new service.",
      "Set a clear name (e.g. \"Full Detail\"), price, and how long it takes.",
      "You can add as many as you need — edit or remove them anytime.",
    ],
  },
  deposits: {
    title: "Setup: Configure deposits",
    body: "Decide if customers should pay a deposit when they book.",
    tips: [
      "Toggle \"Require deposit\" below to turn it on.",
      "Set the deposit amount per package on the Packages page.",
      "Deposits reduce no-shows and lock in customer commitment.",
    ],
  },
};

export default function SetupHint({ step }: SetupHintProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(searchParams.get("setup") === step);
  }, [searchParams, step]);

  if (!open) return null;

  const copy = COPY[step];

  const close = () => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("setup");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-blue-900">{copy.title}</p>
        <p className="text-xs text-blue-800 mt-0.5">{copy.body}</p>
        <ul className="mt-2 space-y-1">
          {copy.tips.map((t) => (
            <li key={t} className="text-xs text-blue-800 flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={close}
        aria-label="Dismiss"
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
