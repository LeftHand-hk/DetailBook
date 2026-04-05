import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { code, description, discountType, discountValue, appliesTo, maxUses, expiresAt } = body;

    if (!code || !discountValue) {
      return NextResponse.json({ error: "Code and discount value are required" }, { status: 400 });
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase().trim(),
        description: description || null,
        discountType: discountType || "percent",
        discountValue: parseFloat(discountValue),
        appliesTo: appliesTo || "both",
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({ promo }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "A promo code with this code already exists" }, { status: 409 });
    }
    console.error("Create promo error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
