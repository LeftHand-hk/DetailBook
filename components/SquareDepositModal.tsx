"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  applicationId: string;
  locationId: string;
  sandbox: boolean;
  userId: string;
  amount: number;
  customerEmail: string;
  serviceName: string;
  // Called with the Square payment id after a successful charge.
  onSuccess: (paymentId: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    Square: any;
  }
}

const SDK_PROD = "https://web.squarecdn.com/v1/square.js";
const SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";

// Cache the script-loading Promise per environment so re-opening the modal
// doesn't re-inject the script.
const sdkPromises: Record<string, Promise<void> | undefined> = {};
function loadSquareSdk(sandbox: boolean): Promise<void> {
  const src = sandbox ? SDK_SANDBOX : SDK_PROD;
  const cached = sdkPromises[src];
  if (cached) return cached;
  sdkPromises[src] = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.Square) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Square SDK failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Square SDK failed to load"));
    document.head.appendChild(s);
  });
  return sdkPromises[src]!;
}

export default function SquareDepositModal(props: Props) {
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [setupErr, setSetupErr] = useState<string | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [props.open]);

  // Load + attach Square card form
  useEffect(() => {
    if (!props.open) return;
    if (!props.applicationId || !props.locationId) {
      setSetupErr(
        "This business hasn't finished setting up Square. Please choose a different payment method or contact them."
      );
      return;
    }
    // Sandbox application IDs start with "sandbox-sq0idb-" and the SDK refuses
    // to initialize with the prod URL — fail loud here instead of a cryptic
    // SDK error.
    const looksLikeSandbox = props.applicationId.startsWith("sandbox-");
    if (looksLikeSandbox !== !!props.sandbox) {
      setSetupErr(
        looksLikeSandbox
          ? "Square is configured with a sandbox Application ID but Sandbox Mode is off. Ask the business to fix this."
          : "Square's Sandbox Mode is on but a production Application ID is being used. Ask the business to fix this."
      );
      return;
    }
    let destroyed = false;

    (async () => {
      setSetupErr(null);
      setReady(false);
      try {
        await loadSquareSdk(props.sandbox);
        if (destroyed) return;
        if (!window.Square) throw new Error("Square SDK unavailable");

        const payments = window.Square.payments(props.applicationId, props.locationId);
        const card = await payments.card({
          style: {
            input: {
              fontSize: "15px",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              color: "#111827",
            },
            ".input-container": {
              borderRadius: "12px",
              borderColor: "#e5e7eb",
            },
            ".input-container.is-focus": {
              borderColor: "#2563EB",
            },
          },
        });
        if (destroyed) return;
        if (!cardContainerRef.current) return;
        await card.attach(cardContainerRef.current);
        if (destroyed) {
          card.destroy?.();
          return;
        }
        cardRef.current = card;
        setReady(true);
      } catch (e: any) {
        if (!destroyed) setSetupErr(e?.message || "Failed to load card form");
      }
    })();

    return () => {
      destroyed = true;
      try { cardRef.current?.destroy?.(); } catch { /* ignore */ }
      cardRef.current = null;
    };
  }, [props.open, props.applicationId, props.locationId, props.sandbox]);

  const handlePay = async () => {
    if (!cardRef.current || submitting) return;
    setSubmitting(true);
    setErrMsg(null);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        const msg = result.errors?.[0]?.message || "Please check your card details and try again.";
        setErrMsg(msg);
        setSubmitting(false);
        return;
      }

      const r = await fetch("/api/square/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: props.userId,
          sourceId: result.token,
          amount: props.amount,
          customerEmail: props.customerEmail,
          serviceName: props.serviceName,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrMsg(data?.error || "Card was declined.");
        setSubmitting(false);
        return;
      }

      setPaid(true);
      setTimeout(() => props.onSuccess(data.paymentId), 800);
    } catch (e: any) {
      setErrMsg(e?.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (!props.open) return null;

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
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
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
          {paid ? (
            <div className="flex flex-col items-center justify-center py-8 animate-fadeIn">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-scaleIn">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900">Payment confirmed!</p>
              <p className="text-sm text-gray-500 mt-1">Finalizing your booking…</p>
            </div>
          ) : (
            <div className="space-y-5">
              {setupErr && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-red-700">{setupErr}</div>
                </div>
              )}

              {!ready && !setupErr && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <svg className="animate-spin w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm font-semibold text-gray-700">Setting up secure payment</p>
                  <p className="text-xs text-gray-400">Powered by Square</p>
                </div>
              )}

              {/* Square card form mounts here. Hidden until ready so the spinner
                  isn't fighting with a half-rendered iframe. */}
              <div className={ready ? "" : "hidden"}>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Card details</label>
                <div ref={cardContainerRef} />
              </div>

              {errMsg && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-red-700">{errMsg}</div>
                </div>
              )}

              {ready && (
                <>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={submitting}
                    className="w-full px-5 py-3.5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white font-bold text-sm shadow-lg shadow-slate-700/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center justify-center gap-2"
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
                        <span>Pay ${props.amount.toFixed(2)} now</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={props.onClose}
                    disabled={submitting}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer trust strip */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[11px] text-gray-500 font-medium">256-bit SSL encrypted · Powered by Square</span>
        </div>
      </div>
    </div>
  );
}
