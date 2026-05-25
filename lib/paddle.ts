// Shared Paddle API helpers. Several routes (subscription cancel/upgrade,
// admin account deletion) need to talk to Paddle's REST API the same way,
// so the base-URL + cancel logic lives here.

export function paddleApiBase(): string {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

function paddleApiKey(): string | null {
  const key = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
  // The repo ships a placeholder; treat it as "not configured".
  if (!key || key === "your_paddle_api_key") return null;
  return key;
}

export type PaddleCancelResult = {
  status: "canceled" | "already_clear" | "not_configured" | "failed";
  detail?: string;
};

/**
 * Cancel a Paddle subscription immediately (falling back to
 * next_billing_period for states that reject immediate cancellation).
 * Never throws — returns a status so callers can decide what to do.
 *
 *   already_clear   — no subscription id, or Paddle says it's already gone
 *   not_configured  — no real PADDLE_API_KEY available
 *   canceled        — Paddle accepted the cancellation
 *   failed          — Paddle rejected it (detail has the reason)
 */
export async function cancelPaddleSubscription(
  subId: string | null | undefined
): Promise<PaddleCancelResult> {
  if (!subId) return { status: "already_clear" };

  const apiKey = paddleApiKey();
  if (!apiKey) return { status: "not_configured" };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    let res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ effective_from: "immediately" }),
    });
    if (res.ok) return { status: "canceled" };

    const firstErr = await res.json().catch(() => ({} as any));
    const code = firstErr?.error?.code || "";
    // Already gone on Paddle's side — nothing left to bill.
    if (res.status === 404 || /not_found|entity_not_found/i.test(code)) {
      return { status: "already_clear" };
    }

    // Some states (e.g. trialing/paused) reject `immediately`.
    res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });
    if (res.ok) return { status: "canceled" };

    const err = await res.json().catch(() => ({} as any));
    const detail =
      err?.error?.detail || firstErr?.error?.detail || err?.error?.code || `HTTP ${res.status}`;
    return { status: "failed", detail };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : "network error" };
  }
}
