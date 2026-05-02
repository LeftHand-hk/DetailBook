import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const subId = (user as any).paddleSubscriptionId;

    // Cancel in Paddle if they have an active subscription
    if (subId) {
      const paddleEnv = process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production";
      const apiBase = paddleEnv === "sandbox"
        ? "https://sandbox-api.paddle.com"
        : "https://api.paddle.com";

      const res = await fetch(`${apiBase}/subscriptions/${subId}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PADDLE_API_KEY?.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Paddle cancel error:", err);
        // Continue anyway — still suspend locally
      }
    }

    // Suspend account locally
    await prisma.user.update({
      where: { id: session.id },
      data: {
        suspended: true,
        subscriptionStatus: "canceled",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
