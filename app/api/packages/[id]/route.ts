import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

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
