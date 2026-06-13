import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sanitizeVehiclePricing } from "@/lib/vehicle-pricing";

// Mirrors the validator in app/api/packages/route.ts — kept local so the
// two files don't grow a circular dependency through a shared helper.
function sanitizeAddons(input: unknown): unknown[] | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!Array.isArray(input)) return null;
  const out: { id: string; name: string; price: number; description?: string }[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    // Blank/absent price = free extra ($0). Only a malformed price drops
    // the row, so a name+description add-on with no price still saves.
    const rawPrice = typeof r.price === "number" ? r.price : String(r.price ?? "").trim();
    const priceNum = rawPrice === "" ? 0 : parseFloat(String(rawPrice));
    if (!name || !Number.isFinite(priceNum) || priceNum < 0) continue;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : `a_${Math.random().toString(36).slice(2, 10)}`,
      name,
      price: Math.round(priceNum * 100) / 100,
      ...(description ? { description } : {}),
    });
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
    const cleanedVehiclePricing = sanitizeVehiclePricing(body.vehiclePricing);
    if (cleanedVehiclePricing !== undefined) data.vehiclePricing = cleanedVehiclePricing;

    // Single query: update only if id + userId match (ownership check
    // built into the WHERE). Eliminates the separate findUnique round-trip.
    const updated = await prisma.package.update({
      where: { id, userId: session.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if ((error as any)?.code === "P2025") {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    console.error("PUT /api/packages/[id] error:", error);
    const code = (error as any)?.code ? ` [${(error as any).code}]` : "";
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to update package${code}: ${msg}` },
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

    // Single query: delete only if id + userId match.
    await prisma.package.delete({ where: { id, userId: session.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/packages/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}
