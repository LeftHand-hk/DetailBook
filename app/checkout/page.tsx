"use client";

import { useEffect, useRef, useState } from "react";
import type { Paddle } from "@paddle/paddle-js";
import Logo from "@/components/Logo";

// Paddle "default payment link" landing page.
//
// Paddle sends customers to {your-domain}/checkout?_ptxn=txn_... to
// complete or retry a payment — e.g. confirming a trial-end charge (3DS),
// paying a past-due invoice, or finishing a checkout that needs extra
// authentication. The page loads Paddle.js and opens the overlay for that
// transaction. Without it, the link 404s and the customer can't pay.
type State = "loading" | "opening" | "completed" | "missing" | "error";

export default function CheckoutPage() {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");
  const paddleRef = useRef<Paddle | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Paddle uses `_ptxn`; accept `transactionId`/`txn` as fallbacks.
    const txnId =
      params.get("_ptxn") || params.get("transactionId") || params.get("txn");

    if (!txnId) {
      setState("missing");
      return;
    }

    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      setState("error");
      setMessage("Payment is not configured. Please contact support.");
      return;
    }

    let cancelled = false;
    import("@paddle/paddle-js")
      .then(({ initializePaddle }) =>
        initializePaddle({
          environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "production",
          token,
          eventCallback(event) {
            if (event.name === "checkout.completed") {
              setState("completed");
              setTimeout(() => {
                window.location.href = "/dashboard/billing";
              }, 2000);
            }
          },
        })
      )
      .then((paddle) => {
        if (cancelled || !paddle) return;
        paddleRef.current = paddle;
        setState("opening");
        paddle.Checkout.open({ transactionId: txnId });
      })
      .catch((err) => {
        console.error("[checkout] Paddle init/open failed:", err);
        if (!cancelled) {
          setState("error");
          setMessage("We couldn't load the payment form. Please refresh and try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <Logo size="md" href="/" darkText />
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        {(state === "loading" || state === "opening") && (
          <>
            <div className="w-10 h-10 mx-auto mb-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <h1 className="text-lg font-bold text-gray-900">Loading your payment…</h1>
            <p className="text-sm text-gray-500 mt-1">
              The secure payment window will open in a moment.
            </p>
          </>
        )}

        {state === "completed" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Payment complete!</h1>
            <p className="text-sm text-gray-500 mt-1">Taking you to your dashboard…</p>
          </>
        )}

        {state === "missing" && (
          <>
            <h1 className="text-lg font-bold text-gray-900">No payment to show</h1>
            <p className="text-sm text-gray-500 mt-2">
              This link is missing its payment reference. If you came from an email,
              open the most recent link, or manage your subscription from your dashboard.
            </p>
            <a href="/dashboard/billing" className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
              Go to billing
            </a>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
            <button onClick={() => window.location.reload()} className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
              Try again
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-6">Payments are securely processed by Paddle.</p>
    </div>
  );
}
