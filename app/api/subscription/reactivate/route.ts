import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { paddleApiBase } from "@/lib/paddle";

const PLAN_TO_PRICE: Record<string, string | undefined> = {
  starter: process.env.PADDLE_STARTER_PRICE_ID,
  pro: process.env.PADDLE_PRO_PRICE_ID,
};

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.PADDLE_PRO_PRICE_ID || ""]: "pro",
};

function paddleApiKey(): string | null {
  const key = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
  if (!key || key === "your_paddle_api_key") return null;
  return key;
}

function planFromItems(items: any[]): string | null {
  for (const item of items || []) {
    const priceId = item.price?.id || item.price_id;
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
  }
  return null;
}

function transactionCheckoutId(tx: any): string | null {
  return tx?.id && typeof tx.id === "string" ? tx.id : null;
}

async function latestPayableTransaction(
  base: string,
  headers: { Authorization: string },
  subId: string,
): Promise<string | null> {
  const res = await fetch(
    `${base}/transactions?subscription_id=${encodeURIComponent(subId)}&status=past_due,billed,ready&order_by=billed_at[DESC]&per_page=10`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;

  const json = await res.json().catch(() => ({} as any));
  const txs: any[] = json.data || [];
  const tx =
    txs.find((t) => t.status === "past_due") ||
    txs.find((t) => t.status === "billed") ||
    txs.find((t) => t.status === "ready");
  return transactionCheckoutId(tx);
}

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
      { status: 503 },
    );
  }

  const apiKey = paddleApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) return NextResponse.json({ action: "checkout" });

    const base = paddleApiBase();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const subRes = await fetch(`${base}/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (subRes.status === 404) {
      return NextResponse.json({ action: "checkout" });
    }
    if (!subRes.ok) {
      const err = await subRes.json().catch(() => ({}));
      console.error("[reactivate] Paddle GET subscription failed:", subRes.status, err);
      return NextResponse.json(
        { error: "Could not check your subscription with Paddle." },
        { status: 502 },
      );
    }

    const subJson = await subRes.json();
    const sub = subJson.data || {};
    const status = (sub.status || "").toLowerCase();

    if (status === "active") {
      const plan = planFromItems(sub.items) || targetPlan;
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan,
          subscriptionStatus: "active",
          trialEndsAt: "",
          suspended: false,
          paddleSubscriptionId: sub.id,
          paddleCustomerId: sub.customer_id || (user as any).paddleCustomerId,
        },
        select: {
          id: true,
          email: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          suspended: true,
          paddleSubscriptionId: true,
          paddleCustomerId: true,
        },
      });
      return NextResponse.json({ action: "activated", user: updatedUser });
    }

    if (status === "trialing") {
      const currentPlan = planFromItems(sub.items);
      if (currentPlan !== targetPlan) {
        const updateRes = await fetch(`${base}/subscriptions/${subId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            items: [{ price_id: targetPriceId, quantity: 1 }],
            proration_billing_mode: "do_not_bill",
          }),
        });
        if (!updateRes.ok) {
          const err = await updateRes.json().catch(() => ({}));
          console.error("[reactivate] Paddle PATCH before activate failed:", updateRes.status, err);
          const txId = await latestPayableTransaction(base, { Authorization: `Bearer ${apiKey}` }, subId);
          return NextResponse.json({ action: txId ? "checkout_transaction" : "checkout", transactionId: txId });
        }
      }

      const activateRes = await fetch(`${base}/subscriptions/${subId}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!activateRes.ok) {
        const err = await activateRes.json().catch(() => ({}));
        console.error("[reactivate] Paddle activate failed:", activateRes.status, err);
        const txId = await latestPayableTransaction(base, { Authorization: `Bearer ${apiKey}` }, subId);
        return NextResponse.json({ action: txId ? "checkout_transaction" : "checkout", transactionId: txId });
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: targetPlan,
          subscriptionStatus: "active",
          trialEndsAt: "",
          suspended: false,
        },
        select: {
          id: true,
          email: true,
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          suspended: true,
          paddleSubscriptionId: true,
          paddleCustomerId: true,
        },
      });
      return NextResponse.json({ action: "activated", user: updatedUser });
    }

    if (status === "past_due") {
      const txId = await latestPayableTransaction(base, { Authorization: `Bearer ${apiKey}` }, subId);
      if (txId) return NextResponse.json({ action: "checkout_transaction", transactionId: txId });

      return NextResponse.json({
        action: "checkout",
        reason: "past_due_without_payable_transaction",
      });
    }

    return NextResponse.json({ action: "checkout", status });
  } catch (err) {
    console.error("[reactivate] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
