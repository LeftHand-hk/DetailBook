"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface Props {
  open: boolean;
  publishableKey: string;
  userId: string;
  amount: number;
  customerEmail: string;
  serviceName: string;
  // Called with the Stripe PaymentIntent id after a successful payment.
  // The parent is responsible for creating the booking using this id as proof.
  onSuccess: (paymentIntentId: string) => void;
  onClose: () => void;
}

const stripePromises: Record<string, Promise<Stripe | null>> = {};
const getStripePromise = (key: string) => {
  if (!stripePromises[key]) stripePromises[key] = loadStripe(key);
  return stripePromises[key];
};

export default function StripeDepositModal(props: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    setClientSecret(null);
    setPaymentIntentId(null);
    setError(null);
    fetch("/api/stripe/deposit-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: props.userId,
        amount: props.amount,
        customerEmail: props.customerEmail,
        serviceName: props.serviceName,
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to start payment");
        if (!data.clientSecret) throw new Error("No client secret returned");
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
      })
      .catch((e) => setError(e.message || "Failed to start payment"));
  }, [props.open, props.userId, props.amount, props.customerEmail, props.serviceName]);

  if (!props.open) return null;

  const stripePromise = props.publishableKey ? getStripePromise(props.publishableKey) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
      onClick={props.onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <button
            onClick={props.onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs uppercase tracking-wider font-bold opacity-90">Secure deposit</span>
          </div>
          <p className="text-sm opacity-80">{props.serviceName}</p>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">
            ${props.amount.toFixed(2)}
            <span className="ml-2 text-sm font-medium opacity-70">USD</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {!props.publishableKey && (
            <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
              This business hasn&apos;t finished configuring Stripe.
            </div>
          )}

          {props.publishableKey && !clientSecret && !error && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">Setting up secure payment</p>
              <p className="text-xs text-gray-400">Powered by Stripe</p>
            </div>
          )}

          {clientSecret && stripePromise && paymentIntentId && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#2563EB",
                    colorBackground: "#ffffff",
                    colorText: "#111827",
                    colorDanger: "#dc2626",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    borderRadius: "12px",
                    spacingUnit: "4px",
                  },
                  rules: {
                    ".Input": {
                      border: "1px solid #e5e7eb",
                      boxShadow: "none",
                      padding: "12px 14px",
                    },
                    ".Input:focus": {
                      border: "1px solid #2563EB",
                      boxShadow: "0 0 0 3px rgba(37,99,235,0.15)",
                    },
                    ".Label": {
                      fontWeight: "600",
                      fontSize: "13px",
                      color: "#374151",
                      marginBottom: "6px",
                    },
                  },
                },
              }}
            >
              <PaymentForm
                amount={props.amount}
                paymentIntentId={paymentIntentId}
                onSuccess={props.onSuccess}
                onClose={props.onClose}
              />
            </Elements>
          )}
        </div>

        {/* Footer trust strip */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[11px] text-gray-500 font-medium">256-bit SSL encrypted · Powered by Stripe</span>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  amount,
  paymentIntentId,
  onSuccess,
  onClose,
}: {
  amount: number;
  paymentIntentId: string;
  onSuccess: (paymentIntentId: string) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setErrMsg(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrMsg(error.message || "Payment failed. Please check your card and try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      setPaid(true);
      // Brief success animation, then notify parent
      setTimeout(() => onSuccess(paymentIntent.id || paymentIntentId), 800);
      return;
    }

    if (paymentIntent?.status === "processing") {
      // Some banks clear async — treat as success and reconcile via webhook.
      setPaid(true);
      setTimeout(() => onSuccess(paymentIntent.id || paymentIntentId), 800);
      return;
    }

    setSubmitting(false);
    setErrMsg("We couldn't confirm your payment. Please try again.");
  };

  if (paid) {
    return (
      <div className="flex flex-col items-center justify-center py-8 animate-fadeIn">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-scaleIn">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-bold text-gray-900">Payment confirmed!</p>
        <p className="text-sm text-gray-500 mt-1">Finalizing your booking…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} />

      {errMsg && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-red-700">{errMsg}</div>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full px-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Processing payment…</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Pay ${amount.toFixed(2)} now</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
      >
        Cancel
      </button>
    </form>
  );
}
