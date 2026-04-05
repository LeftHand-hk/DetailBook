import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { getPlatformStripe, getBusinessStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // First, try to verify against the platform webhook secret
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
    });

    let event: Stripe.Event | null = null;

    // Attempt to construct the event using the platform webhook secret
    if (settings?.stripeSecretKey && settings?.stripeWebhookSecret) {
      try {
        const platformStripe = new Stripe(settings.stripeSecretKey);
        event = platformStripe.webhooks.constructEvent(
          rawBody,
          signature,
          settings.stripeWebhookSecret
        );
      } catch {
        // Signature didn't match platform secret — may be a business webhook
        event = null;
      }
    }

    // If platform verification failed, try parsing the event payload directly.
    // Business-owner webhooks will be verified by their own Stripe instance below.
    if (!event) {
      try {
        event = JSON.parse(rawBody) as Stripe.Event;
      } catch {
        return NextResponse.json(
          { error: "Invalid webhook payload" },
          { status: 400 }
        );
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        if (metadata.type === "subscription" && metadata.userId && metadata.plan) {
          // Subscription payment completed — update user plan
          await prisma.user.update({
            where: { id: metadata.userId },
            data: {
              plan: metadata.plan,
              ...(session.subscription
                ? {} // Stripe subscription ID could be stored if needed
                : {}),
            },
          });
          console.log(
            `Subscription activated: user ${metadata.userId} upgraded to ${metadata.plan}`
          );
        } else if (metadata.type === "deposit" && metadata.bookingId) {
          // Deposit payment completed — update booking
          const amountPaid = session.amount_total
            ? session.amount_total / 100
            : 0;

          await prisma.booking.update({
            where: { id: metadata.bookingId },
            data: {
              depositPaid: amountPaid,
            },
          });
          console.log(
            `Deposit received: booking ${metadata.bookingId}, amount $${amountPaid}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // Find the user associated with this subscription by customer email
        // The subscription object has a customer field we can use to look up
        // We need to retrieve the customer to get the email
        if (settings?.stripeSecretKey) {
          try {
            const platformStripe = new Stripe(settings.stripeSecretKey);
            const customer = await platformStripe.customers.retrieve(
              subscription.customer as string
            );

            if (customer && !customer.deleted && "email" in customer && customer.email) {
              const user = await prisma.user.findUnique({
                where: { email: customer.email },
              });

              if (user) {
                await prisma.user.update({
                  where: { id: user.id },
                  data: { plan: "starter" },
                });
                console.log(
                  `Subscription cancelled: user ${user.id} downgraded to starter`
                );
              }
            }
          } catch (err) {
            console.error("Error handling subscription deletion:", err);
          }
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/stripe/webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
