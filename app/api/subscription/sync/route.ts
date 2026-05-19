import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Manual recovery path for activation. The Paddle webhook is the
// primary source of truth, but if it is misconfigured, delayed, or
// rejected (signature mismatch), the user is left waiting forever.
// This endpoint queries Paddle API server-side, finds the user's
// active subscription by email, and activates them — same data, same
// trust boundary as the webhook (we go straight to Paddle's API).

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.PADDLE_PRO_PRICE_ID || ""]: "pro",
};

function planFromItems(items: any[]): string | null {
  for (const item of items || []) {
    const priceId = item.price?.id || item.price_id;
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
  }
  return null;
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Payment system not configured", reason: "missing_api_key" },
      { status: 503 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, plan: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const base = paddleApiBase();
    const headers = { Authorization: `Bearer ${apiKey}` };

    // 1. Find Paddle customer by email. Paddle's /customers endpoint
    //    accepts an `email` filter that returns 0..n customers.
    const custRes = await fetch(
      `${base}/customers?email=${encodeURIComponent(user.email)}&status=active`,
      { headers, cache: "no-store" }
    );
    if (!custRes.ok) {
      const err = await custRes.json().catch(() => ({}));
      console.error("[sync] Paddle GET customers failed:", custRes.status, err);
      return NextResponse.json(
        { error: "Could not reach Paddle", reason: "customer_lookup_failed" },
        { status: 502 }
      );
    }
    const custJson = await custRes.json();
    const customers: any[] = custJson.data || [];
    if (customers.length === 0) {
      return NextResponse.json(
        { error: "No Paddle customer found with this email.", reason: "no_customer" },
        { status: 404 }
      );
    }

    // 2. For each customer (usually one), look up active subscriptions.
    let activeSub: any = null;
    let matchedCustomer: any = null;
    for (const c of customers) {
      const subRes = await fetch(
        `${base}/subscriptions?customer_id=${c.id}&status=active,trialing`,
        { headers, cache: "no-store" }
      );
      if (!subRes.ok) continue;
      const subJson = await subRes.json();
      const subs: any[] = subJson.data || [];
      if (subs.length > 0) {
        activeSub = subs[0];
        matchedCustomer = c;
        break;
      }
    }

    if (!activeSub) {
      return NextResponse.json(
        {
          error: "No active subscription found in Paddle for this account yet.",
          reason: "no_active_subscription",
        },
        { status: 404 }
      );
    }

    // 3. Activate locally. This mirrors the webhook handler exactly.
    const plan = planFromItems(activeSub.items);
    const updateData: Record<string, string> = {
      paddleSubscriptionId: activeSub.id,
      paddleCustomerId: matchedCustomer.id,
      subscriptionStatus: "active",
      trialEndsAt: "",
    };
    if (plan) updateData.plan = plan;

    await prisma.user.update({
      where: { id: user.id },
      data: { ...updateData, suspended: false },
    });

    return NextResponse.json({
      success: true,
      plan: plan || user.plan,
      subscriptionId: activeSub.id,
      customerId: matchedCustomer.id,
    });
  } catch (err) {
    console.error("[sync] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
