import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Cancels the user's Paddle subscription IMMEDIATELY at Paddle side,
// but does NOT suspend the local account. Used by the upgrade flow:
// switch from Starter → Pro means cancel current sub, then open a fresh
// Paddle Checkout for the new plan (Paddle rejects creating a 2nd
// active subscription for the same customer).

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) {
      return NextResponse.json({ success: true, alreadyClear: true });
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Try `immediately` first — wanted for the upgrade flow because
    // we open a new checkout right after. Some Paddle subscription
    // states reject `immediately` (e.g. paused), so fall back to
    // `next_billing_period` which is universally accepted.
    let res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify({ effective_from: "immediately" }),
    });

    if (!res.ok) {
      const firstErr = await res.json().catch(() => ({}));
      console.warn("[cancel-paddle] immediate cancel rejected, trying next_billing_period:", res.status, firstErr);

      res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[cancel-paddle] both attempts failed:", res.status, err);
        const detail = err?.error?.detail || firstErr?.error?.detail || err?.error?.code || err?.error?.type;
        return NextResponse.json(
          {
            error: detail
              ? `Paddle: ${detail}`
              : "Could not cancel current subscription with Paddle.",
          },
          { status: 502 }
        );
      }
    }

    // Clear the local linkage so Paddle Checkout treats this as a fresh
    // subscribe. The webhook (subscription.canceled) will mirror this.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        paddleSubscriptionId: "",
        subscriptionStatus: "canceled",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[cancel-paddle] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
