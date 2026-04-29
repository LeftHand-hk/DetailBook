"use client";

import { useState, useEffect } from "react";
import { getUser, setUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

const INPUT_CLASS =
  "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all placeholder-gray-300";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        value ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SavedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-semibold animate-fadeIn">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Saved!
    </span>
  );
}

/* ── SVG Icons ── */

function StripeIcon() {
  return (
    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M2 10h20" />
      <path strokeLinecap="round" strokeWidth={1.8} d="M6 15h4" />
    </svg>
  );
}

function PaddleIcon() {
  return (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h6a4 4 0 010 8H4z M4 12v8" />
      <circle cx="16" cy="16" r="4" strokeWidth={1.8} />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="3" strokeWidth={1.8} />
      <rect x="9" y="9" width="6" height="6" strokeWidth={1.8} />
    </svg>
  );
}

function PayPalIcon() {
  return (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="11" fontWeight="bold" fontFamily="sans-serif">P</text>
    </svg>
  );
}

function CashAppIcon() {
  return (
    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v10M9 9.5c0-.828 1.343-1.5 3-1.5s3 .672 3 1.5S14.657 11 12 11s-3 .672-3 1.5 1.343 1.5 3 1.5 3-.672 3-1.5" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="1" y="6" width="22" height="12" rx="2" strokeWidth={1.8} />
      <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
      <circle cx="4.5" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="12" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Status Dot ── */

function StatusDot({ status }: { status: "connected" | "disabled" | "error" }) {
  const colors = {
    connected: "bg-green-500",
    disabled: "bg-gray-300",
    error: "bg-red-500",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Not Connected
    </span>
  );
}

/* ── Default payment methods state ── */

type PaymentMethods = NonNullable<User["paymentMethods"]>;

const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  stripe: { enabled: false, publishableKey: "", secretKey: "", connected: false },
  paddle: { enabled: false, apiKey: "", productId: "", sandbox: false },
  square: { enabled: false, accessToken: "", locationId: "", sandbox: false },
  paypal: { enabled: false, email: "", paypalMeLink: "", requireProof: true },
  cashapp: { enabled: false, cashtag: "", requireProof: true },
  bankTransfer: { enabled: false, bankName: "", accountName: "", iban: "", sortCode: "", accountNumber: "", instructions: "", requireProof: true },
  cash: { enabled: false, instructions: "" },
};

/* ── Page Component ── */

export default function PaymentsPage() {
  const [user, setUserState] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [methods, setMethods] = useState<PaymentMethods>(DEFAULT_PAYMENT_METHODS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [requireDeposit, setRequireDeposit] = useState(false);

  useEffect(() => {
    // Load from localStorage for instant render, then fetch fresh from API
    const local = getUser();
    if (local) {
      setUserState(local);
      applyMethods(local.paymentMethods);
      setRequireDeposit(local.requireDeposit ?? false);
    }
    fetch("/api/user")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setUserState(data.user);
          setUser(data.user);
          applyMethods(data.user.paymentMethods);
          setRequireDeposit(data.user.requireDeposit ?? false);
        }
      })
      .catch(() => {});
  }, []);

  const applyMethods = (pm: any) => {
    setMethods({
      stripe: { ...DEFAULT_PAYMENT_METHODS.stripe!, ...pm?.stripe },
      paddle: { ...DEFAULT_PAYMENT_METHODS.paddle!, ...pm?.paddle },
      square: { ...DEFAULT_PAYMENT_METHODS.square!, ...pm?.square },
      paypal: { ...DEFAULT_PAYMENT_METHODS.paypal!, ...pm?.paypal },
      cashapp: { ...DEFAULT_PAYMENT_METHODS.cashapp!, ...pm?.cashapp },
      bankTransfer: { ...DEFAULT_PAYMENT_METHODS.bankTransfer!, ...pm?.bankTransfer },
      cash: { ...DEFAULT_PAYMENT_METHODS.cash!, ...pm?.cash },
    });
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethods: methods, requireDeposit }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.user || { ...user, paymentMethods: methods };
        setUser(updated);
        setUserState(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {}
    setSaving(false);
  };

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  /* ── Helper to determine connection status ── */

  const isStripeConnected = !!(methods.stripe?.publishableKey && methods.stripe?.secretKey);
  const isPaddleConnected = !!(methods.paddle?.apiKey && methods.paddle?.productId);
  const isSquareConnected = !!(methods.square?.accessToken && methods.square?.locationId);
  const isPaypalConnected = !!(methods.paypal?.email || methods.paypal?.paypalMeLink);
  const isCashappConnected = !!methods.cashapp?.cashtag;
  const isBankConnected = !!(
    methods.bankTransfer?.bankName &&
    (methods.bankTransfer?.iban || methods.bankTransfer?.accountNumber)
  );

  function getStatus(key: string): "connected" | "disabled" | "error" {
    const m = methods[key as keyof PaymentMethods];
    if (!m?.enabled) return "disabled";
    switch (key) {
      case "stripe": return isStripeConnected ? "connected" : "error";
      case "paddle": return isPaddleConnected ? "connected" : "error";
      case "square": return isSquareConnected ? "connected" : "error";
      case "paypal": return isPaypalConnected ? "connected" : "error";
      case "cashapp": return isCashappConnected ? "connected" : "error";
      case "bankTransfer": return isBankConnected ? "connected" : "error";
      case "cash": return "connected"; // cash is always "connected" when enabled
      default: return "disabled";
    }
  }

  if (!user) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading payment settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Configure how you collect deposits from customers</p>
      </div>

      {/* ── Deposit Settings ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Require Deposit</p>
              <p className="text-xs text-gray-400 mt-0.5">Customers must pay a deposit when booking</p>
            </div>
          </div>
          <Toggle
            value={requireDeposit}
            onChange={(v) => setRequireDeposit(v)}
          />
        </div>
        {requireDeposit && (
          <div className="px-6 pb-5 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              Set the deposit amount for each service in your <a href="/dashboard/packages" className="text-blue-600 font-semibold hover:underline">Packages</a> page.
            </p>
          </div>
        )}
      </div>

      {/* Warning when deposit is on but no payment methods enabled */}
      {requireDeposit && !methods.stripe?.enabled && !methods.paddle?.enabled && !methods.square?.enabled && !methods.paypal?.enabled && !methods.cashapp?.enabled && !methods.bankTransfer?.enabled && !methods.cash?.enabled && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-red-800">No payment methods enabled</p>
            <p className="text-xs text-red-600 mt-0.5">You have deposits turned on but no payment method is active. Enable at least one method below so customers know how to pay.</p>
          </div>
        </div>
      )}

      {/* ── 1. Stripe ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("stripe")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <StripeIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("stripe")} />
                <span className="text-sm font-bold text-gray-900">Stripe (Card Payments)</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Accept credit/debit card payments</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {methods.stripe?.enabled && <StatusBadge connected={isStripeConnected} />}
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.stripe?.enabled ?? false}
                onChange={(v) => setMethods({ ...methods, stripe: { ...methods.stripe!, enabled: v } })}
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "stripe" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "stripe" && methods.stripe?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Accept credit/debit card payments. Customers pay directly on your booking page. Funds go to your Stripe account.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Publishable Key</label>
              <input
                type="text"
                value={methods.stripe?.publishableKey ?? ""}
                onChange={(e) =>
                  setMethods({ ...methods, stripe: { ...methods.stripe!, publishableKey: e.target.value } })
                }
                placeholder="pk_live_..."
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Secret Key</label>
              <input
                type="password"
                value={methods.stripe?.secretKey ?? ""}
                onChange={(e) =>
                  setMethods({ ...methods, stripe: { ...methods.stripe!, secretKey: e.target.value } })
                }
                placeholder="sk_live_..."
                className={INPUT_CLASS}
              />
            </div>
            <p className="text-xs text-gray-400">
              Get your API keys from{" "}
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                dashboard.stripe.com/apikeys
              </a>
            </p>
          </div>
        )}
      </div>

      {/* ── Paddle ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("paddle")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <PaddleIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("paddle")} />
                <span className="text-sm font-bold text-gray-900">Paddle (Card Payments)</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Global card processing — Merchant of Record handles taxes</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {methods.paddle?.enabled && <StatusBadge connected={isPaddleConnected} />}
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.paddle?.enabled ?? false}
                onChange={(v) => setMethods({ ...methods, paddle: { ...methods.paddle!, enabled: v } })}
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "paddle" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "paddle" && methods.paddle?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Customers pay deposits via Paddle Checkout. You only need an API key and one &quot;Booking Deposit&quot; product in Paddle.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">API Key</label>
              <input
                type="password"
                value={methods.paddle?.apiKey ?? ""}
                onChange={(e) => setMethods({ ...methods, paddle: { ...methods.paddle!, apiKey: e.target.value } })}
                placeholder="pdl_live_apikey_..."
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Product ID</label>
              <input
                type="text"
                value={methods.paddle?.productId ?? ""}
                onChange={(e) => setMethods({ ...methods, paddle: { ...methods.paddle!, productId: e.target.value } })}
                placeholder="pro_..."
                className={INPUT_CLASS}
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Create one product in Paddle named &quot;Booking Deposit&quot; — we&apos;ll set the price per booking automatically.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-700">Sandbox Mode</p>
                <p className="text-xs text-gray-400 mt-0.5">Use Paddle sandbox for testing</p>
              </div>
              <Toggle
                value={methods.paddle?.sandbox ?? false}
                onChange={(v) => setMethods({ ...methods, paddle: { ...methods.paddle!, sandbox: v } })}
              />
            </div>
            <p className="text-xs text-gray-400">
              Get your API key at{" "}
              <a href="https://vendors.paddle.com/authentication-v2" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                vendors.paddle.com → Developer Tools → Authentication
              </a>
            </p>
          </div>
        )}
      </div>

      {/* ── Square ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("square")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <SquareIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("square")} />
                <span className="text-sm font-bold text-gray-900">Square (Card Payments)</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Popular with US service businesses — fast payouts</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {methods.square?.enabled && <StatusBadge connected={isSquareConnected} />}
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.square?.enabled ?? false}
                onChange={(v) => setMethods({ ...methods, square: { ...methods.square!, enabled: v } })}
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "square" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "square" && methods.square?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Customers pay deposits via Square&apos;s hosted checkout page. Funds go to your Square account.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Access Token</label>
              <input
                type="password"
                value={methods.square?.accessToken ?? ""}
                onChange={(e) => setMethods({ ...methods, square: { ...methods.square!, accessToken: e.target.value } })}
                placeholder="EAAAEx..."
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Location ID</label>
              <input
                type="text"
                value={methods.square?.locationId ?? ""}
                onChange={(e) => setMethods({ ...methods, square: { ...methods.square!, locationId: e.target.value } })}
                placeholder="L1ABCD..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-700">Sandbox Mode</p>
                <p className="text-xs text-gray-400 mt-0.5">Use Square sandbox for testing</p>
              </div>
              <Toggle
                value={methods.square?.sandbox ?? false}
                onChange={(v) => setMethods({ ...methods, square: { ...methods.square!, sandbox: v } })}
              />
            </div>
            <p className="text-xs text-gray-400">
              Get your access token at{" "}
              <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                developer.squareup.com → your app → Credentials
              </a>
            </p>
          </div>
        )}
      </div>

      {/* ── 2. PayPal ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("paypal")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <PayPalIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("paypal")} />
                <span className="text-sm font-bold text-gray-900">PayPal</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Redirect customers to PayPal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {methods.paypal?.enabled && <StatusBadge connected={isPaypalConnected} />}
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.paypal?.enabled ?? false}
                onChange={(v) => setMethods({ ...methods, paypal: { ...methods.paypal!, enabled: v } })}
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "paypal" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "paypal" && methods.paypal?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Customers are redirected to PayPal to complete their deposit payment.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">PayPal Email</label>
              <input
                type="email"
                value={methods.paypal?.email ?? ""}
                onChange={(e) =>
                  setMethods({ ...methods, paypal: { ...methods.paypal!, email: e.target.value } })
                }
                placeholder="you@example.com"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">PayPal.me Link</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <span className="px-4 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 flex-shrink-0">
                  paypal.me/
                </span>
                <input
                  type="text"
                  value={methods.paypal?.paypalMeLink ?? ""}
                  onChange={(e) =>
                    setMethods({ ...methods, paypal: { ...methods.paypal!, paypalMeLink: e.target.value } })
                  }
                  placeholder="yourusername"
                  className="flex-1 px-4 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-700">Require Proof of Payment</p>
                <p className="text-xs text-gray-400 mt-0.5">Customer must upload a screenshot after paying</p>
              </div>
              <Toggle
                value={methods.paypal?.requireProof ?? true}
                onChange={(v) => setMethods({ ...methods, paypal: { ...methods.paypal!, requireProof: v } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Cash App ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("cashapp")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CashAppIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("cashapp")} />
                <span className="text-sm font-bold text-gray-900">Cash App</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">US & UK only</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {methods.cashapp?.enabled && <StatusBadge connected={isCashappConnected} />}
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.cashapp?.enabled ?? false}
                onChange={(v) => setMethods({ ...methods, cashapp: { ...methods.cashapp!, enabled: v } })}
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "cashapp" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "cashapp" && methods.cashapp?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Customers can send deposits via Cash App. US & UK only.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Cashtag</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <span className="px-4 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 flex-shrink-0">
                  $
                </span>
                <input
                  type="text"
                  value={methods.cashapp?.cashtag ?? ""}
                  onChange={(e) =>
                    setMethods({ ...methods, cashapp: { ...methods.cashapp!, cashtag: e.target.value } })
                  }
                  placeholder="yourusername"
                  className="flex-1 px-4 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-700">Require Proof of Payment</p>
                <p className="text-xs text-gray-400 mt-0.5">Customer must upload a screenshot after paying</p>
              </div>
              <Toggle
                value={methods.cashapp?.requireProof ?? true}
                onChange={(v) => setMethods({ ...methods, cashapp: { ...methods.cashapp!, requireProof: v } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Bank Transfer ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("bankTransfer")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <BankIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("bankTransfer")} />
                <span className="text-sm font-bold text-gray-900">Bank Transfer</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Direct bank deposit</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {methods.bankTransfer?.enabled && <StatusBadge connected={isBankConnected} />}
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.bankTransfer?.enabled ?? false}
                onChange={(v) =>
                  setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, enabled: v } })
                }
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "bankTransfer" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "bankTransfer" && methods.bankTransfer?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Show your bank details so customers can transfer the deposit directly.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  value={methods.bankTransfer?.bankName ?? ""}
                  onChange={(e) =>
                    setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, bankName: e.target.value } })
                  }
                  placeholder="e.g. Chase, Barclays"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Account Name</label>
                <input
                  type="text"
                  value={methods.bankTransfer?.accountName ?? ""}
                  onChange={(e) =>
                    setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, accountName: e.target.value } })
                  }
                  placeholder="Account holder name"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">IBAN / Account Number</label>
                <input
                  type="text"
                  value={methods.bankTransfer?.iban ?? ""}
                  onChange={(e) =>
                    setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, iban: e.target.value } })
                  }
                  placeholder="IBAN or account number"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sort Code <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={methods.bankTransfer?.sortCode ?? ""}
                  onChange={(e) =>
                    setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, sortCode: e.target.value } })
                  }
                  placeholder="e.g. 12-34-56"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Instructions</label>
              <textarea
                rows={3}
                value={methods.bankTransfer?.instructions ?? ""}
                onChange={(e) =>
                  setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, instructions: e.target.value } })
                }
                placeholder="e.g. Please use your booking reference as the payment reference..."
                className={INPUT_CLASS + " resize-none"}
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-700">Require Proof of Payment</p>
                <p className="text-xs text-gray-400 mt-0.5">Customer must upload a screenshot after paying</p>
              </div>
              <Toggle
                value={methods.bankTransfer?.requireProof ?? true}
                onChange={(v) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, requireProof: v } })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Cash on Arrival ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleExpand("cash")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CashIcon />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2.5">
                <StatusDot status={getStatus("cash")} />
                <span className="text-sm font-bold text-gray-900">Cash on Arrival</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Customer pays in person</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                value={methods.cash?.enabled ?? false}
                onChange={(v) => setMethods({ ...methods, cash: { ...methods.cash!, enabled: v } })}
              />
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded === "cash" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded === "cash" && methods.cash?.enabled && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              No upfront deposit — customer pays in cash when you arrive. Not recommended as it increases no-shows.
            </p>

            {/* Amber warning */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86l-8.58 14.86A1 1 0 002.57 20h18.86a1 1 0 00.86-1.28L13.71 3.86a1 1 0 00-1.72 0z"
                />
              </svg>
              <p className="text-sm text-amber-800">
                Cash payments have no upfront commitment. Consider requiring at least a partial deposit to reduce no-shows.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Instructions</label>
              <textarea
                rows={3}
                value={methods.cash?.instructions ?? ""}
                onChange={(e) =>
                  setMethods({ ...methods, cash: { ...methods.cash!, instructions: e.target.value } })
                }
                placeholder="Please have exact change ready"
                className={INPUT_CLASS + " resize-none"}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-sm"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <SavedBadge />}
      </div>

      {/* ── Help ── */}
      <DashboardHelp page="settings" />
    </div>
  );
}
