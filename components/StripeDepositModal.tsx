"use client";

import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface Props {
  open: boolean;
  publishableKey: string;
  bookingId: string;
  userId: string;
  amount: number;
  customerEmail: string;
  serviceName: string;
  onSuccess: (amountPaid: number) => void;
  onClose: () => void;
}

// We cache Stripe.js loader Promises per publishable key so multiple opens
// don't re-fetch the script.
const stripePromises: Record<string, Promise<Stripe | null>> = {};
const getStripePromise = (key: string) => {
  if (!stripePromises[key]) stripePromises[key] = loadStripe(key);
  return stripePromises[key];
};

export default function StripeDepositModal(props: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setClientSecret(null);
    setError(null);
    fetch("/api/stripe/deposit-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: props.userId,
        bookingId: props.bookingId,
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
      })
      .catch((e) => setError(e.message || "Failed to start payment"));
  }, [props.open, props.userId, props.bookingId, props.amount, props.customerEmail, props.serviceName]);

  if (!props.open) return null;

  const stripePromise = props.publishableKey ? getStripePromise(props.publishableKey) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Pay deposit</h3>
          <button onClick={props.onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Close">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 text-sm text-gray-600">
            Deposit for <span className="font-semibold text-gray-900">{props.serviceName}</span>
            <div className="mt-1 text-2xl font-extrabold text-gray-900">${props.amount.toFixed(2)}</div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {!props.publishableKey && (
            <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
              This business has not finished configuring Stripe.
            </div>
          )}

          {props.publishableKey && !clientSecret && !error && (
            <div className="flex items-center gap-3 text-gray-500 text-sm py-6 justify-center">
              <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Setting up secure payment…
            </div>
          )}

          {clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
              <PaymentForm
                amount={props.amount}
                bookingId={props.bookingId}
                onSuccess={props.onSuccess}
                onClose={props.onClose}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  amount,
  bookingId,
  onSuccess,
  onClose,
}: {
  amount: number;
  bookingId: string;
  onSuccess: (amountPaid: number) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setErrMsg(null);

    // Confirm the card payment in-place — no redirect. We pass redirect: "if_required"
    // so any methods that DO require a redirect (e.g. iDEAL) still work, but cards
    // resolve here.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrMsg(error.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Verify on the server — this also flips booking.depositPaid in the DB.
      try {
        await fetch("/api/deposit/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
      } catch { /* webhook will reconcile if this fails */ }
      onSuccess(amount);
      return;
    }

    // Some statuses (processing, requires_action handled by Stripe.js) end here;
    // treat them as "submitted, will reconcile" — close the modal optimistically.
    setSubmitting(false);
    setErrMsg("Payment is processing. You will receive a confirmation shortly.");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />

      {errMsg && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {errMsg}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="flex-1 px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {submitting && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {submitting ? "Processing…" : `Pay $${amount.toFixed(2)}`}
        </button>
      </div>

      <p className="text-[11px] text-gray-400 text-center pt-1">
        Payments are processed securely by Stripe. Your card details never touch this site.
      </p>
    </form>
  );
}
