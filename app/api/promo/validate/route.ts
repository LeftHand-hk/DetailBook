import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo || !promo.active) {
      return NextResponse.json({ error: "Invalid or expired promo code" }, { status: 404 });
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This promo code has expired" }, { status: 410 });
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return NextResponse.json({ error: "This promo code has reached its usage limit" }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      appliesTo: promo.appliesTo,
      description: promo.description,
    });
  } catch (err) {
    console.error("Promo validate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
