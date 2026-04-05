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

    const stripe = await getPlatformStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please contact the administrator." },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the Stripe customer by email
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No Stripe customer found. You may not have an active subscription." },
        { status: 404 }
      );
    }

    const customer = customers.data[0];

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${request.nextUrl.origin}/dashboard/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("POST /api/stripe/portal error:", error);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
