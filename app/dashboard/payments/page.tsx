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
  paypal: { enabled: false, email: "", paypalMeLink: "" },
  cashapp: { enabled: false, cashtag: "" },
  bankTransfer: { enabled: false, bankName: "", accountName: "", iban: "", sortCode: "", accountNumber: "", instructions: "" },
  cash: { enabled: false, instructions: "" },
};

/* ── Page Component ── */

export default function PaymentsPage() {
  const [user, setUserState] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [methods, setMethods] = useState<PaymentMethods>(DEFAULT_PAYMENT_METHODS);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUserState(u);
      setMethods({
        stripe: { ...DEFAULT_PAYMENT_METHODS.stripe!, ...u.paymentMethods?.stripe },
        paypal: { ...DEFAULT_PAYMENT_METHODS.paypal!, ...u.paymentMethods?.paypal },
        cashapp: { ...DEFAULT_PAYMENT_METHODS.cashapp!, ...u.paymentMethods?.cashapp },
        bankTransfer: { ...DEFAULT_PAYMENT_METHODS.bankTransfer!, ...u.paymentMethods?.bankTransfer },
        cash: { ...DEFAULT_PAYMENT_METHODS.cash!, ...u.paymentMethods?.cash },
      });
    }
  }, []);

  const handleSave = () => {
    if (!user) return;
    const updated: User = {
      ...user,
      paymentMethods: methods,
    };
    setUser(updated);
    setUserState(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  /* ── Helper to determine connection status ── */

  const isStripeConnected = !!(methods.stripe?.publishableKey && methods.stripe?.secretKey);
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
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-sm"
        >
          Save Changes
        </button>
        {saved && <SavedBadge />}
      </div>

      {/* ── Help ── */}
      <DashboardHelp page="settings" />
    </div>
  );
}
