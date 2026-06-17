import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getBusinessStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, bookingId } = body;

    if (!userId || !bookingId) {
      return NextResponse.json(
        { error: "Missing required fields: userId, bookingId" },
        { status: 400 }
      );
    }

    const stripe = await getBusinessStripe(userId);
    if (!stripe) {
      return NextResponse.json(
        { error: "This business has not configured Stripe payments" },
        { status: 503 }
      );
    }

    // Look up the business owner to get their slug for redirect URLs
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slug: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Verify the booking exists and belongs to this business
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.userId !== userId) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.depositRequired <= 0) {
      return NextResponse.json({ error: "This booking does not require a deposit" }, { status: 400 });
    }
    if (booking.depositPaid >= booking.depositRequired) {
      return NextResponse.json({ error: "This booking deposit is already paid" }, { status: 409 });
    }

    const amountInCents = Math.round(booking.depositRequired * 100);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: booking.customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Deposit for ${booking.serviceName}`,
              description: `Booking deposit for ${booking.serviceName}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "deposit",
        userId,
        bookingId,
      },
      success_url: `${request.nextUrl.origin}/book/${user.slug}?deposit=success&bookingId=${bookingId}`,
      cancel_url: `${request.nextUrl.origin}/book/${user.slug}?deposit=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("POST /api/stripe/deposit error:", error);
    return NextResponse.json(
      { error: "Failed to create deposit checkout session" },
      { status: 500 }
    );
  }
}
