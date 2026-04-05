import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getPlatformStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !["starter", "pro"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'starter' or 'pro'" },
        { status: 400 }
      );
    }

    const stripe = await getPlatformStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please contact the administrator." },
        { status: 503 }
      );
    }

    const settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      return NextResponse.json(
        { error: "Platform settings not found" },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine the price amount in cents based on the plan
    const priceAmount =
      plan === "pro"
        ? Math.round(settings.proPrice * 100)
        : Math.round(settings.starterPrice * 100);

    const planLabel = plan === "pro" ? "Pro" : "Starter";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            product_data: {
              name: `DetailBook ${planLabel} Plan`,
              description: `Monthly subscription to DetailBook ${planLabel}`,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "subscription",
        userId: user.id,
        plan,
      },
      success_url: `${request.nextUrl.origin}/dashboard/settings?subscription=success`,
      cancel_url: `${request.nextUrl.origin}/dashboard/settings?subscription=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("POST /api/stripe/subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to create subscription checkout session" },
      { status: 500 }
    );
  }
}
