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
  paddleSubscriptionId?: string | null;
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
            .then((d) => {
              if (["active", "trialing"].includes(d?.user?.subscriptionStatus)) {
                setUser(d.user);
              }
            })
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
              const planValue = pendingPlanRef.current === "pro" ? 50 : 24;
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
    // Trialing users already have a card on file at Paddle (it was
    // captured during onboarding), so fetch it too — not just for
    // "active". Without this the card never loads during the trial and
    // the page falsely shows "No payment method yet".
    if (user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing") {
      fetchCard({ retry: true });
    }
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
          if (["active", "trialing"].includes(data.user?.subscriptionStatus)) {
            return succeed(data.user);
          }
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
              if (["active", "trialing"].includes(data.user?.subscriptionStatus)) {
                return succeed(data.user);
              }
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
        // Reload so the page reflects the new state. A paid cancel keeps the
        // user active until period end (no suspend), so they land back on a
        // fully-usable dashboard with the "cancellation scheduled" notice.
        // An immediate/edge cancel sets suspended=true and the layout
        // confines them here to reactivate.
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
      const localStatus = (user.subscriptionStatus || "").toLowerCase();
      const hasPaddleSub = Boolean(user.paddleSubscriptionId);
      const hasLinkedSub = hasPaddleSub
        && !["canceled", "expired", "past_due"].includes(localStatus);

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
      // Expired/past-due accounts may still have a Paddle subscription
      // with a saved payment method or an overdue transaction. Try that
      // recovery path before opening a brand-new checkout.
      if (hasPaddleSub) {
        const res = await fetch("/api/subscription/reactivate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, discountCode: trimmedCode || undefined }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setChangePlanError(data.error || "Could not retry your payment. Please contact support.");
          return;
        }

        if (data.action === "activated") {
          if (data.user) setUser(data.user);
          setActivateSuccess(true);
          if (typeof window !== "undefined") {
            setTimeout(() => window.location.reload(), 500);
          }
          return;
        }

        if (data.action === "checkout_transaction" && data.transactionId) {
          if (!paddle) {
            setChangePlanError("Payment system is still loading. Please wait a moment and try again.");
            return;
          }
          pendingPlanRef.current = plan;
          checkoutIntentRef.current = "subscribe";
          setWaitTimedOut(false);
          setActivateSuccess(false);
          paddle.Checkout.open({ transactionId: data.transactionId });
          return;
        }
      }

      // Duplicate-subscription guard. Before opening a brand-new checkout,
      // ask the server whether this customer already has a subscription at
      // Paddle. Creating a second one is what caused duplicate charges.
      try {
        const pre = await fetch("/api/subscription/checkout-precheck", { method: "POST" });
        const preData = await pre.json().catch(() => ({} as any));
        if (pre.ok) {
          if (preData.action === "already_active") {
            if (preData.user) setUser(preData.user);
            setActivateSuccess(true);
            if (typeof window !== "undefined") setTimeout(() => window.location.reload(), 600);
            return;
          }
          if (preData.action === "pay_existing" && preData.transactionId) {
            if (!paddle) {
              setChangePlanError("Payment system is still loading. Please wait a moment and try again.");
              return;
            }
            pendingPlanRef.current = plan;
            checkoutIntentRef.current = "subscribe";
            setWaitTimedOut(false);
            setActivateSuccess(false);
            paddle.Checkout.open({ transactionId: preData.transactionId });
            return;
          }
        }
      } catch {
        // Fail open — never block a real purchase on a precheck hiccup.
      }

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

  // Deep link from the trial banner / "trial ended" modal:
  // /dashboard/billing?checkout=starter|pro auto-opens that plan's Paddle
  // checkout once the user + Paddle SDK are ready. Fires once, then strips
  // the param so a refresh doesn't reopen the overlay.
  const autoCheckoutFired = useRef(false);
  useEffect(() => {
    if (autoCheckoutFired.current || !user || !paddle) return;
    const param = new URLSearchParams(window.location.search).get("checkout");
    if (param !== "starter" && param !== "pro") return;
    autoCheckoutFired.current = true;
    window.history.replaceState(null, "", "/dashboard/billing");
    // Already paying? Don't auto-open a checkout — prevents creating a
    // duplicate subscription if the user reopens the ?checkout= link.
    if (user.subscriptionStatus === "active") return;
    handlePlanAction(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paddle]);

  const isPro = user?.plan === "pro";
  const isSubscribed = user?.subscriptionStatus === "active";
  const isTrialing = user?.subscriptionStatus === "trialing";
  // Canceled but not yet suspended = cancellation is scheduled for the end
  // of the current period; the user keeps full access until then.
  const isCancelScheduled = user?.subscriptionStatus === "canceled" && !user?.suspended;
  // A trialing user has a live Paddle subscription with a card already
  // on file (captured at onboarding). For card display and current-plan
  // marking they should be treated exactly like an active subscriber —
  // only the messaging differs (trial vs. billed).
  const hasSubscription = isSubscribed || isTrialing;
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
      price: 24,
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
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Billing</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your plan and payment method.</p>
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

      {/* Banner: cancellation scheduled — user keeps access until the
          current period ends, then the webhook suspends them. */}
      {isCancelScheduled && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-900">Your plan is canceled.</p>
            <p className="text-sm text-amber-800 mt-1">
              You keep full access — your dashboard and booking page stay live — until the end of your current period. After that your account pauses and your data is saved. Changed your mind? Pick a plan below to stay.
            </p>
          </div>
        </div>
      )}

      {/* === Current plan summary === */}
      <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-5 sm:p-6 mb-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2">Current plan</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-2xl font-black text-gray-900 capitalize">{user?.plan || "Starter"}</span>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            isSubscribed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
            isCancelScheduled ? "bg-amber-50 text-amber-700 border border-amber-200" :
            trialDaysLeft !== null && trialDaysLeft <= 2 ? "bg-red-50 text-red-700 border border-red-200" :
            trialDaysLeft !== null ? "bg-amber-50 text-amber-700 border border-amber-200" :
            "bg-gray-100 text-gray-600 border border-gray-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isSubscribed ? "bg-emerald-500" :
              isCancelScheduled ? "bg-amber-500" :
              trialDaysLeft !== null && trialDaysLeft <= 2 ? "bg-red-500" :
              trialDaysLeft !== null ? "bg-amber-500" : "bg-gray-400"
            }`} />
            {isSubscribed ? "Active" : isCancelScheduled ? "Canceling" : trialDaysLeft !== null ? `Trial · ${trialDaysLeft}d left` : "Inactive"}
          </span>
          <span className="ml-auto whitespace-nowrap">
            <span className="text-2xl font-black text-gray-900">${isPro ? 50 : 24}</span>
            <span className="text-sm text-gray-500">/mo</span>
          </span>
        </div>

        {nextBilledAt && isSubscribed && (
          <p className="text-sm text-gray-500 mt-3">
            Next charge on <strong className="text-gray-700">{new Date(nextBilledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>
          </p>
        )}
        {/* Trialing with a card on file: reassure, don't nag. */}
        {isTrialing && trialDaysLeft !== null && (
          <p className="text-sm mt-3 text-gray-500">
            Your free trial is active.{" "}
            {nextBilledAt ? (
              <>You&apos;ll be charged <strong className="text-gray-700">${isPro ? 50 : 24}</strong> on{" "}
              <strong className="text-gray-700">{new Date(nextBilledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong> unless you cancel.</>
            ) : (
              <>{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left — your card is on file and you can cancel anytime before then.</>
            )}
          </p>
        )}
        {/* No-card trial: nudge to subscribe. */}
        {!hasSubscription && trialDaysLeft !== null && (
          <p className={`text-sm mt-3 ${trialDaysLeft <= 2 ? "text-red-700 font-semibold" : "text-amber-700"}`}>
            {trialDaysLeft <= 2
              ? "Your trial ends very soon — subscribe to keep your booking page live."
              : "Subscribe before your trial ends to keep your booking page live."}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
          <span>Billing email</span>
          <span className="font-medium text-gray-600 break-all">{user?.email}</span>
        </div>
      </div>

      {/* === Payment method — only when there's a subscription/card === */}
      {hasSubscription && (
        <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-5 sm:p-6 mb-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-black text-gray-900">Payment method</h2>
            {card && (
              <button
                onClick={handleUpdateCard}
                disabled={updatingCard}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {updatingCard ? "Loading…" : "Update"}
              </button>
            )}
          </div>

          {card ? (
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-[60px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cardTheme.bg} text-white text-[10px] font-black uppercase tracking-wide`}>
                {(card.brand || "").toLowerCase() === "amex" ? "Amex" : formatBrandLabel(card.brand)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">
                  {formatBrandLabel(card.brand)} •••• {card.last4 || "••••"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {card.expMonth && card.expYear
                    ? `Expires ${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)} · `
                    : ""}
                  Securely stored by Paddle
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <svg className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">Card details syncing…</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Your subscription is active; Paddle usually sends card details within a minute of the first charge.
                </p>
                <button
                  onClick={() => fetchCard({ retry: true })}
                  className="mt-2 text-xs font-bold text-amber-800 hover:text-amber-900 underline underline-offset-2"
                >
                  Refresh
                </button>
              </div>
            </div>
          )}
          {updateCardError && <p className="mt-3 text-sm text-red-600">{updateCardError}</p>}
        </div>
      )}

      {/* === Plans === */}
      <div className="mb-5">
        <h2 className="text-base font-black text-gray-900 mb-3">{hasSubscription ? "Change plan" : "Choose a plan"}</h2>
        {changePlanError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-700">
            {changePlanError}
          </div>
        )}
        <div className="mb-3.5 flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5">
          <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <input
            type="text"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
            placeholder="Promo code (optional)"
            className="flex-1 bg-transparent text-sm font-mono uppercase tracking-wider text-gray-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-gray-400"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {plans.map((plan) => {
            const isCurrent = user?.plan === plan.id;
            const isActive = isCurrent && hasSubscription;
            const isPopular = plan.popular;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-5 flex flex-col bg-white transition-shadow ${
                  isActive ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-200 hover:shadow-sm"
                }`}
              >
                {isPopular && !isActive && (
                  <span className="absolute -top-2.5 right-5 text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2.5 py-1 rounded-full">
                    Recommended
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-black text-lg text-gray-900">{plan.name}</h3>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Your plan
                      </span>
                    )}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-2xl font-black text-gray-900">${plan.price}</span>
                    <span className="text-sm text-gray-400">/mo</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <div className="w-full text-center font-bold py-3 rounded-2xl text-sm bg-gray-100 text-gray-500">
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handlePlanAction(plan.id)}
                    disabled={changingPlan !== null}
                    className={`w-full font-black py-3 rounded-2xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      isPopular
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {changingPlan === plan.id
                      ? "Preparing checkout…"
                      : hasSubscription
                        ? `Switch to ${plan.name}`
                        : `Subscribe to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === Cancel === */}
      {(isSubscribed || isTrialing) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">
              {isTrialing ? "Cancel before trial ends" : "Cancel subscription"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isTrialing
                ? `You won't be charged${trialDaysLeft ? ` — trial runs ${trialDaysLeft} more day${trialDaysLeft === 1 ? "" : "s"}` : ""}. Your data stays put.`
                : "Cancels at the end of your current billing period — you keep access until then. Your data is always saved."}
            </p>
          </div>
          <button
            onClick={() => setShowCancelModal(true)}
            className="shrink-0 text-sm font-bold text-red-600 hover:text-red-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* === Footer note === */}
      <p className="text-center text-xs text-gray-400 mb-2">
        Billed monthly · cancel anytime · payments secured by Paddle ·{" "}
        <a href="mailto:info@detailbookapp.com" className="text-blue-600 hover:underline font-medium">info@detailbookapp.com</a>
      </p>

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
            <p className="text-sm text-gray-500">You&apos;ll keep access until your current period ends, then your account pauses. Your data stays saved — reactivate any time from this page.</p>
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
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              {user?.subscriptionStatus === "trialing" ? "Cancel trial?" : "Cancel Subscription?"}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              {user?.subscriptionStatus === "trialing" ? (
                <>You won&apos;t be charged. Your trial keeps running{trialDaysLeft ? ` for ${trialDaysLeft} more day${trialDaysLeft === 1 ? "" : "s"}` : ""} and your data stays safe.</>
              ) : (
                <>You&apos;ll keep full access until the end of your current billing period. After that your account <strong>pauses</strong> — your data stays safe and you can reactivate any time.</>
              )}
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
