import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Hard caps so the JSON column for photos can't get blown up by a
// rogue upload. The dashboard UI already compresses client-side, but
// these still guard against direct API hits.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;   // 5 MB per data URL after base64
const MAX_PHOTOS_PER_USER = 12;
const MAX_CAPTION_LEN = 60;

function isValidDataUrl(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("data:image/") && s.length <= MAX_PHOTO_BYTES * 1.4;
}

// GET /api/photos — list the calling user's gallery, ordered for
// display. Public visitors get photos via /api/book/<slug> instead.
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const photos = await prisma.businessPhoto.findMany({
      where: { userId: session.id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(photos);
  } catch (err) {
    console.error("GET /api/photos error:", err);
    return NextResponse.json({ error: "Failed to fetch photos" }, { status: 500 });
  }
}

// POST /api/photos — add a single photo OR a before/after pair.
//
// Body:
//   { photoType: "single", photoUrl, caption? }
//   { photoType: "before_after", photoUrl, beforePhotoUrl, caption? }
//
// New rows land at the bottom of the gallery (max displayOrder + 1).
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const photoType = body?.photoType === "before_after" ? "before_after" : "single";
    const photoUrl = body?.photoUrl;
    const beforePhotoUrl = body?.beforePhotoUrl;
    const caption = typeof body?.caption === "string"
      ? body.caption.trim().slice(0, MAX_CAPTION_LEN)
      : null;

    if (!isValidDataUrl(photoUrl)) {
      return NextResponse.json({ error: "photoUrl must be a base64 image data URL (max 5MB)" }, { status: 400 });
    }
    if (photoType === "before_after" && !isValidDataUrl(beforePhotoUrl)) {
      return NextResponse.json({ error: "beforePhotoUrl must be a base64 image data URL (max 5MB)" }, { status: 400 });
    }

    const currentCount = await prisma.businessPhoto.count({ where: { userId: session.id } });
    if (currentCount >= MAX_PHOTOS_PER_USER) {
      return NextResponse.json(
        { error: `Gallery is full (${MAX_PHOTOS_PER_USER} items max). Delete one to add another.` },
        { status: 400 },
      );
    }

    // Append at the bottom. Picking max+1 (not count) so deletions
    // don't leave a hole that the next upload would skip into.
    const last = await prisma.businessPhoto.findFirst({
      where: { userId: session.id },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    const nextOrder = (last?.displayOrder ?? -1) + 1;

    const created = await prisma.businessPhoto.create({
      data: {
        userId: session.id,
        photoType,
        photoUrl,
        beforePhotoUrl: photoType === "before_after" ? beforePhotoUrl : null,
        caption: caption || null,
        displayOrder: nextOrder,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/photos error:", err);
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
  }
}

// PUT /api/photos — bulk reorder. Body: { order: string[] (ids in
// display order) }. Used by the drag-and-drop reorder in the admin UI
// — re-packs displayOrder so the values stay tight after deletes.
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const ids = Array.isArray(body?.order) ? body.order.filter((x: unknown) => typeof x === "string") : null;
    if (!ids) {
      return NextResponse.json({ error: "order must be a string array of photo ids" }, { status: 400 });
    }
    // Only reorder rows that belong to the caller. Cross-user ids in
    // the payload are silently skipped.
    const owned = await prisma.businessPhoto.findMany({
      where: { userId: session.id, id: { in: ids } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((p) => p.id));
    let order = 0;
    await prisma.$transaction(
      ids
        .filter((id: string) => ownedIds.has(id))
        .map((id: string) =>
          prisma.businessPhoto.update({
            where: { id },
            data: { displayOrder: order++ },
          }),
        ),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/photos error:", err);
    return NextResponse.json({ error: "Failed to reorder photos" }, { status: 500 });
  }
}
