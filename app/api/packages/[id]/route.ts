import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Mirrors the validator in app/api/packages/route.ts — kept local so the
// two files don't grow a circular dependency through a shared helper.
function sanitizeAddons(input: unknown): unknown[] | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!Array.isArray(input)) return null;
  const out: { id: string; name: string; price: number; duration?: number }[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const priceNum = typeof r.price === "number" ? r.price : parseFloat(String(r.price));
    if (!name || !Number.isFinite(priceNum) || priceNum < 0) continue;
    const durationNum = r.duration == null || r.duration === ""
      ? undefined
      : (typeof r.duration === "number" ? r.duration : parseInt(String(r.duration), 10));
    const cleaned: { id: string; name: string; price: number; duration?: number } = {
      id: typeof r.id === "string" && r.id ? r.id : `a_${Math.random().toString(36).slice(2, 10)}`,
      name,
      price: Math.round(priceNum * 100) / 100,
    };
    if (typeof durationNum === "number" && Number.isFinite(durationNum) && durationNum > 0) {
      cleaned.duration = Math.floor(durationNum);
    }
    out.push(cleaned);
  }
  return out;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, price, duration, deposit, active } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseFloat(price);
    if (duration !== undefined) data.duration = parseInt(duration);
    if (deposit !== undefined) data.deposit = deposit != null ? parseFloat(deposit) : null;
    if (active !== undefined) data.active = active;
    const cleanedAddons = sanitizeAddons(body.addons);
    if (cleanedAddons !== undefined) data.addons = cleanedAddons;

    const updated = await prisma.package.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/packages/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.package.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/packages/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}
