import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Plan switching for users who already have an active Paddle subscription.
// Paddle Checkout cannot create a second subscription for the same customer,
// so upgrading/downgrading must go through the Subscription Update API.
// This charges/credits the existing card automatically (proration), so the
// user does NOT need to re-enter payment details.

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

const PLAN_TO_PRICE: Record<string, string | undefined> = {
  starter: process.env.PADDLE_STARTER_PRICE_ID,
  pro: process.env.PADDLE_PRO_PRICE_ID,
};

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetPlan: string | undefined = body.plan;
  if (!targetPlan || !["starter", "pro"].includes(targetPlan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const targetPriceId = PLAN_TO_PRICE[targetPlan];
  if (!targetPriceId) {
    return NextResponse.json(
      { error: `Pricing not configured for ${targetPlan}` },
      { status: 503 }
    );
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) {
      return NextResponse.json(
        { error: "No active subscription to change. Please subscribe first." },
        { status: 400 }
      );
    }

    if (user.plan === targetPlan) {
      return NextResponse.json({ error: "You are already on this plan." }, { status: 400 });
    }

    const base = paddleApiBase();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // PATCH the subscription with the new price.
    // proration_billing_mode: "prorated_immediately" charges/credits the
    // difference now and switches the plan instantly — best UX for upgrades.
    const updateRes = await fetch(`${base}/subscriptions/${subId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        items: [{ price_id: targetPriceId, quantity: 1 }],
        proration_billing_mode: "prorated_immediately",
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      console.error("[change-plan] Paddle PATCH failed:", updateRes.status, err);
      return NextResponse.json(
        {
          error: "Could not change plan. Please contact support.",
          paddleError: err?.error?.detail || err?.error?.code || null,
        },
        { status: 502 }
      );
    }

    // Webhook will eventually update plan via subscription.updated, but
    // mirror locally now so the UI flips immediately.
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: targetPlan },
    });

    return NextResponse.json({ success: true, plan: targetPlan });
  } catch (err) {
    console.error("[change-plan] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
