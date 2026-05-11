import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const MAX_CAPTION_LEN = 60;

// PATCH /api/photos/[id] — partial update. The dashboard uses this
// for caption edits; the bulk reorder lives at PUT /api/photos.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.businessPhoto.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body?.caption !== undefined) {
      data.caption = typeof body.caption === "string" && body.caption.trim()
        ? body.caption.trim().slice(0, MAX_CAPTION_LEN)
        : null;
    }
    if (typeof body?.displayOrder === "number" && Number.isFinite(body.displayOrder)) {
      data.displayOrder = Math.floor(body.displayOrder);
    }
    const updated = await prisma.businessPhoto.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/photos/[id] error:", err);
    return NextResponse.json({ error: "Failed to update photo" }, { status: 500 });
  }
}

// DELETE /api/photos/[id] — removes a row, leaving the rest in place.
// We don't re-pack displayOrder on delete — the next reorder will do
// it. Same UX outcome with one fewer write.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const existing = await prisma.businessPhoto.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.businessPhoto.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/photos/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
