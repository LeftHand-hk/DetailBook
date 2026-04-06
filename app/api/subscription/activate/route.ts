import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { plan } = body;

    if (!plan || !["starter", "pro"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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
