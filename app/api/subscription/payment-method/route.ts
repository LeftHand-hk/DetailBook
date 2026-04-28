import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) return NextResponse.json({ card: null });

    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) return NextResponse.json({ card: null });

    const res = await fetch(`${paddleApiBase()}/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Paddle GET subscription error:", err);
      return NextResponse.json({ card: null });
    }

    const json = await res.json();
    const sub = json.data || {};
    const pm = sub.payment_method || sub.payment_information || null;
    const card = pm?.card || pm?.payment_method?.card || null;

    if (!card) {
      return NextResponse.json({
        card: null,
        nextBilledAt: sub.next_billed_at || null,
        status: sub.status || null,
      });
    }

    return NextResponse.json({
      card: {
        brand: card.type || card.brand || null,
        last4: card.last4 || null,
        expMonth: card.expiry_month ?? card.exp_month ?? null,
        expYear: card.expiry_year ?? card.exp_year ?? null,
      },
      nextBilledAt: sub.next_billed_at || null,
      status: sub.status || null,
    });
  } catch (err) {
    console.error("GET payment-method error:", err);
    return NextResponse.json({ card: null });
  }
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Payment system not configured" }, { status: 500 });
    }

    const res = await fetch(
      `${paddleApiBase()}/subscriptions/${subId}/update-payment-method-transaction`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Paddle update-payment-method error:", err);
      return NextResponse.json({ error: "Could not start card update" }, { status: 502 });
    }

    const json = await res.json();
    const transactionId = json.data?.id;
    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID missing" }, { status: 502 });
    }

    return NextResponse.json({ transactionId });
  } catch (err) {
    console.error("POST payment-method error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
