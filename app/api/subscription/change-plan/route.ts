import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Plan switching for users who already have an active Paddle subscription.
// Paddle Checkout cannot create a second subscription for the same customer,
// so upgrading/downgrading must go through the Subscription Update API.
// This charges/credits the existing card automatically (proration), so the
// user does NOT need to re-enter payment details.

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

const PLAN_TO_PRICE: Record<string, string | undefined> = {
  starter: process.env.PADDLE_STARTER_PRICE_ID,
  pro: process.env.PADDLE_PRO_PRICE_ID,
};

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetPlan: string | undefined = body.plan;
  if (!targetPlan || !["starter", "pro"].includes(targetPlan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const discountCode: string | undefined = body.discountCode?.trim() || undefined;

  const targetPriceId = PLAN_TO_PRICE[targetPlan];
  if (!targetPriceId) {
    return NextResponse.json(
      { error: `Pricing not configured for ${targetPlan}` },
      { status: 503 }
    );
  }

  // Clean the key aggressively — common paste issues:
  // surrounding quotes, leading/trailing whitespace, stray newlines.
  const apiKey = process.env.PADDLE_API_KEY
    ?.replace(/^["']|["']$/g, "")
    ?.trim();
  if (apiKey) {
    console.log(
      "[change-plan] paddle key shape",
      JSON.stringify({
        len: apiKey.length,
        prefix: apiKey.slice(0, 14),
        suffix: apiKey.slice(-4),
        hasInternalWhitespace: /\s/.test(apiKey),
      })
    );
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    if (!subId) {
      return NextResponse.json(
        { error: "No active subscription to change. Please subscribe first." },
        { status: 400 }
      );
    }

    const base = paddleApiBase();
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Check current sub status — Paddle restricts changes during trial.
    // For trialing subs we must use proration_billing_mode: "do_not_bill"
    // (no charge now; new plan price kicks in when trial ends).
    let isTrialing = false;
    try {
      const subInfoRes = await fetch(`${base}/subscriptions/${subId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (subInfoRes.ok) {
        const subInfo = await subInfoRes.json();
        isTrialing = subInfo?.data?.status === "trialing";
      }
    } catch (e) {
      console.warn("[change-plan] could not fetch sub status, assuming non-trial:", e);
    }

    // Resolve discount code → discount ID via Paddle API.
    // Paddle's PATCH subscription accepts only the ID, not the code.
    // We list with no status filter (Paddle's `code` filter is case-sensitive
    // and `status=active` excludes "scheduled" codes that are valid right
    // now), then match case-insensitively client-side.
    let discountId: string | null = null;
    if (discountCode) {
      try {
        const dRes = await fetch(
          `${base}/discounts?per_page=200`,
          { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
        );
        if (!dRes.ok) {
          const err = await dRes.json().catch(() => ({}));
          console.error("[change-plan] Paddle GET /discounts failed:", dRes.status, err);
          return NextResponse.json(
            { error: "Could not verify promo code. Please try again." },
            { status: 502 }
          );
        }
        const dJson = await dRes.json();
        const all: any[] = dJson.data || [];
        const matchCode = discountCode.toUpperCase();
        const candidates = all.filter(
          (d) => (d.code || "").toUpperCase() === matchCode
        );

        console.log(
          "[change-plan] discount lookup",
          JSON.stringify({
            queried: discountCode,
            totalDiscounts: all.length,
            matches: candidates.map((d) => ({ id: d.id, code: d.code, status: d.status })),
          })
        );

        // Prefer an active discount; fall back to any non-archived/expired one
        const usable = candidates.find((d) => d.status === "active")
          || candidates.find((d) => !["archived", "expired"].includes(d.status));

        if (!usable) {
          if (candidates.length > 0) {
            return NextResponse.json(
              {
                error: `Promo code "${discountCode}" exists but is not currently usable (status: ${candidates[0].status}).`,
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { error: `Promo code "${discountCode}" was not found in this Paddle environment.` },
            { status: 400 }
          );
        }
        discountId = usable.id;
      } catch (e) {
        console.error("[change-plan] discount lookup failed:", e);
        return NextResponse.json(
          { error: "Could not verify promo code. Please try again." },
          { status: 502 }
        );
      }
    }

    const isPlanChange = user.plan !== targetPlan;

    // Skip PATCH entirely if user is already on the target plan AND
    // there's no discount to apply (e.g. trialing user clicking
    // "Subscribe" on their current plan — we just need to activate).
    if (isPlanChange || discountId) {
      const patchBody: any = {};
      if (isPlanChange) {
        patchBody.items = [{ price_id: targetPriceId, quantity: 1 }];
        patchBody.proration_billing_mode = isTrialing ? "do_not_bill" : "prorated_immediately";
      }
      if (discountId) {
        // Paddle restriction: discounts on trialing subs MUST use
        // next_billing_period — they kick in when trial ends. We
        // activate right after, which IS that next billing.
        patchBody.discount = {
          id: discountId,
          effective_from: isTrialing ? "next_billing_period" : "immediately",
        };
      }

      const updateRes = await fetch(`${base}/subscriptions/${subId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patchBody),
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        console.error("[change-plan] Paddle PATCH failed:", updateRes.status, err);
        const detail = err?.error?.detail || err?.error?.code || err?.error?.type;
        return NextResponse.json(
          {
            error: detail
              ? `Paddle rejected the change: ${detail}`
              : "Could not change plan. Please contact support.",
          },
          { status: 502 }
        );
      }
    }

    // If the user was trialing, end their trial NOW so they're billed
    // immediately on the (possibly new) plan. This also makes the
    // scheduled discount/plan change kick in right away — Paddle
    // treats /activate as starting the next billing cycle.
    if (isTrialing) {
      const activateRes = await fetch(`${base}/subscriptions/${subId}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!activateRes.ok) {
        const err = await activateRes.json().catch(() => ({}));
        console.error("[change-plan] activate failed:", activateRes.status, err);
        const detail = err?.error?.detail || err?.error?.code;
        return NextResponse.json(
          {
            error: detail
              ? `Paddle could not end trial: ${detail}`
              : "Could not start billing. Please contact support.",
          },
          { status: 502 }
        );
      }
      console.log("[change-plan] ended trial for user", user.id, "sub", subId);
    }

    // Verify with Paddle: the PATCH may have either applied the change
    // immediately (prorated_immediately) OR scheduled it for the next
    // period (do_not_bill, used during trial). Either way, Paddle is
    // the source of truth — read back what it actually decided.
    let paddleVerified = false;
    try {
      const verifyRes = await fetch(`${base}/subscriptions/${subId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (verifyRes.ok) {
        const verifyJson = await verifyRes.json();
        const subData = verifyJson?.data || {};
        const currentItems: any[] = subData.items || [];
        const scheduledItems: any[] = subData.scheduled_change?.items || [];
        const itemsToCheck = scheduledItems.length > 0 ? scheduledItems : currentItems;
        const hasTargetPrice = itemsToCheck.some(
          (i: any) => (i.price?.id || i.price_id) === targetPriceId
        );
        if (hasTargetPrice) {
          paddleVerified = true;
        } else {
          console.warn(
            "[change-plan] Paddle PATCH returned 2xx but verification did NOT find target price",
            JSON.stringify({
              targetPriceId,
              currentItemsPriceIds: currentItems.map((i) => i.price?.id || i.price_id),
              scheduledItemsPriceIds: scheduledItems.map((i) => i.price?.id || i.price_id),
            })
          );
        }
      } else {
        console.warn("[change-plan] verification GET failed:", verifyRes.status);
      }
    } catch (e) {
      console.warn("[change-plan] verification GET threw:", e);
    }

    // Mirror locally so the UI flips immediately. Webhook will reconcile
    // any drift later. If we ended a trial above, also clear the trial
    // marker and flip status to active so the dashboard stops showing
    // the trial banner.
    const localUpdate: Record<string, any> = { plan: targetPlan };
    if (isTrialing) {
      localUpdate.trialEndsAt = "";
      localUpdate.subscriptionStatus = "active";
    }
    await prisma.user.update({
      where: { id: user.id },
      data: localUpdate,
    });

    return NextResponse.json({
      success: true,
      plan: targetPlan,
      verified: paddleVerified,
      scheduledForTrialEnd: isTrialing,
    });
  } catch (err) {
    console.error("[change-plan] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
