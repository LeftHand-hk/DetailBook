import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentFailedEmail } from "@/lib/welcome-emails";

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
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Paddle webhook] PADDLE_WEBHOOK_SECRET is not set; allowing local development request.");
      return { ok: true, reason: "no_secret_configured_dev" };
    }
    return { ok: false, reason: "webhook_secret_not_configured" };
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
  const timestampMs = Number(ts) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return { ok: false, reason: "signature_timestamp_outside_tolerance" };
  }

  const signedPayload = `${ts}:${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(signedPayload);

  if (!/^[0-9a-f]{64}$/i.test(h1)) return { ok: false, reason: "malformed_signature_digest" };
  const supplied = Uint8Array.from(h1.match(/.{2}/g)!, (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, supplied, msgData);

  if (!valid) {
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
        const fromOnboarding = customData.source === "onboarding";
        const plan = getPlanFromItems(data.items);
        const isPaddleTrial = data.status === "trialing";

        // Resolve the user first so we can branch on whether they're
        // already mid in-app-trial vs reactivating after a cancel.
        //
        // `hadPriorSubscription` is the only reliable "is this the user's
        // first subscription" signal we have. It comes from a server-side
        // column we control; the client-passed `customData.source` flag
        // can vanish (a customer refreshes mid-checkout, a Paddle quirk
        // strips it, etc.) and we used to fall through to "no trial -
        // charge immediately" in that case. Now the trial decision rides
        // on whether the user has ever been linked to a Paddle sub before,
        // which is exactly what distinguishes a first-time signup from a
        // re-subscribe.
        let resolvedUser: { id: string; suspended: boolean; trialEndsAt: string | null; hadPriorSubscription: boolean } | null = null;

        if (userId) {
          const u = await prisma.user.findUnique({ where: { id: userId } });
          if (u) resolvedUser = {
            id: u.id,
            suspended: u.suspended === true,
            trialEndsAt: (u as any).trialEndsAt || null,
            hadPriorSubscription: Boolean((u as any).paddleSubscriptionId),
          };
        }

        if (!resolvedUser && data.customer_id) {
          let existingUser = await prisma.user.findFirst({
            where: { paddleCustomerId: data.customer_id },
          });
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
            resolvedUser = {
              id: existingUser.id,
              suspended: existingUser.suspended === true,
              trialEndsAt: (existingUser as any).trialEndsAt || null,
              hadPriorSubscription: Boolean((existingUser as any).paddleSubscriptionId),
            };
          }
        }

        if (!resolvedUser) {
          console.error(
            "[Paddle webhook] activation event received but NO user matched —",
            JSON.stringify({
              userIdFromCustomData: userId,
              customerId: data.customer_id,
              subId: data.id,
            })
          );
          break;
        }

        const inAppTrialEnds = resolvedUser.trialEndsAt ? Date.parse(resolvedUser.trialEndsAt) : NaN;
        const inAppTrialActive = !Number.isNaN(inAppTrialEnds) && inAppTrialEnds > Date.now();

        // Only the user's FIRST subscription rides Paddle's trial. Every
        // resubscribe path (after expiry, reactivation from billing,
        // plan switch) hits the /activate call below and is charged on
        // the spot. We DON'T gate this on `fromOnboarding` anymore: that
        // flag is set in customData by the onboarding checkout, and we
        // had at least one fresh signup land in the wrong branch because
        // customData didn't reach the webhook (likely a mid-checkout
        // refresh) — the user was charged on day 0 instead of getting
        // their 7-day trial. `hadPriorSubscription` is server-side state
        // we control, so it can't be lost by a client quirk: false on
        // the first signup, true on every re-subscribe afterwards.
        const letPaddleTrialRun = isPaddleTrial && inAppTrialActive && !resolvedUser.hadPriorSubscription;

        let effectiveStatus = data.status;
        if (isPaddleTrial && !letPaddleTrialRun) {
          try {
            const apiKey = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
            if (apiKey) {
              const res = await fetch(`${paddleApiBase()}/subscriptions/${data.id}/activate`, {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}` },
              });
              if (res.ok) {
                effectiveStatus = "active";
                console.log("[Paddle webhook] ended Paddle trial for", resolvedUser.id);
              } else {
                const err = await res.json().catch(() => ({}));
                console.warn("[Paddle webhook] /activate failed:", res.status, err);
              }
            }
          } catch (e) {
            console.warn("[Paddle webhook] /activate threw:", e);
          }
        }

        const updateData: Record<string, any> = {
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id,
        };
        if (plan) updateData.plan = plan;

        if (effectiveStatus === "trialing" && letPaddleTrialRun) {
          updateData.suspended = false;
          updateData.subscriptionStatus = "trialing";
          // Align the in-app trial end with Paddle's ACTUAL first-charge
          // date so the two can never drift. The Paddle trial length is set
          // on the price and may differ from our default 7 days; if we kept
          // our own date, the app would lock the user out (or expect a
          // charge) on a different day than Paddle actually bills. Paddle's
          // `next_billed_at` is exactly when it auto-charges the saved card
          // and flips the subscription to active.
          const paddleTrialEnd = data.next_billed_at || data.current_billing_period?.ends_at;
          if (paddleTrialEnd) updateData.trialEndsAt = new Date(paddleTrialEnd).toISOString();
        } else if (effectiveStatus === "active") {
          updateData.suspended = false;
          updateData.subscriptionStatus = "active";
          updateData.trialEndsAt = "";
        } else {
          updateData.subscriptionStatus = effectiveStatus;
        }

        await prisma.user.update({ where: { id: resolvedUser.id }, data: updateData });
        console.log(
          "[Paddle webhook] linked subscription",
          JSON.stringify({
            userId: resolvedUser.id,
            plan: plan || "(unchanged)",
            paddleStatus: data.status,
            mode: letPaddleTrialRun ? "let_paddle_trial_run" : "activate_immediately",
            inAppTrialActive,
            hadPriorSubscription: resolvedUser.hadPriorSubscription,
            fromOnboarding, // logged for diagnostics; not used as a gate
          })
        );

        // The hourly cron sends day 1 after Paddle can confirm the subscription
        // is trialing. Keeping SMTP work out of the webhook prevents Paddle
        // retries and duplicate delivery when a serverless request is cut off.

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
          // Sticky cancel: when the owner clicks Cancel, Paddle keeps
          // the subscription visible as "trialing" or "active" until
          // the end of the trial / billing period and fires several
          // subscription.updated events along the way. If we let those
          // overwrite our local "canceled" status, the dashboard would
          // resurrect the user — exactly what the "cancel then refresh
          // shows Active again" bug looked like. Skip the update once
          // we've recorded a cancel.
          const localStatus = (user.subscriptionStatus || "").toLowerCase();
          if (localStatus === "canceled") {
            console.log(
              "[Paddle webhook] subscription.updated ignored — user already canceled",
              JSON.stringify({ userId: user.id, paddleStatus: status })
            );
          } else {
            const updateData: Record<string, any> = { subscriptionStatus: status };
            if (plan) updateData.plan = plan;
            if (status === "active" || status === "trialing") {
              updateData.suspended = false;
            } else if (status === "past_due" || status === "paused" || status === "canceled") {
              updateData.suspended = true;
            }
            // Keep the in-app trial window aligned with Paddle through the
            // whole lifecycle: once Paddle charges and the sub goes active,
            // clear the trial; while still trialing, mirror Paddle's
            // next-charge date (it can shift if the trial is extended).
            if (status === "active") {
              updateData.trialEndsAt = "";
            } else if (status === "trialing") {
              const end = data.next_billed_at || data.current_billing_period?.ends_at;
              if (end) updateData.trialEndsAt = new Date(end).toISOString();
            }
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
        }
        break;
      }

      case "subscription.canceled": {
        const subId = data.id;
        const user = await prisma.user.findFirst({ where: { paddleSubscriptionId: subId } });
        if (user) {
          // If the local status was already "canceled" the user clicked
          // Cancel themselves and got their confirmation in the billing
          // UI — no need to email them again. Anything else means Paddle
          // canceled automatically (failed trial-end charge), so send
          // the "we couldn't charge your card" notice.
          const wasUserInitiated = (user.subscriptionStatus || "").toLowerCase() === "canceled";
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "canceled", suspended: true },
            select: { id: true },
          });
          if (!wasUserInitiated) {
            const failedEmail = await sendPaymentFailedEmail(user.id);
            if (!failedEmail.success && failedEmail.error !== "already_sent") {
              console.error("[Paddle webhook] payment-failed email send failed:", failedEmail.error);
            }
          }
        }
        break;
      }
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
