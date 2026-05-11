import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const MAX_REVIEWS_PER_USER = 10;
const MAX_NAME_LEN = 50;
const MAX_TEXT_LEN = 300;

// Trim + length-cap helpers. Strings that come back null/empty after
// trimming are rejected at the API level.
function sanitizeName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, MAX_NAME_LEN);
  return t.length > 0 ? t : null;
}
function sanitizeText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, MAX_TEXT_LEN);
  return t.length > 0 ? t : null;
}
function sanitizeRating(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.floor(n);
}
function sanitizeDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;          // "leave alone" on PATCH
  if (v === null || v === "") return null;        // explicit clear
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/reviews — list the calling user's reviews ordered for
// display. Public visitors get reviews via /api/book/<slug>.
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const reviews = await prisma.businessReview.findMany({
      where: { userId: session.id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(reviews);
  } catch (err) {
    console.error("GET /api/reviews error:", err);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

// POST /api/reviews — add a review. New rows go to the bottom.
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const customerName = sanitizeName(body?.customerName);
    const rating = sanitizeRating(body?.rating);
    const reviewText = sanitizeText(body?.reviewText);
    const reviewDate = sanitizeDate(body?.reviewDate);
    const serviceId = typeof body?.serviceId === "string" && body.serviceId ? body.serviceId : null;

    if (!customerName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!rating) return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
    if (!reviewText) return NextResponse.json({ error: "Review text is required" }, { status: 400 });

    const currentCount = await prisma.businessReview.count({ where: { userId: session.id } });
    if (currentCount >= MAX_REVIEWS_PER_USER) {
      return NextResponse.json(
        { error: `Review limit reached (${MAX_REVIEWS_PER_USER}). Delete one to add another.` },
        { status: 400 },
      );
    }

    const last = await prisma.businessReview.findFirst({
      where: { userId: session.id },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    const nextOrder = (last?.displayOrder ?? -1) + 1;

    const created = await prisma.businessReview.create({
      data: {
        userId: session.id,
        customerName,
        rating,
        reviewText,
        reviewDate: reviewDate ?? null,
        serviceId,
        displayOrder: nextOrder,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/reviews error:", err);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}

// PUT /api/reviews — bulk reorder. Body: { order: string[] (ids).
// Mirrors the photos endpoint so the dashboard drag-and-drop code can
// reuse the same shape.
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const ids = Array.isArray(body?.order)
      ? body.order.filter((x: unknown) => typeof x === "string")
      : null;
    if (!ids) {
      return NextResponse.json({ error: "order must be a string array of review ids" }, { status: 400 });
    }
    const owned = await prisma.businessReview.findMany({
      where: { userId: session.id, id: { in: ids } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((r) => r.id));
    let order = 0;
    await prisma.$transaction(
      ids
        .filter((id: string) => ownedIds.has(id))
        .map((id: string) =>
          prisma.businessReview.update({
            where: { id },
            data: { displayOrder: order++ },
          }),
        ),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/reviews error:", err);
    return NextResponse.json({ error: "Failed to reorder reviews" }, { status: 500 });
  }
}
