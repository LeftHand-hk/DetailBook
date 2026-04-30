import { NextRequest, NextResponse } from "next/server";
import { getBusinessStripe } from "@/lib/stripe";

// Creates a Stripe PaymentIntent for an embedded (modal) deposit payment.
// We deliberately do NOT require a bookingId — the booking is created only
// AFTER the payment succeeds, so abandoning the modal leaves no orphan rows.
export async function POST(request: NextRequest) {
  try {
    const { userId, amount, customerEmail, serviceName } = await request.json();

    if (!userId || !amount || !customerEmail || !serviceName) {
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

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      receipt_email: customerEmail,
      description: `Deposit for ${serviceName}`,
      automatic_payment_methods: { enabled: true },
      metadata: { type: "deposit", userId },
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
