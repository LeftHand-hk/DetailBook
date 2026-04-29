import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function squareApiBase(sandbox: boolean) {
  return sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, bookingId, amount, customerEmail, serviceName } = body;

    if (!userId || !bookingId || !amount || !customerEmail || !serviceName) {
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

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== userId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const amountInCents = Math.round(amount * 100);
    const apiBase = squareApiBase(!!cfg.sandbox);

    // Square's online-checkout payment-links API creates a hosted checkout page.
    // reference_id lets us tie the payment back to the booking via webhook.
    const linkRes = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-11-20",
      },
      body: JSON.stringify({
        idempotency_key: `${bookingId}-${Date.now()}`,
        quick_pay: {
          name: `Deposit for ${serviceName}`,
          price_money: { amount: amountInCents, currency: "USD" },
          location_id: cfg.locationId,
        },
        checkout_options: {
          redirect_url: `${request.nextUrl.origin}/book/${user.slug}?deposit=success&bookingId=${bookingId}`,
          ask_for_shipping_address: false,
        },
        pre_populated_data: {
          buyer_email: customerEmail,
        },
        payment_note: `Booking ${bookingId}`,
      }),
    });

    const linkJson = await linkRes.json();
    if (!linkRes.ok) {
      console.error("Square deposit error:", linkJson);
      return NextResponse.json(
        { error: linkJson?.errors?.[0]?.detail || "Failed to create Square checkout" },
        { status: 502 }
      );
    }

    const url = linkJson?.payment_link?.url;
    const orderId = linkJson?.payment_link?.order_id;
    if (!url) {
      return NextResponse.json({ error: "Square did not return a checkout URL" }, { status: 502 });
    }

    // Persist the Square order_id on the booking so the webhook can match it.
    if (orderId) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentMethod: "square", paymentProof: `square:${orderId}` },
      }).catch(() => {});
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("POST /api/square/deposit error:", error);
    return NextResponse.json({ error: "Failed to create deposit checkout" }, { status: 500 });
  }
}
