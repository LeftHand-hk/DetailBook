"use client";

import { useState, useEffect, useRef } from "react";
import type { Paddle } from "@paddle/paddle-js";

interface UserData {
  id: string;
  email: string;
  plan: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
}

interface CardInfo {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export default function BillingPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [nextBilledAt, setNextBilledAt] = useState<string | null>(null);
  const [updatingCard, setUpdatingCard] = useState(false);
  const [updateCardError, setUpdateCardError] = useState("");
  const pendingPlanRef = useRef<"starter" | "pro">("starter");
  const checkoutIntentRef = useRef<"subscribe" | "update-card">("subscribe");

  // Fetch user directly from API — not localStorage
  const fetchUser = async () => {
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // ignore
    } finally {
      setUserLoading(false);
    }
  };

  const fetchCard = async () => {
    try {
      const res = await fetch("/api/subscription/payment-method");
      if (!res.ok) return;
      const data = await res.json();
      setCard(data.card || null);
      setNextBilledAt(data.nextBilledAt || null);
    } catch {
      // ignore
    }
  };

  const handleUpdateCard = async () => {
    setUpdatingCard(true);
    setUpdateCardError("");
    try {
      const res = await fetch("/api/subscription/payment-method", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.transactionId) {
        setUpdateCardError(data.error || "Could not start card update.");
        return;
      }
      if (!paddle) {
        setUpdateCardError("Payment system loading, try again.");
        return;
      }
      checkoutIntentRef.current = "update-card";
      paddle.Checkout.open({ transactionId: data.transactionId });
    } catch {
      setUpdateCardError("Network error. Try again.");
    } finally {
      setUpdatingCard(false);
    }
  };

  useEffect(() => {
    fetchUser();

    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return;
    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "production",
        token,
        async eventCallback(event) {
          if (event.name === "checkout.completed") {
            if (checkoutIntentRef.current === "update-card") {
              await fetchCard();
            } else {
              await activatePlan(pendingPlanRef.current);
            }
          }
        },
      }).then((instance) => {
        if (instance) setPaddle(instance);
      });
    });
  }, []);

  useEffect(() => {
    if (user?.subscriptionStatus === "active") fetchCard();
  }, [user?.subscriptionStatus]);

  const activatePlan = async (plan: "starter" | "pro") => {
    setActivating(true);
    setActivateError("");
    try {
      const res = await fetch("/api/subscription/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok) {
        // Re-fetch user from API to get fresh data
        const userRes = await fetch("/api/user");
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }
        setActivateSuccess(true);
        setCheckoutOpened(false);
      } else {
        setActivateError(data.error || "Failed to activate plan. Please contact support.");
      }
    } catch {
      setActivateError("Network error. Please try again.");
    } finally {
      setActivating(false);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (res.ok) {
        setCancelDone(true);
        setTimeout(() => window.location.href = "/login", 3000);
      }
    } catch {
      alert("Something went wrong. Please contact support.");
    } finally {
      setCanceling(false);
      setShowCancelModal(false);
    }
  };

  const openCheckout = (plan: "starter" | "pro") => {
    if (!user) return;
    const priceId = plan === "pro"
      ? process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID
      : process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID;
    if (!priceId || !paddle) {
      alert("Payment system loading, please try again.");
      return;
    }
    pendingPlanRef.current = plan;
    checkoutIntentRef.current = "subscribe";
    setCheckoutOpened(true);
    setActivateError("");
    setActivateSuccess(false);
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: user.id },
    });
  };

  const isPro = user?.plan === "pro";
  const isSubscribed = user?.subscriptionStatus === "active";
  const trialDaysLeft = (() => {
    if (!user?.trialEndsAt) return null;
    const diff = new Date(user.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  })();

  const plans = [
    {
      id: "starter" as const,
      name: "Starter",
      price: 29,
      features: [
        "Online booking page",
        "Payment & deposit collection",
        "Calendar management",
        "Vehicle-type booking",
        "Before/after photos",
        "Email reminders",
        "Analytics dashboard",
      ],
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: 50,
      popular: true,
      features: [
        "Everything in Starter",
        "SMS reminders",
        "Multiple staff & calendars",
        "Google Calendar sync",
        "Advanced analytics",
        "Review request automation",
        "Priority support",
      ],
    },
  ];

  if (userLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading billing info...</div>
      </div>
    );
  }

  const brandColors: Record<string, { bg: string; accent: string }> = {
    visa: { bg: "from-blue-600 to-blue-800", accent: "text-blue-200" },
    mastercard: { bg: "from-orange-500 to-red-600", accent: "text-orange-100" },
    amex: { bg: "from-cyan-600 to-blue-700", accent: "text-cyan-100" },
    discover: { bg: "from-orange-400 to-orange-600", accent: "text-orange-100" },
    default: { bg: "from-slate-700 to-slate-900", accent: "text-slate-300" },
  };
  const brandKey = (card?.brand || "").toLowerCase();
  const cardTheme = brandColors[brandKey] || brandColors.default;
  const formatBrandLabel = (b: string | null) => {
    if (!b) return "Card";
    if (b.toLowerCase() === "amex") return "American Express";
    return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Billing</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your subscription, payment method, and plan.</p>
      </div>

      {/* Banner: payment completed → activate */}
      {checkoutOpened && !isSubscribed && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="font-semibold text-green-800 mb-1">Did you complete your payment?</p>
          <p className="text-sm text-green-700 mb-4">
            Click below to activate your <strong className="capitalize">{pendingPlanRef.current}</strong> plan immediately.
          </p>
          <button
            onClick={() => activatePlan(pendingPlanRef.current)}
            disabled={activating}
            className="bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {activating ? "Activating..." : "Yes, I paid — Activate My Plan"}
          </button>
          {activateError && <p className="mt-3 text-sm text-red-600 font-medium">{activateError}</p>}
        </div>
      )}

      {/* Banner: activate success */}
      {activateSuccess && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="font-semibold text-blue-800">
            Plan activated! You are now on the <span className="capitalize">{user?.plan}</span> plan.
          </p>
        </div>
      )}

      {/* === Current subscription summary === */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Current plan</div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-extrabold text-gray-900 capitalize">{user?.plan || "Starter"}</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                isSubscribed ? "bg-green-50 text-green-700 border border-green-200" :
                trialDaysLeft !== null ? "bg-amber-50 text-amber-700 border border-amber-200" :
                "bg-gray-100 text-gray-600 border border-gray-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSubscribed ? "bg-green-500" : trialDaysLeft !== null ? "bg-amber-500" : "bg-gray-400"
                }`} />
                {isSubscribed ? "Active" : trialDaysLeft !== null ? `Trial · ${trialDaysLeft}d left` : "Inactive"}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-gray-900">${isPro ? 50 : 29}</span>
              <span className="text-sm text-gray-500">/month</span>
            </div>
            {nextBilledAt && isSubscribed && (
              <p className="text-sm text-gray-500 mt-3">
                Next charge on <strong className="text-gray-700">{new Date(nextBilledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>
              </p>
            )}
            {!isSubscribed && trialDaysLeft !== null && (
              <p className="text-sm text-amber-700 mt-3">
                Subscribe before your trial ends to avoid losing access.
              </p>
            )}
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="text-xs text-gray-400">Billing email</div>
            <div className="text-sm font-medium text-gray-700">{user?.email}</div>
          </div>
        </div>
      </div>

      {/* === Payment method === */}
      <div className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Payment method</h2>
            <p className="text-sm text-gray-500">Card on file for your monthly subscription.</p>
          </div>
          {isSubscribed && card && (
            <button
              onClick={handleUpdateCard}
              disabled={updatingCard}
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {updatingCard ? "Loading..." : "Update card"}
            </button>
          )}
        </div>

        {!isSubscribed ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No payment method yet — subscribe below to add one.</p>
          </div>
        ) : card ? (
          <div className="grid sm:grid-cols-[auto,1fr] gap-5 items-center bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            {/* Card visualization */}
            <div className={`w-full sm:w-72 h-44 rounded-2xl bg-gradient-to-br ${cardTheme.bg} text-white p-5 flex flex-col justify-between shadow-md relative overflow-hidden`}>
              <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
              <div className="relative flex items-start justify-between">
                <div className="w-10 h-7 rounded bg-yellow-300/80" />
                <span className="text-xs font-bold uppercase tracking-wider">{formatBrandLabel(card.brand)}</span>
              </div>
              <div className="relative">
                <div className="font-mono text-lg tracking-widest">•••• •••• •••• {card.last4 || "••••"}</div>
                <div className={`flex justify-between mt-3 text-[10px] uppercase tracking-wider ${cardTheme.accent}`}>
                  <div>
                    <div>Expires</div>
                    <div className="text-white text-sm font-mono mt-0.5">
                      {card.expMonth && card.expYear
                        ? `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`
                        : "••/••"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Right side details */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Card</div>
                <div className="text-base font-semibold text-gray-900">
                  {formatBrandLabel(card.brand)} ending in {card.last4 || "—"}
                </div>
              </div>
              {card.expMonth && card.expYear && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Expires</div>
                  <div className="text-sm text-gray-700">
                    {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Securely stored by Paddle
              </div>
              <button
                onClick={handleUpdateCard}
                disabled={updatingCard}
                className="sm:hidden mt-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {updatingCard ? "Loading..." : "Update card"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5 13l4 4L19 7M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Card details syncing…</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Your subscription is active but we haven't received card details from Paddle yet. This usually takes a minute after the first charge.
              </p>
              <button
                onClick={fetchCard}
                className="mt-3 text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
        {updateCardError && <p className="mt-3 text-sm text-red-600">{updateCardError}</p>}
      </div>

      {/* === Plans === */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Available plans</h2>
          <p className="text-sm text-gray-500">Choose the plan that fits your business.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isCurrent = user?.plan === plan.id;
            const isActive = isCurrent && isSubscribed;
            const isPopular = plan.popular;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col bg-white transition-shadow ${
                  isActive ? "border-blue-500 ring-2 ring-blue-100 shadow-md" :
                  isPopular ? "border-gray-200 shadow-sm hover:shadow-md" :
                  "border-gray-200 hover:shadow-sm"
                }`}
              >
                {isPopular && !isActive && (
                  <span className="absolute -top-2.5 right-5 text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2.5 py-1 rounded-full">
                    Recommended
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-extrabold text-xl text-gray-900">{plan.name}</h3>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Your plan
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-gray-900">${plan.price}</span>
                    <span className="text-sm text-gray-400">/mo</span>
                  </div>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <svg className="w-4 h-4 flex-shrink-0 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <div className="w-full text-center font-bold py-3 rounded-xl text-sm bg-gray-100 text-gray-500">
                    Current plan
                  </div>
                ) : user?.plan === "pro" && plan.id === "starter" ? (
                  <div className="w-full text-center text-gray-400 text-sm py-3 border border-gray-100 rounded-xl">
                    Downgrade not available
                  </div>
                ) : (
                  <button
                    onClick={() => openCheckout(plan.id)}
                    className={`w-full font-bold py-3 rounded-xl text-sm transition-colors ${
                      isPopular
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {`Subscribe to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === FAQ / notes === */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
        <h3 className="font-bold text-gray-900 mb-3">Billing details</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Subscriptions are billed monthly. Cancel any time from this page.
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Payments are handled securely by Paddle, our PCI-compliant payment processor.
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Questions? Email <a href="mailto:info@detailbookapp.com" className="text-blue-600 hover:underline font-medium">info@detailbookapp.com</a>
          </li>
        </ul>
      </div>

      {/* === Danger zone — cancel === */}
      {isSubscribed && (
        <div className="bg-white rounded-2xl border border-red-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Cancel subscription</h3>
              <p className="text-sm text-gray-500">
                Your account will be disabled immediately. Data is preserved — resubscribe to restore access.
              </p>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="self-start sm:self-auto px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0"
            >
              Cancel subscription
            </button>
          </div>
        </div>
      )}

      {/* Cancel done message */}
      {cancelDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4 shadow-xl">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Subscription Canceled</h3>
            <p className="text-sm text-gray-500">Your account has been disabled. Redirecting to login...</p>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Cancel Subscription?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Your account will be <strong>disabled</strong> immediately. You will be logged out and will need to resubscribe to regain access.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
              >
                Keep Plan
              </button>
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {canceling ? "Canceling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
