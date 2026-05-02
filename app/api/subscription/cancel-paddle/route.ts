import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Cancels the user's Paddle subscription IMMEDIATELY at Paddle side,
// but does NOT suspend the local account or flip subscriptionStatus to
// "canceled" — the caller (e.g. an upgrade flow) is responsible for
// reactivating with a new subscription right after. This is the only
// way to switch plans through a fresh Paddle Checkout, since Paddle
// rejects creating a 2nd active subscription for the same customer.

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) {
      // Nothing to cancel — caller can proceed straight to checkout
      return NextResponse.json({ success: true, alreadyClear: true });
    }

    const res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effective_from: "immediately" }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[cancel-paddle] Paddle cancel failed:", res.status, err);
      return NextResponse.json(
        { error: "Could not cancel current subscription with Paddle." },
        { status: 502 }
      );
    }

    // Clear the local linkage so Paddle Checkout treats this as a fresh
    // subscribe. The webhook (subscription.canceled) will mirror this,
    // but we do it now so the UI doesn't briefly show stale state.
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
