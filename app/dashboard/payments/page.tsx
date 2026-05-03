"use client";

import { useState, useEffect, useRef } from "react";
import { getUser, setUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

const INPUT_CLASS =
  "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all placeholder-gray-300";

function Toggle({ value, onChange, size = "md" }: { value: boolean; onChange: (v: boolean) => void; size?: "sm" | "md" }) {
  const dim = size === "sm" ? { box: "h-5 w-9", knob: "h-3.5 w-3.5", on: "translate-x-5", off: "translate-x-1" } : { box: "h-6 w-11", knob: "h-4 w-4", on: "translate-x-6", off: "translate-x-1" };
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex ${dim.box} items-center rounded-full transition-colors duration-200 ${value ? "bg-blue-600" : "bg-gray-200"}`}
    >
      <span className={`inline-block ${dim.knob} transform rounded-full bg-white shadow transition-transform duration-200 ${value ? dim.on : dim.off}`} />
    </button>
  );
}

/* ── Brand-coloured icons ── */

function StripeIcon() {
  return <div className="w-9 h-9 rounded-xl bg-[#635BFF] flex items-center justify-center text-white font-extrabold text-sm">S</div>;
}
function SquareIcon() {
  return (
    <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
      <div className="w-4 h-4 rounded-sm bg-white" />
    </div>
  );
}
function PayPalIcon() {
  return <div className="w-9 h-9 rounded-xl bg-[#003087] flex items-center justify-center text-white font-extrabold text-xs italic">PP</div>;
}
function CashAppIcon() {
  return <div className="w-9 h-9 rounded-xl bg-[#00C244] flex items-center justify-center text-white font-extrabold text-base">$</div>;
}
function BankIcon() {
  return (
    <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
      </svg>
    </div>
  );
}
function CashIcon() {
  return (
    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth={2} />
        <circle cx="12" cy="12" r="3" strokeWidth={2} />
      </svg>
    </div>
  );
}

/* ── Default payment methods state ── */

type PaymentMethods = NonNullable<User["paymentMethods"]>;

const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  stripe: { enabled: false, publishableKey: "", secretKey: "", connected: false },
  square: { enabled: false, applicationId: "", accessToken: "", locationId: "", sandbox: false },
  paypal: { enabled: false, email: "", paypalMeLink: "", requireProof: true },
  cashapp: { enabled: false, cashtag: "", requireProof: true },
  bankTransfer: { enabled: false, bankName: "", accountName: "", iban: "", sortCode: "", accountNumber: "", instructions: "", requireProof: true },
  cash: { enabled: false, instructions: "" },
};

/* ── Method Card ──
   Body is always shown when the method is enabled — no collapse, so the
   business actually sees the fields they need to fill in. */

interface MethodCardProps {
  icon: React.ReactNode;
  name: string;
  tagline: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  incomplete?: boolean;
  children: React.ReactNode;
}

function MethodCard({ icon, name, tagline, enabled, onToggle, incomplete, children }: MethodCardProps) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all ${enabled ? "border-gray-200 shadow-sm" : "border-gray-100"}`}>
      <div className="px-5 py-4 flex items-center gap-4">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{tagline}</p>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      {enabled && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-gray-50/40 space-y-4">
          {incomplete && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Fill in the fields below</strong> — until you do, customers can&apos;t use this method.
              </p>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Page Component ── */

export default function PaymentsPage() {
  const [user, setUserState] = useState<User | null>(null);
  const [methods, setMethods] = useState<PaymentMethods>(DEFAULT_PAYMENT_METHODS);
  const [requireDeposit, setRequireDeposit] = useState(false);
  const hydratedRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
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
      .catch(() => {})
      .finally(() => {
        setTimeout(() => { hydratedRef.current = true; }, 0);
      });
  }, []);

  const applyMethods = (pm: any) => {
    setMethods({
      stripe: { ...DEFAULT_PAYMENT_METHODS.stripe!, ...pm?.stripe },
      square: { ...DEFAULT_PAYMENT_METHODS.square!, ...pm?.square },
      paypal: { ...DEFAULT_PAYMENT_METHODS.paypal!, ...pm?.paypal },
      cashapp: { ...DEFAULT_PAYMENT_METHODS.cashapp!, ...pm?.cashapp },
      bankTransfer: { ...DEFAULT_PAYMENT_METHODS.bankTransfer!, ...pm?.bankTransfer },
      cash: { ...DEFAULT_PAYMENT_METHODS.cash!, ...pm?.cash },
    });
  };

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
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {}
    setSaving(false);
  };

  useEffect(() => {
    if (!hydratedRef.current || !user) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { handleSave(); }, 800);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods, requireDeposit]);

  const stripeIncomplete = !!(methods.stripe?.enabled && !(methods.stripe?.publishableKey && methods.stripe?.secretKey));
  const squareIncomplete = !!(methods.square?.enabled && !(methods.square?.applicationId && methods.square?.accessToken && methods.square?.locationId));
  const paypalIncomplete = !!(methods.paypal?.enabled && !(methods.paypal?.email || methods.paypal?.paypalMeLink));
  const cashappIncomplete = !!(methods.cashapp?.enabled && !methods.cashapp?.cashtag);
  const bankIncomplete = !!(methods.bankTransfer?.enabled && !(methods.bankTransfer?.bankName && (methods.bankTransfer?.iban || methods.bankTransfer?.accountNumber)));

  const anyEnabled = !!(methods.stripe?.enabled || methods.square?.enabled || methods.paypal?.enabled || methods.cashapp?.enabled || methods.bankTransfer?.enabled || methods.cash?.enabled);

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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Choose how customers pay deposits when they book.</p>
        </div>
        <div className="text-xs flex items-center gap-2 mt-2">
          {saving ? (
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              Saved
            </span>
          ) : (
            <span className="text-gray-400">Auto-saves as you edit</span>
          )}
        </div>
      </div>

      {/* Require deposit row */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900">Require deposit at booking</p>
          <p className="text-xs text-gray-500 mt-0.5">Reduces no-shows. Set the amount per service in <a href="/dashboard/packages" className="text-blue-600 font-semibold hover:underline">Packages</a>.</p>
        </div>
        <Toggle value={requireDeposit} onChange={(v) => setRequireDeposit(v)} />
      </div>

      {requireDeposit && !anyEnabled && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-800 leading-relaxed">Deposits are on but no payment method is enabled — turn one on below.</p>
        </div>
      )}

      {/* Methods grid — 2 cards per row on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {/* Stripe */}
        <MethodCard
          icon={<StripeIcon />}
          name="Stripe — Card payments"
          tagline="Customer pays by card on your booking page. Booking auto-confirms."
          enabled={methods.stripe?.enabled ?? false}
          onToggle={(v) => setMethods({ ...methods, stripe: { ...methods.stripe!, enabled: v } })}
          incomplete={stripeIncomplete}
        >
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Publishable key</label>
            <input
              type="text"
              value={methods.stripe?.publishableKey ?? ""}
              onChange={(e) => setMethods({ ...methods, stripe: { ...methods.stripe!, publishableKey: e.target.value } })}
              placeholder="pk_live_..."
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Secret key</label>
            <input
              type="password"
              value={methods.stripe?.secretKey ?? ""}
              onChange={(e) => setMethods({ ...methods, stripe: { ...methods.stripe!, secretKey: e.target.value } })}
              placeholder="sk_live_..."
              className={INPUT_CLASS}
            />
          </div>
          <p className="text-xs text-gray-500">
            Get keys at{" "}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline">dashboard.stripe.com/apikeys</a>
          </p>
        </MethodCard>

        {/* Square */}
        <MethodCard
          icon={<SquareIcon />}
          name="Square — Card payments"
          tagline="Embedded card form, no redirect. Booking auto-confirms."
          enabled={methods.square?.enabled ?? false}
          onToggle={(v) => setMethods({ ...methods, square: { ...methods.square!, enabled: v } })}
          incomplete={squareIncomplete}
        >
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Application ID</label>
            <input
              type="text"
              value={methods.square?.applicationId ?? ""}
              onChange={(e) => setMethods({ ...methods, square: { ...methods.square!, applicationId: e.target.value } })}
              placeholder="sq0idp-... or sandbox-sq0idb-..."
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Access token</label>
            <input
              type="password"
              value={methods.square?.accessToken ?? ""}
              onChange={(e) => setMethods({ ...methods, square: { ...methods.square!, accessToken: e.target.value } })}
              placeholder="EAAAEx..."
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Location ID</label>
            <input
              type="text"
              value={methods.square?.locationId ?? ""}
              onChange={(e) => setMethods({ ...methods, square: { ...methods.square!, locationId: e.target.value } })}
              placeholder="L1ABCD..."
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Sandbox mode</p>
              <p className="text-xs text-gray-500 mt-0.5">Use Square&apos;s test environment</p>
            </div>
            <Toggle
              size="sm"
              value={methods.square?.sandbox ?? false}
              onChange={(v) => setMethods({ ...methods, square: { ...methods.square!, sandbox: v } })}
            />
          </div>
          <p className="text-xs text-gray-500">
            Get all three at{" "}
            <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline">developer.squareup.com</a>{" "}→ your app → Credentials.
          </p>
        </MethodCard>

        {/* PayPal */}
        <MethodCard
          icon={<PayPalIcon />}
          name="PayPal"
          tagline="Customer pays you on PayPal, then uploads proof."
          enabled={methods.paypal?.enabled ?? false}
          onToggle={(v) => setMethods({ ...methods, paypal: { ...methods.paypal!, enabled: v } })}
          incomplete={paypalIncomplete}
        >
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">PayPal email</label>
            <input
              type="email"
              value={methods.paypal?.email ?? ""}
              onChange={(e) => setMethods({ ...methods, paypal: { ...methods.paypal!, email: e.target.value } })}
              placeholder="you@example.com"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">PayPal.me link</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all bg-white">
              <span className="px-4 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200">paypal.me/</span>
              <input
                type="text"
                value={methods.paypal?.paypalMeLink ?? ""}
                onChange={(e) => setMethods({ ...methods, paypal: { ...methods.paypal!, paypalMeLink: e.target.value } })}
                placeholder="yourusername"
                className="flex-1 px-4 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300"
              />
            </div>
          </div>
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Require proof of payment</p>
              <p className="text-xs text-gray-500 mt-0.5">Customer uploads a screenshot</p>
            </div>
            <Toggle
              size="sm"
              value={methods.paypal?.requireProof ?? true}
              onChange={(v) => setMethods({ ...methods, paypal: { ...methods.paypal!, requireProof: v } })}
            />
          </div>
        </MethodCard>

        {/* Cash App */}
        <MethodCard
          icon={<CashAppIcon />}
          name="Cash App"
          tagline="Customer sends to your $cashtag, then uploads proof."
          enabled={methods.cashapp?.enabled ?? false}
          onToggle={(v) => setMethods({ ...methods, cashapp: { ...methods.cashapp!, enabled: v } })}
          incomplete={cashappIncomplete}
        >
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Cashtag</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all bg-white">
              <span className="px-4 py-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200">$</span>
              <input
                type="text"
                value={methods.cashapp?.cashtag ?? ""}
                onChange={(e) => setMethods({ ...methods, cashapp: { ...methods.cashapp!, cashtag: e.target.value } })}
                placeholder="yourusername"
                className="flex-1 px-4 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300"
              />
            </div>
          </div>
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Require proof of payment</p>
              <p className="text-xs text-gray-500 mt-0.5">Customer uploads a screenshot</p>
            </div>
            <Toggle
              size="sm"
              value={methods.cashapp?.requireProof ?? true}
              onChange={(v) => setMethods({ ...methods, cashapp: { ...methods.cashapp!, requireProof: v } })}
            />
          </div>
        </MethodCard>

        {/* Bank transfer */}
        <MethodCard
          icon={<BankIcon />}
          name="Bank transfer"
          tagline="Customer transfers directly to your bank account."
          enabled={methods.bankTransfer?.enabled ?? false}
          onToggle={(v) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, enabled: v } })}
          incomplete={bankIncomplete}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Bank name</label>
              <input
                type="text"
                value={methods.bankTransfer?.bankName ?? ""}
                onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, bankName: e.target.value } })}
                placeholder="e.g. Chase, Barclays"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Account name</label>
              <input
                type="text"
                value={methods.bankTransfer?.accountName ?? ""}
                onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, accountName: e.target.value } })}
                placeholder="Account holder"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">IBAN / Account #</label>
              <input
                type="text"
                value={methods.bankTransfer?.iban ?? ""}
                onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, iban: e.target.value } })}
                placeholder="IBAN or account number"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Sort code <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <input
                type="text"
                value={methods.bankTransfer?.sortCode ?? ""}
                onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, sortCode: e.target.value } })}
                placeholder="12-34-56"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Custom instructions</label>
            <textarea
              rows={3}
              value={methods.bankTransfer?.instructions ?? ""}
              onChange={(e) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, instructions: e.target.value } })}
              placeholder="e.g. Use your booking reference as the payment reference..."
              className={INPUT_CLASS + " resize-none"}
            />
          </div>
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Require proof of payment</p>
              <p className="text-xs text-gray-500 mt-0.5">Customer uploads a screenshot</p>
            </div>
            <Toggle
              size="sm"
              value={methods.bankTransfer?.requireProof ?? true}
              onChange={(v) => setMethods({ ...methods, bankTransfer: { ...methods.bankTransfer!, requireProof: v } })}
            />
          </div>
        </MethodCard>

        {/* Cash on arrival */}
        <MethodCard
          icon={<CashIcon />}
          name="Cash on arrival"
          tagline="No deposit — customer pays in cash at the appointment."
          enabled={methods.cash?.enabled ?? false}
          onToggle={(v) => setMethods({ ...methods, cash: { ...methods.cash!, enabled: v } })}
        >
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.58 14.86A1 1 0 002.57 20h18.86a1 1 0 00.86-1.28L13.71 3.86a1 1 0 00-1.72 0z" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              Cash bookings have <strong>no upfront commitment</strong>. Pair it with a card method so customers can lock in the slot with a deposit.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Instructions for customer</label>
            <textarea
              rows={3}
              value={methods.cash?.instructions ?? ""}
              onChange={(e) => setMethods({ ...methods, cash: { ...methods.cash!, instructions: e.target.value } })}
              placeholder="e.g. Please have exact change ready"
              className={INPUT_CLASS + " resize-none"}
            />
          </div>
        </MethodCard>
      </div>

      <DashboardHelp page="payments" />
    </div>
  );
}
