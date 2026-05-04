"use client";

import { useState, useEffect, useRef } from "react";
import type { Paddle } from "@paddle/paddle-js";
import { trackEvent } from "@/lib/meta-pixel";

interface UserData {
  id: string;
  email: string;
  plan: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
  suspended?: boolean;
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
  const [waitingForWebhook, setWaitingForWebhook] = useState(false);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [nextBilledAt, setNextBilledAt] = useState<string | null>(null);
  const [updatingCard, setUpdatingCard] = useState(false);
  const [updateCardError, setUpdateCardError] = useState("");
  const [changingPlan, setChangingPlan] = useState<"starter" | "pro" | null>(null);
  const [changePlanError, setChangePlanError] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const pendingPlanRef = useRef<"starter" | "pro">("starter");
  const checkoutIntentRef = useRef<"subscribe" | "update-card">("subscribe");

  // Fetch user directly from API — not localStorage. If the user is
  // not yet active, kick a server-side Paddle API check in case they
  // paid in a previous session and the webhook never landed.
  const fetchUser = async () => {
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.user && data.user.subscriptionStatus !== "active") {
          // Background sync — silent. Re-fetch user if it activated.
          fetch("/api/subscription/sync", { method: "POST" })
            .then((r) => (r.ok ? fetch("/api/user", { cache: "no-store" }) : null))
            .then((r) => r && r.ok ? r.json() : null)
            .then((d) => { if (d?.user?.subscriptionStatus === "active") setUser(d.user); })
            .catch(() => { /* silent */ });
        }
      }
    } catch {
      // ignore
    } finally {
      setUserLoading(false);
    }
  };

  const fetchCard = async (opts?: { retry?: boolean }) => {
    try {
      const res = await fetch("/api/subscription/payment-method", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCard(data.card || null);
      setNextBilledAt(data.nextBilledAt || null);

      // Card info can lag a few seconds behind subscription activation
      // because Paddle populates payment_information AFTER the charge
      // settles. Retry quietly a few times before giving up.
      if (!data.card && opts?.retry) {
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise((r) => setTimeout(r, 5000));
          const r2 = await fetch("/api/subscription/payment-method", { cache: "no-store" });
          if (!r2.ok) continue;
          const d2 = await r2.json();
          if (d2.card) {
            setCard(d2.card);
            setNextBilledAt(d2.nextBilledAt || null);
            return;
          }
        }
      }
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
    const env = process.env.NEXT_PUBLIC_PADDLE_ENV;
    const starterPrice = process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID;
    const proPrice = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID;
    if (!token) {
      console.error("[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing — checkout will not load.");
      return;
    }
    if (!starterPrice || !proPrice) {
      console.error("[Paddle] Price IDs missing:", { starterPrice, proPrice });
    }
    if (token.startsWith("test_") && env !== "sandbox") {
      console.warn("[Paddle] sandbox token but NEXT_PUBLIC_PADDLE_ENV is not 'sandbox' — checkout will fail.");
    }
    if (token.startsWith("live_") && env === "sandbox") {
      console.warn("[Paddle] live token but NEXT_PUBLIC_PADDLE_ENV='sandbox' — checkout will fail.");
    }
    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: (env as "sandbox" | "production") || "production",
        token,
        async eventCallback(event) {
          if (event.name === "checkout.completed") {
            if (checkoutIntentRef.current === "update-card") {
              await fetchCard({ retry: true });
            } else {
              const planValue = pendingPlanRef.current === "pro" ? 50 : 29;
              // predicted_ltv: rough ~10-month retention estimate, used by
              // Meta value-optimised campaigns as a bid signal. Tune as we
              // see real cohort data.
              const predictedLtv = planValue * 10;
              trackEvent("Subscribe", {
                value: planValue,
                currency: "USD",
                predicted_ltv: predictedLtv,
              });
              // Run activation polling AND schedule a guaranteed reload.
              // The reload makes sure sidebar / plan-gated UI picks up
              // the new plan; activation polling makes sure the server
              // has confirmed the sub before we reload.
              waitForActivation().finally(() => {
                if (typeof window !== "undefined") {
                  setTimeout(() => window.location.reload(), 500);
                }
              });
              // Hard fallback: even if waitForActivation hangs for some
              // reason, reload after 12s so the user is never stuck.
              setTimeout(() => {
                if (typeof window !== "undefined") window.location.reload();
              }, 12000);
            }
          } else if (event.name === "checkout.error") {
            console.error("[Paddle] checkout.error full event:", JSON.stringify(event, null, 2));
            const ev: any = event;
            const detail =
              ev?.data?.error?.detail ||
              ev?.error?.detail ||
              ev?.data?.message ||
              ev?.error?.message ||
              ev?.data?.error?.code ||
              "Paddle Checkout failed. Open browser console for details.";
            setChangePlanError(`Paddle: ${detail}`);
          }
        },
      }).then((instance) => {
        if (instance) setPaddle(instance);
        else console.error("[Paddle] initializePaddle returned no instance — token / env likely invalid.");
      }).catch((err) => {
        console.error("[Paddle] initializePaddle threw:", err);
      });
    });
  }, []);

  useEffect(() => {
    if (user?.subscriptionStatus === "active") fetchCard({ retry: true });
  }, [user?.subscriptionStatus]);

  // After Paddle Checkout closes successfully, activation happens
  // server-to-server: the server queries Paddle's API for THIS user's
  // active subscription and activates only if Paddle confirms it.
  // The user is never trusted — only Paddle is. Webhook is the
  // primary path; this just makes activation immediate instead of
  // waiting for webhook delivery.
  const waitForActivation = async () => {
    setWaitingForWebhook(true);
    setWaitTimedOut(false);
    setActivateSuccess(false);

    const succeed = (u: UserData) => {
      setUser(u);
      setActivateSuccess(true);
      setWaitingForWebhook(false);
    };

    // Try for up to 90s. Webhook may arrive any time; we also kick the
    // server-side Paddle API check periodically. Both paths only set
    // subscriptionStatus = "active" when Paddle itself confirms.
    const deadline = Date.now() + 90_000;
    let attempt = 0;
    while (Date.now() < deadline) {
      // Always read latest server state first (catches webhook arrivals).
      try {
        const res = await fetch("/api/user", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.subscriptionStatus === "active") return succeed(data.user);
        }
      } catch { /* ignore */ }

      // Every 6s, ask the server to verify with Paddle's API.
      // (First sync at attempt 1 — gives Paddle ~3s after checkout.)
      if (attempt > 0 && attempt % 3 === 0) {
        try {
          const syncRes = await fetch("/api/subscription/sync", { method: "POST" });
          if (syncRes.ok) {
            const userRes = await fetch("/api/user", { cache: "no-store" });
            if (userRes.ok) {
              const data = await userRes.json();
              if (data.user?.subscriptionStatus === "active") return succeed(data.user);
            }
          } else {
            const body = await syncRes.json().catch(() => ({}));
            console.warn("[Paddle sync]", syncRes.status, body);
          }
        } catch (e) {
          console.warn("[Paddle sync] threw:", e);
        }
      }

      attempt++;
      await new Promise((r) => setTimeout(r, 2000));
    }

    setWaitingForWebhook(false);
    setWaitTimedOut(true);
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCancelDone(true);
        // Reload billing page — layout will keep them confined here
        // because user.suspended is now true. They can reactivate from
        // the same page without logging out.
        setTimeout(() => window.location.reload(), 2000);
      } else {
        alert(data.error || "Could not cancel subscription. Please contact support.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setCanceling(false);
      setShowCancelModal(false);
    }
  };

  const handlePlanAction = async (plan: "starter" | "pro") => {
    if (!user) return;

    setChangingPlan(plan);
    setChangePlanError("");

    try {
      // Only route through PATCH /subscriptions when we actually hold a
      // Paddle subscription ID. subscriptionStatus alone isn't enough —
      // the admin panel sets it to "trial" when extending a trial, which
      // is purely an internal marker with no Paddle sub behind it.
      // Without a paddleSubscriptionId the change-plan endpoint will
      // (correctly) reject the request, so first-time subscribers must
      // go through Paddle Checkout.
      const hasLinkedSub = Boolean((user as any).paddleSubscriptionId);

      const trimmedCode = discountCode.trim();

      if (hasLinkedSub) {
        const res = await fetch("/api/subscription/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, discountCode: trimmedCode || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setChangePlanError(data.error || "Could not change plan. Please contact support.");
          return;
        }
        if (typeof window !== "undefined") {
          setTimeout(() => window.location.reload(), 500);
        }
        return;
      }

      // No active sub — open Paddle Checkout for first-time purchase
      // or for canceled/suspended users reactivating.
      const priceId = plan === "pro"
        ? process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID
        : process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID;
      if (!priceId) {
        setChangePlanError(`Payment is not configured (missing ${plan} price ID). Please contact support.`);
        return;
      }
      if (!paddle) {
        setChangePlanError("Payment system is still loading. Please wait a moment and try again.");
        return;
      }

      pendingPlanRef.current = plan;
      checkoutIntentRef.current = "subscribe";
      setWaitTimedOut(false);
      setActivateSuccess(false);
      const checkoutOptions: any = {
        items: [{ priceId, quantity: 1 }],
        customer: { email: user.email },
        customData: { userId: user.id },
      };
      if (trimmedCode) checkoutOptions.discountCode = trimmedCode;
      paddle.Checkout.open(checkoutOptions);
    } catch (err) {
      console.error("[Paddle] handlePlanAction threw:", err);
      setChangePlanError("Could not change plan. Please refresh and try again.");
    } finally {
      setChangingPlan(null);
    }
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

      {/* Banner: waiting for Paddle webhook to confirm payment */}
      {waitingForWebhook && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
          <div className="w-5 h-5 mt-0.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900">Confirming your payment…</p>
            <p className="text-sm text-blue-700 mt-1">
              We&apos;re waiting for Paddle to confirm your subscription. This usually takes a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* Banner: still confirming after 90s — page will auto-activate
          on next visit if Paddle eventually confirms. */}
      {waitTimedOut && !isSubscribed && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="font-semibold text-amber-900 mb-1">Still confirming with Paddle…</p>
          <p className="text-sm text-amber-800">
            Your payment is being verified. Your plan will activate automatically as soon as Paddle confirms it — usually within a minute. Refresh this page in a moment, or email <a href="mailto:info@detailbookapp.com" className="underline font-medium">info@detailbookapp.com</a> with your Paddle invoice if it still hasn&apos;t activated after a few minutes.
          </p>
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

      {/* Banner: subscription canceled — user is locked out of dashboard
          until they pick a plan and pay below. Their data is preserved. */}
      {user?.suspended && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-900">Your subscription is canceled.</p>
            <p className="text-sm text-red-800 mt-1">
              Your account is paused — bookings, calendar, and dashboard access are disabled. Your data is safe. Choose a plan below to reactivate immediately.
            </p>
          </div>
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
                trialDaysLeft !== null && trialDaysLeft <= 3 ? "bg-red-50 text-red-700 border border-red-200" :
                trialDaysLeft !== null ? "bg-amber-50 text-amber-700 border border-amber-200" :
                "bg-gray-100 text-gray-600 border border-gray-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSubscribed ? "bg-green-500" :
                  trialDaysLeft !== null && trialDaysLeft <= 3 ? "bg-red-500" :
                  trialDaysLeft !== null ? "bg-amber-500" : "bg-gray-400"
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
              <p className={`text-sm mt-3 ${trialDaysLeft <= 3 ? "text-red-700 font-semibold" : "text-amber-700"}`}>
                {trialDaysLeft <= 3
                  ? "Your trial ends very soon — subscribe now to keep your booking page live."
                  : "Subscribe before your trial ends to avoid losing access."}
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
                Your subscription is active but we haven&apos;t received card details from Paddle yet. This usually takes a minute after the first charge.
              </p>
              <button
                onClick={() => fetchCard({ retry: true })}
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
        <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Available plans</h2>
            <p className="text-sm text-gray-500">Choose the plan that fits your business. You can apply a promo code in checkout.</p>
          </div>
        </div>
        {changePlanError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {changePlanError}
          </div>
        )}
        <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-shrink-0">
            <p className="text-sm font-semibold text-gray-700">Promo code</p>
            <p className="text-xs text-gray-500">Applied when you switch or subscribe below.</p>
          </div>
          <input
            type="text"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="flex-1 px-3 py-2 text-sm font-mono uppercase tracking-wider border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
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
                ) : (
                  <button
                    onClick={() => handlePlanAction(plan.id)}
                    disabled={changingPlan !== null}
                    className={`w-full font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      isPopular
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {changingPlan === plan.id
                      ? "Preparing checkout…"
                      : isSubscribed
                        ? user?.plan === "pro" && plan.id === "starter"
                          ? `Switch to ${plan.name}`
                          : `Switch to ${plan.name}`
                        : `Subscribe to ${plan.name}`}
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
            <p className="text-sm text-gray-500">Your account is paused. You can reactivate any time from this page.</p>
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
              Your account will be <strong>paused</strong> immediately and you&apos;ll lose access to bookings, calendar, and dashboard. Your data stays safe — you can reactivate any time.
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
