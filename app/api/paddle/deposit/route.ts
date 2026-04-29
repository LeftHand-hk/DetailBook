import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function paddleApiBase(sandbox: boolean) {
  return sandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, bookingId, amount, customerEmail, serviceName } = body;

    if (!userId || !bookingId || !amount || !customerEmail || !serviceName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const pm = user.paymentMethods as any;
    const cfg = pm?.paddle;
    if (!cfg?.enabled || !cfg?.apiKey || !cfg?.productId) {
      return NextResponse.json(
        { error: "This business has not configured Paddle" },
        { status: 503 }
      );
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== userId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const amountInCents = Math.round(amount * 100).toString();
    const apiBase = paddleApiBase(!!cfg.sandbox);

    // Paddle requires a price_id, but we can pass an ad-hoc price via `items[].price`
    // referencing the merchant's pre-created product_id with a custom unit_price.
    const txRes = await fetch(`${apiBase}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            quantity: 1,
            price: {
              description: `Deposit for ${serviceName}`,
              name: `Deposit - ${serviceName}`,
              product_id: cfg.productId,
              unit_price: { amount: amountInCents, currency_code: "USD" },
              tax_mode: "account_setting",
              quantity: { minimum: 1, maximum: 1 },
            },
          },
        ],
        customer: { email: customerEmail },
        custom_data: { type: "deposit", bookingId, userId },
        collection_mode: "automatic",
        checkout: {
          url: `${request.nextUrl.origin}/book/${user.slug}?deposit=success&bookingId=${bookingId}`,
        },
      }),
    });

    const txJson = await txRes.json();
    if (!txRes.ok) {
      console.error("Paddle deposit error:", txJson);
      return NextResponse.json(
        { error: txJson?.error?.detail || "Failed to create Paddle checkout" },
        { status: 502 }
      );
    }

    const url = txJson?.data?.checkout?.url;
    const txId = txJson?.data?.id;
    if (!url) {
      return NextResponse.json(
        { error: "Paddle did not return a checkout URL" },
        { status: 502 }
      );
    }

    // Persist the Paddle transaction id so we can verify on customer return.
    if (txId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentMethod: "paddle", paymentProof: `paddle:${txId}` },
      }).catch(() => {});
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("POST /api/paddle/deposit error:", error);
    return NextResponse.json({ error: "Failed to create deposit checkout" }, { status: 500 });
  }
}
