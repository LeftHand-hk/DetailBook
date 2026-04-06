import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.PADDLE_PRO_PRICE_ID || ""]: "pro",
  [process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID || ""]: "pro",
};

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { priceId, transactionId, plan: planDirect } = body;

    // Use directly passed plan name if available (most reliable)
    let plan: string | null = planDirect || null;

    // Fallback: resolve from priceId
    if (!plan && priceId) plan = PRICE_TO_PLAN[priceId] || null;

    // If we have a transactionId but no priceId resolved, try fetching from Paddle API
    if (!plan && transactionId && process.env.PADDLE_API_KEY) {
      const paddleEnv = process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production";
      const apiBase = paddleEnv === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

      const res = await fetch(`${apiBase}/transactions/${transactionId}`, {
        headers: { Authorization: `Bearer ${process.env.PADDLE_API_KEY}` },
      });

      if (res.ok) {
        const data = await res.json();
        const items = data?.data?.items || [];
        for (const item of items) {
          const pid = item?.price?.id || item?.price_id;
          if (pid && PRICE_TO_PLAN[pid]) {
            plan = PRICE_TO_PLAN[pid];
            break;
          }
        }
      }
    }

    if (!plan || !["starter", "pro"].includes(plan)) {
      return NextResponse.json({ error: "Could not determine plan" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: {
        plan,
        subscriptionStatus: "active",
        suspended: false,
        trialEndsAt: "",
      },
    });

    return NextResponse.json({ success: true, plan });
  } catch (err) {
    console.error("Activate subscription error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
