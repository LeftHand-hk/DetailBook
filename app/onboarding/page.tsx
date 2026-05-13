"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Paddle } from "@paddle/paddle-js";
import { getUser, setUser, isLoggedIn, syncFromServer } from "@/lib/storage";
import type { User } from "@/types";
import Logo from "@/components/Logo";

// Onboarding is a 3-step flow. New signups always start on Starter
// (Pro upgrade is in /dashboard/billing). Card capture in step 1
// creates a Paddle subscription with Paddle's native 7-day trial —
// nothing is charged until day 8 unless the user cancels.
//
//   Step 0 — Business Details (operation type first, then fields)
//   Step 1 — Add Card to activate the 7-day trial (Paddle Checkout)
//   Step 2 — "All Set!" → nudges into package creation
const STEPS = [
  { id: 0, label: "Business Details", icon: "🏢" },
  { id: 1, label: "Add Card",         icon: "💳" },
  { id: 2, label: "All Set",          icon: "🚀" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

type ServiceType = "mobile" | "shop" | "both";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [user, setUserState] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [paddleLoading, setPaddleLoading] = useState(true);
  const [openingCheckout, setOpeningCheckout] = useState(false);
  const [waitingForCard, setWaitingForCard] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const checkoutOpenedAt = useRef<number | null>(null);

  // Fire CompleteRegistration once when the user lands here straight
  // from /signup. sessionStorage flag is set by the signup form (URL
  // query-param version would have forced a history.replaceState which
  // fbevents.js was double-counting as a PageView).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    let justSignedUp = false;
    try {
      justSignedUp = sessionStorage.getItem("dB_justSignedUp") === "1";
      if (justSignedUp) sessionStorage.removeItem("dB_justSignedUp");
    } catch { /* private mode */ }
    if (!justSignedUp) return;

    window.fbq("track", "CompleteRegistration", {
      content_name: "DetailBook Trial Signup",
      status: true,
      value: 0,
      currency: "USD",
    });
  }, []);

  // Step 0 — business details. serviceType drives which fields show.
  const [bizForm, setBizForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "FL",
    zip: "",
    serviceArea: "",
    serviceType: "mobile" as ServiceType,
  });

  // Prefill from local user data first (fast), then fall back to a
  // server sync if the localStorage copy is missing businessName —
  // covers the case where the signup form's syncFromServer failed
  // mid-redirect and left the cache empty.
  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }

    const applyUser = (u: User | null) => {
      if (!u) return;
      setUserState(u);
      setBizForm((prev) => ({
        ...prev,
        businessName: u.businessName || prev.businessName,
        email: u.email || prev.email,
        phone: u.phone || prev.phone,
        city: u.city || prev.city,
        serviceType: ((u as any).serviceType as ServiceType) || prev.serviceType,
      }));
    };

    const cached = getUser();
    applyUser(cached);

    if (!cached?.businessName) {
      // localStorage was empty — pull from server before the form mounts
      // its empty state.
      syncFromServer()
        .then(() => applyUser(getUser()))
        .catch(() => { /* form falls back to manual entry */ });
    }
  }, [router]);

  // ── Step 0 submit ──────────────────────────────────────────────────────
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const slug = bizForm.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // For mobile-only operators we still send the serviceArea (free
    // text) but skip the structured street/zip fields. Shops send all
    // four. "Both" sends both sets — address fields for the shop, the
    // service-area text for the mobile zone.
    const isMobileOnly = bizForm.serviceType === "mobile";
    const fullAddress = isMobileOnly
      ? bizForm.serviceArea.trim()
      : `${bizForm.address}, ${bizForm.city}, ${bizForm.state} ${bizForm.zip}`.trim();

    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: bizForm.businessName,
          phone: bizForm.phone,
          city: isMobileOnly ? bizForm.city : `${bizForm.city}, ${bizForm.state}`,
          address: fullAddress,
          serviceType: bizForm.serviceType,
          serviceAreas: bizForm.serviceArea
            ? [bizForm.serviceArea.trim()]
            : undefined,
          slug,
        }),
      });
      if (res.ok) {
        await syncFromServer();
        const u = getUser();
        if (u) setUserState(u);
      } else if (user) {
        const updated = { ...user, ...bizForm, address: fullAddress, slug };
        setUser(updated); setUserState(updated);
      }
    } catch {
      if (user) {
        const slug2 = bizForm.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const updated = { ...user, ...bizForm, address: fullAddress, slug: slug2 };
        setUser(updated); setUserState(updated);
      }
    }

    setSaving(false);
    setStep(1);
  };

  // ── Paddle Checkout init ───────────────────────────────────────────────
  // We initialise lazily on mount (regardless of step) so by the time the
  // user reaches step 1 the SDK is already warmed up. checkout.completed
  // is the only signal we trust for advancing to step 2 — the webhook
  // will land server-side, but client-advance shouldn't wait on that.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) { setPaddleLoading(false); return; }
    let cancelled = false;
    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "production",
        token,
        eventCallback(event) {
          if (event.name === "checkout.completed") {
            // Mark waiting so the UI shows "saving card…" until the
            // webhook lands and we can re-sync the user.
            setWaitingForCard(true);
            // Server-side sync to pick up the new paddleSubscriptionId
            // ASAP, then advance to step 2.
            (async () => {
              for (let attempt = 0; attempt < 10; attempt++) {
                try {
                  await fetch("/api/subscription/sync", { method: "POST" });
                  await syncFromServer();
                } catch { /* ignore */ }
                const u = getUser();
                if (u && ((u as any).paddleSubscriptionId || (u as any).subscriptionStatus === "trialing")) {
                  if (!cancelled) {
                    setUserState(u);
                    setWaitingForCard(false);
                    setStep(2);
                  }
                  return;
                }
                await new Promise((r) => setTimeout(r, 1500));
              }
              // Webhook didn't land in time — still advance so the user
              // isn't stuck on a spinner. The dashboard will pick up the
              // sub once the webhook fires (or via background sync).
              if (!cancelled) {
                setWaitingForCard(false);
                setStep(2);
              }
            })();
          } else if (event.name === "checkout.error") {
            const ev: any = event;
            const detail =
              ev?.data?.error?.detail ||
              ev?.error?.detail ||
              ev?.data?.message ||
              "Could not load checkout. Try again or contact support.";
            setPaymentError(`Paddle: ${detail}`);
            setOpeningCheckout(false);
          } else if (event.name === "checkout.closed") {
            // User dismissed without paying. Re-enable the button.
            setOpeningCheckout(false);
          }
        },
      }).then((instance) => {
        if (cancelled) return;
        if (instance) setPaddle(instance);
        setPaddleLoading(false);
      }).catch((err) => {
        console.error("[Paddle] initializePaddle threw:", err);
        if (!cancelled) setPaddleLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, []);

  const handleOpenCheckout = () => {
    setPaymentError("");
    const priceId = process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID;
    if (!paddle) {
      setPaymentError("Payment system still loading — try again in a second.");
      return;
    }
    if (!priceId) {
      setPaymentError("Payment is not configured. Please contact support.");
      return;
    }
    if (!user) {
      setPaymentError("Account not loaded. Refresh and try again.");
      return;
    }
    setOpeningCheckout(true);
    checkoutOpenedAt.current = Date.now();
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: user.id, source: "onboarding" },
    });
  };

  const bookingUrl = user
    ? `${typeof window !== "undefined" ? window.location.origin : "https://detailbookapp.com"}/book/${user.slug}`
    : "";

  const handleCopy = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Trial length: derived from the real trialEndsAt so promo codes that
  // extend it (e.g. 1-month, 3-month) show the correct number on the
  // "Account created!" page. Default to 7 days for the standard path.
  const trialDays = (() => {
    if (!user?.trialEndsAt) return 7;
    const diff = new Date(user.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 7;
  })();

  const showShopFields = bizForm.serviceType === "shop" || bizForm.serviceType === "both";
  const showMobileFields = bizForm.serviceType === "mobile" || bizForm.serviceType === "both";

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* Header — no "Skip setup" anymore. A small progress chip keeps
          the user oriented without offering an escape hatch. */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Logo size="sm" href="/" darkText />
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-700">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-2xl">

          {/* Progress stepper */}
          <div className="mb-8">
            <div className="flex items-center">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-sm ${
                      i < step
                        ? "bg-green-500 text-white shadow-green-200"
                        : i === step
                        ? "bg-blue-600 text-white shadow-blue-200"
                        : "bg-white border-2 border-gray-200 text-gray-400"
                    }`}>
                      {i < step ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-base">{s.icon}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold hidden sm:block text-center ${
                      i === step ? "text-blue-600" : i < step ? "text-green-600" : "text-gray-400"
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300 ${i < step ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── STEP 0: Business Details ─────────────────────────────────── */}
          {step === 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-xl">🏢</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Your Business Details</h1>
                    <p className="text-gray-400 text-sm">This will appear on your public booking page.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleStep1} className="px-8 py-7 space-y-5">
                {/* Operation type FIRST — drives the fields below. */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    How do you operate? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: "mobile", icon: "🚗", label: "Mobile Service", desc: "I go to customers" },
                      { value: "shop",   icon: "🏪", label: "Shop / Location", desc: "Customers come to me" },
                      { value: "both",   icon: "⚡", label: "Both",            desc: "Shop + mobile" },
                    ] as const).map(({ value, icon, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBizForm({ ...bizForm, serviceType: value })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                          bizForm.serviceType === value
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-gray-50 hover:border-blue-300"
                        }`}
                      >
                        <span className="text-2xl">{icon}</span>
                        <span className={`text-xs font-bold ${bizForm.serviceType === value ? "text-blue-700" : "text-gray-700"}`}>{label}</span>
                        <span className="text-[10px] text-gray-400">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Business Name (pre-filled) + Phone — always required */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bizForm.businessName}
                      onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
                      placeholder="e.g. Mike's Mobile Detailing"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={bizForm.phone}
                      onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Shop / Both: structured address fields */}
                {showShopFields && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Street Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={showShopFields}
                        value={bizForm.address}
                        onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                        placeholder="123 Main Street"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={showShopFields}
                          value={bizForm.city}
                          onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                          placeholder="Miami"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          State <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={bizForm.state}
                          onChange={(e) => setBizForm({ ...bizForm, state: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                        >
                          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          ZIP Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={showShopFields}
                          value={bizForm.zip}
                          onChange={(e) => setBizForm({ ...bizForm, zip: e.target.value })}
                          placeholder="33101"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Mobile / Both: free-text service area + optional city/state
                    so the booking page can still show a friendly location label. */}
                {showMobileFields && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Service Area <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={showMobileFields}
                        value={bizForm.serviceArea}
                        onChange={(e) => setBizForm({ ...bizForm, serviceArea: e.target.value })}
                        placeholder="e.g. Miami & Surrounding Areas"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5">Where you&apos;ll travel to. Shown to customers on your booking page.</p>
                    </div>

                    {bizForm.serviceType === "mobile" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            City <span className="text-gray-400 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={bizForm.city}
                            onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                            placeholder="Miami"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            State <span className="text-gray-400 font-normal">(optional)</span>
                          </label>
                          <select
                            value={bizForm.state}
                            onChange={(e) => setBizForm({ ...bizForm, state: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                          >
                            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200"
                  >
                    {saving ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                    ) : (
                      <>Continue <span>→</span></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STEP 1: Add card to activate Paddle's 7-day trial ────────── */}
          {step === 1 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-xl">💳</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Add Card to Activate Trial</h1>
                    <p className="text-gray-400 text-sm">7 days free. Cancel anytime. No charge until day 8.</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-7 space-y-5">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-sm font-bold text-blue-900">Starter Plan</span>
                    <div>
                      <span className="text-2xl font-black text-blue-900">$29</span>
                      <span className="text-sm text-blue-700">/month</span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-blue-900">
                    {[
                      "Today: $0 — your card is saved, nothing is charged",
                      "Day 8: $29 charged automatically if you keep going",
                      "Cancel anytime in Settings → Billing before day 8",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {paymentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                    {paymentError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleOpenCheckout}
                  disabled={openingCheckout || paddleLoading || waitingForCard}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200"
                >
                  {waitingForCard ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving card…</>
                  ) : openingCheckout ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Opening secure checkout…</>
                  ) : paddleLoading ? (
                    <>Loading…</>
                  ) : (
                    <>Add Card & Start 7-Day Trial <span>→</span></>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Card processed securely by Paddle · PCI-DSS compliant
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Account created — push toward package creation ──── */}
          {step === 2 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-10 pb-6 text-center">
                {/* Animated checkmark */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                <h1 className="text-2xl font-black text-gray-900 mb-2">
                  You&apos;re all set!
                </h1>
                <p className="text-gray-500 text-sm mb-4 max-w-sm mx-auto leading-relaxed">
                  Your 7-day trial is active and your card is saved. Now let&apos;s add your first service package so you can start taking bookings.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-100 text-blue-700">
                    ⚡ Trial active · {trialDays} days
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                    Card saved · cancel anytime
                  </span>
                </div>
              </div>

              <div className="px-8 pb-8">
                {/* Booking URL — informational only. We removed the
                    "Preview Your Booking Page" CTA because the page is
                    still empty at this point, and previewing it confused
                    early users into thinking something was broken. */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-5">
                  <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider">Your Booking Link (ready once you add a package)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-blue-600 font-mono truncate">{bookingUrl}</code>
                    <button
                      onClick={handleCopy}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                        copied
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                      }`}
                    >
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Primary CTA → straight to package creation. ?setup=services
                    tells /dashboard/packages to open the "new package" modal
                    immediately so the user lands in the flow they're being
                    nudged into. */}
                <div className="space-y-3">
                  <Link
                    href="/dashboard/packages?setup=services"
                    onClick={() => {
                      try { sessionStorage.setItem("dB_showTour", "1"); } catch { /* private mode */ }
                    }}
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-lg shadow-blue-200"
                  >
                    Create Your First Package
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => {
                      try { sessionStorage.setItem("dB_showTour", "1"); } catch { /* private mode */ }
                    }}
                    className="flex items-center justify-center gap-2 w-full text-gray-500 hover:text-gray-700 font-semibold py-2 rounded-xl transition-colors text-xs"
                  >
                    Skip for now — go to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-5 px-4 bg-white">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="xs" href="/" darkText />
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} DetailBook · The booking platform for auto detailers
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-gray-600 transition-colors">Terms</a>
            <a href="/refund" className="hover:text-gray-600 transition-colors">Refund</a>
            <a href="/dashboard" className="hover:text-gray-600 transition-colors">Dashboard</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
