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

    if (subId && apiKey) {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      // Try immediate cancel first; fall back to end-of-period.
      let res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
        method: "POST",
        headers,
        body: JSON.stringify({ effective_from: "immediately" }),
      });

      if (!res.ok) {
        const firstErr = await res.json().catch(() => ({}));
        console.warn("[cancel] immediate rejected, trying next_billing_period:", res.status, firstErr);

        res = await fetch(`${paddleApiBase()}/subscriptions/${subId}/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify({ effective_from: "next_billing_period" }),
        });

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

    // If the in-app trial is still running, don't pull the rug out from
    // under the user — keep their dashboard live until trial end. The
    // Paddle cancel above already prevents the day-8 charge. They get
    // suspended later either by trial expiry or by the post-trial
    // subscription.canceled webhook.
    const trialEndsMs = (user as any).trialEndsAt ? Date.parse((user as any).trialEndsAt) : NaN;
    const stillInTrial = !Number.isNaN(trialEndsMs) && trialEndsMs > Date.now();

    await prisma.user.update({
      where: { id: session.id },
      data: stillInTrial
        ? { subscriptionStatus: "canceled" }
        : { suspended: true, subscriptionStatus: "canceled" },
    });

    return NextResponse.json({ success: true, keptActiveUntilTrialEnd: stillInTrial });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
