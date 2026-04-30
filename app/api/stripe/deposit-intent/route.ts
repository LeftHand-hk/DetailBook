import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBusinessStripe } from "@/lib/stripe";

// Creates a Stripe PaymentIntent for an embedded (modal) deposit payment.
// Returns the clientSecret which the browser uses with Stripe Elements to
// confirm the card payment in-place — no redirect to hosted Checkout.
export async function POST(request: NextRequest) {
  try {
    const { userId, bookingId, amount, customerEmail, serviceName } = await request.json();

    if (!userId || !bookingId || !amount || !customerEmail || !serviceName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const stripe = await getBusinessStripe(userId);
    if (!stripe) {
      return NextResponse.json(
        { error: "This business has not configured Stripe payments" },
        { status: 503 }
      );
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== userId) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      receipt_email: customerEmail,
      description: `Deposit for ${serviceName}`,
      automatic_payment_methods: { enabled: true },
      metadata: { type: "deposit", userId, bookingId },
    });

    // Stash the intent id on the booking so the verify endpoint can
    // re-confirm with Stripe later (e.g. if the webhook is delayed).
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentProof: `stripe:${intent.id}` },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (error) {
    console.error("POST /api/stripe/deposit-intent error:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
