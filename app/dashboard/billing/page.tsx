"use client";

import { useState, useEffect } from "react";
import { getUser } from "@/lib/storage";
import type { User } from "@/types";
import type { Paddle } from "@paddle/paddle-js";

export default function BillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);

    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return;
    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "production",
        token,
        async eventCallback(event) {
          if (event.name === "checkout.completed") {
            // Extract price ID from completed checkout
            const items = (event.data as any)?.items || [];
            const priceId = items[0]?.price_id || items[0]?.price?.id || null;
            const transactionId = (event.data as any)?.transaction_id || null;

            // Immediately activate subscription in our DB (fallback if webhook fails)
            try {
              await fetch("/api/subscription/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ priceId, transactionId }),
              });
            } catch {
              // ignore, webhook may handle it
            }

            setTimeout(() => window.location.reload(), 1500);
          }
        },
      }).then((instance) => {
        if (instance) setPaddle(instance);
      });
    });
  }, []);

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
    setLoading(true);
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: (user as any).id },
    });
    setLoading(false);
  };

  const isPro = user?.plan === "pro";
  const isSubscribed = (user as any)?.subscriptionStatus === "active";
  const trialDaysLeft = (() => {
    if (!(user as any)?.trialEndsAt) return null;
    const diff = new Date((user as any).trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  })();

  const plans = [
    {
      id: "starter" as const,
      name: "Starter",
      price: 25,
      color: "gray",
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
      color: "blue",
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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your plan and subscription.</p>
      </div>

      {/* Current Plan Banner */}
      <div className={`rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4 ${
        isPro
          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          : "bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-100"
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xl font-extrabold capitalize ${isPro ? "text-white" : "text-gray-900"}`}>
              {user?.plan || "Starter"} Plan
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
              isPro ? "bg-white/20 text-white" :
              isSubscribed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {isSubscribed ? "Active" : trialDaysLeft !== null ? `Trial — ${trialDaysLeft}d left` : "Free"}
            </span>
          </div>
          <p className={`text-sm ${isPro ? "text-blue-200" : "text-gray-500"}`}>
            {isPro ? "$50/month" : "$25/month"}
            {trialDaysLeft !== null && !isSubscribed && ` · Free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}`}
          </p>
        </div>
        {!isSubscribed && (
          <button
            onClick={() => openCheckout(isPro ? "pro" : "starter")}
            disabled={loading}
            className={`font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-md ${
              isPro
                ? "bg-white text-blue-700 hover:bg-blue-50"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/30"
            }`}
          >
            Subscribe Now →
          </button>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {plans.map((plan) => {
          const isCurrent = user?.plan === plan.id;
          const isActive = isCurrent && isSubscribed;
          return (
            <div key={plan.id} className={`rounded-2xl border-2 p-6 flex flex-col ${
              plan.id === "pro"
                ? isCurrent ? "bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-500" : "bg-gradient-to-br from-slate-900 to-blue-950 border-slate-800"
                : isCurrent ? "bg-white border-blue-500" : "bg-white border-gray-100"
            }`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className={`font-extrabold text-lg ${plan.id === "pro" ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-center gap-2">
                  {plan.popular && (
                    <span className="text-xs bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full">Popular</span>
                  )}
                  {isCurrent && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${plan.id === "pro" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                      {isActive ? "Active" : "Current"}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <span className={`text-3xl font-black ${plan.id === "pro" ? "text-white" : "text-gray-900"}`}>${plan.price}</span>
                <span className={`text-sm ${plan.id === "pro" ? "text-white/50" : "text-gray-400"}`}>/month</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${plan.id === "pro" ? "text-white/80" : "text-gray-600"}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${plan.id === "pro" ? "text-green-400" : "text-green-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {isActive ? (
                <div className={`w-full text-center font-bold py-3 rounded-xl text-sm ${plan.id === "pro" ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-400"}`}>
                  ✓ Subscribed
                </div>
              ) : isCurrent && !isSubscribed ? (
                <button
                  onClick={() => openCheckout(plan.id)}
                  disabled={loading}
                  className={`w-full font-bold py-3 rounded-xl text-sm transition-colors ${
                    plan.id === "pro"
                      ? "bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {loading ? "Loading..." : `Subscribe to ${plan.name} — $${plan.price}/mo`}
                </button>
              ) : !isCurrent && plan.id === "pro" ? (
                <button
                  onClick={() => openCheckout("pro")}
                  disabled={loading}
                  className="w-full bg-white text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm shadow-lg"
                >
                  {loading ? "Loading..." : "Upgrade to Pro →"}
                </button>
              ) : (
                <div className="w-full text-center text-gray-400 text-sm py-3">
                  Downgrade not available
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing Notes */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm text-gray-500 space-y-1.5">
        <p className="font-semibold text-gray-700">Billing Notes</p>
        <p>• Subscriptions are billed monthly. Cancel any time — access continues until end of period.</p>
        <p>• After your 15-day trial, you will need to subscribe to keep access.</p>
        <p>• Questions? Email us at <a href="mailto:info@detailbookapp.com" className="text-blue-600 hover:underline">info@detailbookapp.com</a></p>
      </div>

      {/* Cancel Subscription */}
      {isSubscribed && (
        <div className="bg-white border border-red-100 rounded-2xl p-5">
          <h3 className="font-bold text-gray-900 mb-1">Cancel Subscription</h3>
          <p className="text-sm text-gray-500 mb-4">
            Canceling will disable your account at the end of the current billing period. Your data will be preserved.
          </p>
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            Cancel Subscription
          </button>
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
