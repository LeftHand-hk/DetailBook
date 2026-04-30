import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

function squareApiBase(sandbox: boolean) {
  return sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
}

// Charges a card token (sourceId) produced by the Square Web Payments SDK.
// Called from the embedded modal — booking is created only after this succeeds.
export async function POST(request: NextRequest) {
  try {
    const { userId, sourceId, amount, customerEmail, serviceName } = await request.json();

    if (!userId || !sourceId || !amount || !serviceName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const pm = user.paymentMethods as any;
    const cfg = pm?.square;
    if (!cfg?.enabled || !cfg?.accessToken || !cfg?.locationId) {
      return NextResponse.json(
        { error: "This business has not configured Square" },
        { status: 503 }
      );
    }

    const apiBase = squareApiBase(!!cfg.sandbox);
    const amountInCents = Math.round(amount * 100);

    const r = await fetch(`${apiBase}/v2/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify({
        idempotency_key: randomUUID(),
        source_id: sourceId,
        amount_money: { amount: amountInCents, currency: "USD" },
        location_id: cfg.locationId,
        buyer_email_address: customerEmail || undefined,
        note: `Deposit for ${serviceName}`,
        autocomplete: true,
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      console.error("[Square charge] error:", j);
      const detail = j?.errors?.[0]?.detail || j?.errors?.[0]?.code || "Card was declined";
      return NextResponse.json({ error: detail }, { status: 402 });
    }

    const payment = j?.payment;
    const status = payment?.status;
    if (status !== "COMPLETED" && status !== "APPROVED" && status !== "CAPTURED") {
      return NextResponse.json(
        { error: `Square returned unexpected status: ${status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      status,
    });
  } catch (error) {
    console.error("POST /api/square/charge error:", error);
    return NextResponse.json({ error: "Failed to charge card" }, { status: 500 });
  }
}
