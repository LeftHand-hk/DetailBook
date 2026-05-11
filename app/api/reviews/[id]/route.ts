import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const MAX_NAME_LEN = 50;
const MAX_TEXT_LEN = 300;

// PATCH /api/reviews/[id] — partial update. The edit modal in
// /dashboard/booking-page uses this for all fields. Length caps and
// rating bounds mirror POST so the column never gets a bad value.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const existing = await prisma.businessReview.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body?.customerName !== undefined) {
      const t = String(body.customerName).trim().slice(0, MAX_NAME_LEN);
      if (!t) return NextResponse.json({ error: "Customer name cannot be empty" }, { status: 400 });
      data.customerName = t;
    }
    if (body?.rating !== undefined) {
      const n = typeof body.rating === "number" ? body.rating : parseInt(String(body.rating), 10);
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
      }
      data.rating = Math.floor(n);
    }
    if (body?.reviewText !== undefined) {
      const t = String(body.reviewText).trim().slice(0, MAX_TEXT_LEN);
      if (!t) return NextResponse.json({ error: "Review text cannot be empty" }, { status: 400 });
      data.reviewText = t;
    }
    if (body?.reviewDate !== undefined) {
      // null / "" clears the date; otherwise parse and store.
      if (body.reviewDate === null || body.reviewDate === "") {
        data.reviewDate = null;
      } else {
        const d = new Date(String(body.reviewDate));
        data.reviewDate = isNaN(d.getTime()) ? null : d;
      }
    }
    if (body?.serviceId !== undefined) {
      data.serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null;
    }
    if (typeof body?.displayOrder === "number" && Number.isFinite(body.displayOrder)) {
      data.displayOrder = Math.floor(body.displayOrder);
    }

    const updated = await prisma.businessReview.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/reviews/[id] error:", err);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const existing = await prisma.businessReview.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.businessReview.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/reviews/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
