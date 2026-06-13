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

// Live status of a Paddle subscription — "active" | "trialing" | "past_due"
// | "paused" | "canceled" | ... — or null when it can't be determined (no
// API key configured, network error, not found). Callers MUST treat null as
// "unknown" and fall back to local state; never as "not active".
//
// Used by the email crons to confirm — against Paddle, the source of truth —
// that a user is genuinely a paying ("active") subscriber before sending any
// trial-ending email. Our local subscriptionStatus can go stale if a Paddle
// webhook was missed/rejected, which is how a paying customer ends up getting
// "your trial is ending" mail. Note: Paddle keeps a subscription "trialing"
// for the whole trial window and only flips it to "active" once it charges
// the saved card — so "active" reliably means "paying" (safe to suppress
// trial mail), while "trialing" is a genuine trial where the reminder is
// still wanted.
export async function fetchPaddleSubscriptionStatus(
  subId: string | null | undefined
): Promise<string | null> {
  if (!subId) return null;
  const apiKey = paddleApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${paddleApiBase()}/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null as any);
    return j?.data?.status ?? null;
  } catch {
    return null;
  }
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
