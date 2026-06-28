import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function paddleApiBase() {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId as string | null;
    const apiKey = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();

    if (subId && !apiKey) {
      return NextResponse.json(
        { error: "Payment system is temporarily unavailable. Your subscription was not canceled." },
        { status: 503 }
      );
    }

    let effectiveFrom: "next_billing_period" | "immediately" = "next_billing_period";

    if (subId && apiKey) {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      // Cancel at the END of the current billing period so a paying
      // customer keeps the access they've already paid for. Only fall back
      // to an immediate cancel if Paddle rejects the scheduled one.
      let res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      });

      if (!res.ok) {
        const firstErr = await res.json().catch(() => ({}));
        console.warn("[cancel] next_billing_period rejected, trying immediately:", res.status, firstErr);

        res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify({ effective_from: "immediately" }),
        });
        effectiveFrom = "immediately";

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[cancel] both attempts failed:", res.status, err);
          const detail = err?.error?.detail || firstErr?.error?.detail || err?.error?.code;
          return NextResponse.json(
            {
              error: detail
                ? `Paddle: ${detail}`
                : "Could not cancel subscription with Paddle.",
            },
            { status: 502 }
          );
        }
      }
    }

    // If the in-app trial is still running, keep the dashboard live until
    // trial end. The Paddle cancel above already prevents the first charge.
    const trialEndsMs = (user as any).trialEndsAt ? Date.parse((user as any).trialEndsAt) : NaN;
    const stillInTrial = !Number.isNaN(trialEndsMs) && trialEndsMs > Date.now();

    // Decide local state. A paying customer who cancels at period end keeps
    // BOTH their dashboard and their public booking page until that date —
    // the subscription.canceled webhook suspends them when the period
    // actually ends. We only suspend immediately when access truly ends
    // now: an immediate Paddle cancel, or an account with no Paddle
    // subscription whose period end we can't track.
    const keepActive =
      stillInTrial ||
      (Boolean(subId) && effectiveFrom === "next_billing_period");

    await prisma.user.update({
      where: { id: session.id },
      data: keepActive
        ? { subscriptionStatus: "canceled" }
        : { suspended: true, subscriptionStatus: "canceled" },
    });

    return NextResponse.json({
      success: true,
      keptActiveUntilTrialEnd: stillInTrial,
      keptActiveUntilPeriodEnd: keepActive && !stillInTrial,
    });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
