import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Map Paddle price IDs → plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.PADDLE_PRO_PRICE_ID || ""]: "pro",
};

function getPlanFromItems(items: any[]): string | null {
  for (const item of items || []) {
    const priceId = item.price?.id || item.price_id;
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
  }
  return null; // unknown price — do NOT overwrite plan
}

async function verifyPaddleSignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return true; // skip in dev if not configured

  const signatureHeader = req.headers.get("paddle-signature");
  if (!signatureHeader) return false;

  // Parse ts= and h1= from header
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const signedPayload = `${ts}:${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(signedPayload);

  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  return computed === h1;
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  const valid = await verifyPaddleSignature(req, body);
  if (!valid) {
    console.error("Invalid Paddle webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = event.event_type || event.notification_type || "";
  const data = event.data || {};

  console.log("Paddle webhook:", eventType, data.id);

  try {
    switch (eventType) {
      case "subscription.created":
      case "subscription.activated": {
        const customData = data.custom_data || {};
        const userId = customData.userId;
        const plan = getPlanFromItems(data.items);

        // Build update — only include plan if we successfully mapped it
        const updateData: Record<string, string> = {
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id,
          subscriptionStatus: "active",
          trialEndsAt: "",
        };
        if (plan) updateData.plan = plan;

        if (userId) {
          await prisma.user.update({ where: { id: userId }, data: updateData });
        } else if (data.customer_id) {
          const existingUser = await prisma.user.findFirst({
            where: { paddleCustomerId: data.customer_id },
          });
          if (existingUser) {
            await prisma.user.update({ where: { id: existingUser.id }, data: updateData });
          }
        }
        break;
      }

      case "subscription.updated": {
        const subId = data.id;
        const plan = getPlanFromItems(data.items);
        const status = data.status;

        const user = await prisma.user.findFirst({ where: { paddleSubscriptionId: subId } });
        if (user) {
          const updateData: Record<string, string> = { subscriptionStatus: status };
          if (plan) updateData.plan = plan;
          await prisma.user.update({ where: { id: user.id }, data: updateData });
        }
        break;
      }

      case "subscription.canceled":
      case "subscription.paused": {
        const subId = data.id;
        const user = await prisma.user.findFirst({ where: { paddleSubscriptionId: subId } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "canceled", suspended: true },
          });
        }
        break;
      }

      case "transaction.completed": {
        // One-time payment completed (if used)
        console.log("Transaction completed:", data.id);
        break;
      }

      default:
        console.log("Unhandled Paddle event:", eventType);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
