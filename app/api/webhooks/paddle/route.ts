import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Map Paddle price IDs → plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.PADDLE_PRO_PRICE_ID || ""]: "pro",
};

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

async function fetchPaddleCustomerEmail(customerId: string): Promise<string | null> {
  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const r = await fetch(`${paddleApiBase()}/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.email || null;
  } catch {
    return null;
  }
}

function getPlanFromItems(items: any[]): string | null {
  for (const item of items || []) {
    const priceId = item.price?.id || item.price_id;
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
  }
  return null; // unknown price — do NOT overwrite plan
}

async function verifyPaddleSignature(
  req: NextRequest,
  body: string
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Paddle webhook] PADDLE_WEBHOOK_SECRET is NOT set — accepting unsigned requests (dev mode).");
    return { ok: true, reason: "no_secret_configured" };
  }

  const signatureHeader = req.headers.get("paddle-signature");
  if (!signatureHeader) {
    return { ok: false, reason: "missing_paddle_signature_header" };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return { ok: false, reason: "malformed_signature_header" };

  const signedPayload = `${ts}:${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(signedPayload);

  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (computed !== h1) {
    return { ok: false, reason: "signature_mismatch — secret in Netlify env does NOT match Paddle Dashboard destination secret" };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const body = await req.text();
  const sigHeader = req.headers.get("paddle-signature");

  console.log(
    "[Paddle webhook] incoming POST",
    JSON.stringify({
      bodyLen: body.length,
      hasSignature: Boolean(sigHeader),
      hasSecret: Boolean(process.env.PADDLE_WEBHOOK_SECRET),
      ua: req.headers.get("user-agent"),
    })
  );

  const verification = await verifyPaddleSignature(req, body);
  if (!verification.ok) {
    console.error("[Paddle webhook] signature verification FAILED:", verification.reason);
    return NextResponse.json({ error: "Invalid signature", reason: verification.reason }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    console.error("[Paddle webhook] invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = event.event_type || event.notification_type || "";
  const data = event.data || {};

  console.log(
    "[Paddle webhook] event",
    JSON.stringify({
      eventType,
      id: data.id,
      customerId: data.customer_id,
      customUserId: data.custom_data?.userId,
      status: data.status,
      itemPriceIds: (data.items || []).map((i: any) => i.price?.id || i.price_id),
      knownStarter: process.env.PADDLE_STARTER_PRICE_ID || "(unset)",
      knownPro: process.env.PADDLE_PRO_PRICE_ID || "(unset)",
    })
  );

  try {
    switch (eventType) {
      case "subscription.created":
      case "subscription.activated": {
        const customData = data.custom_data || {};
        const userId = customData.userId;
        const plan = getPlanFromItems(data.items);

        const updateData: Record<string, any> = {
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id,
          subscriptionStatus: "active",
          trialEndsAt: "",
          suspended: false,
        };
        if (plan) updateData.plan = plan;

        let updatedUserId: string | null = null;
        // Track whether this user is reactivating (was previously canceled).
        // If so we end Paddle's trial below so they're billed immediately.
        let wasSuspended = false;

        if (userId) {
          try {
            const before = await prisma.user.findUnique({ where: { id: userId } });
            wasSuspended = before?.suspended === true;
            await prisma.user.update({ where: { id: userId }, data: updateData });
            updatedUserId = userId;
          } catch (e) {
            console.warn("[Paddle webhook] update by custom_data.userId failed, trying customer_id:", e);
          }
        }

        if (!updatedUserId && data.customer_id) {
          let existingUser = await prisma.user.findFirst({
            where: { paddleCustomerId: data.customer_id },
          });

          // Fallback: if customer was never linked, look up by email via Paddle
          if (!existingUser) {
            const email = await fetchPaddleCustomerEmail(data.customer_id);
            if (email) {
              existingUser = await prisma.user.findUnique({ where: { email } });
              if (existingUser) {
                console.log("[Paddle webhook] matched user by Paddle customer email:", email);
              }
            }
          }

          if (existingUser) {
            wasSuspended = existingUser.suspended === true;
            await prisma.user.update({ where: { id: existingUser.id }, data: updateData });
            updatedUserId = existingUser.id;
          }
        }

        if (!updatedUserId) {
          console.error(
            "[Paddle webhook] activation event received but NO user matched —",
            JSON.stringify({
              userIdFromCustomData: userId,
              customerId: data.customer_id,
              subId: data.id,
            })
          );
        } else {
          console.log("[Paddle webhook] activated user", updatedUserId, "plan=", plan || "(unchanged)");
        }

        // Always end Paddle's trial immediately when a subscription is
        // created via our paid checkout (post-trial upgrade). Reasoning:
        // the 7-day in-app trial is managed by us; once a user reaches
        // checkout and enters payment, they intend to pay — Paddle's
        // price-config trial would just be a second free window, which
        // is not what we want. /activate triggers the first billing
        // right now.
        if (data.status === "trialing") {
          try {
            const apiKey = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
            if (apiKey) {
              const res = await fetch(`${paddleApiBase()}/subscriptions/${data.id}/activate`, {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}` },
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn("[Paddle webhook] /activate failed:", res.status, err);
              } else {
                console.log(
                  "[Paddle webhook] ended Paddle trial",
                  JSON.stringify({ userId: updatedUserId, wasSuspended })
                );
              }
            }
          } catch (e) {
            console.warn("[Paddle webhook] /activate threw:", e);
          }
        }
        break;
      }

      case "subscription.updated": {
        const subId = data.id;
        const status = data.status;

        // When a plan switch is made on a trialing sub, Paddle uses
        // proration_billing_mode: "do_not_bill" which SCHEDULES the
        // new price for the next billing cycle rather than applying
        // it immediately. In that case, data.items still shows the
        // OLD price and data.scheduled_change.items shows the NEW.
        // Prefer the scheduled change so we don't revert the user's
        // plan back to whatever Paddle is currently billing for.
        const scheduledItems: any[] = data.scheduled_change?.items || [];
        const plan = scheduledItems.length > 0
          ? getPlanFromItems(scheduledItems)
          : getPlanFromItems(data.items);

        const user = await prisma.user.findFirst({ where: { paddleSubscriptionId: subId } });
        if (user) {
          const updateData: Record<string, string> = { subscriptionStatus: status };
          if (plan) updateData.plan = plan;
          await prisma.user.update({ where: { id: user.id }, data: updateData });
          console.log(
            "[Paddle webhook] subscription.updated applied",
            JSON.stringify({
              userId: user.id,
              status,
              plan: plan || "(unchanged)",
              source: scheduledItems.length > 0 ? "scheduled_change" : "items",
            })
          );
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
    console.error("[Paddle webhook] handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  console.log("[Paddle webhook] handled in", Date.now() - startedAt, "ms");
  return NextResponse.json({ received: true });
}
