import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Public endpoint that returns ONLY a business's portfolio photos.
// Split off from /api/book/[slug] because photo URLs are base64 data
// strings — a user with the full 12 photos easily ships ~6 MB of JSON,
// which was making the booking page's first paint feel slow even on
// good connections. The booking page now does:
//   1. GET /api/book/[slug]        → small, drives initial render
//   2. GET /api/book/[slug]/photos → photos load in once the page is up
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const user = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        suspended: true,
        photos: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            photoType: true,
            photoUrl: true,
            beforePhotoUrl: true,
            caption: true,
          },
        },
      },
    });

    if (!user || user.suspended) {
      return NextResponse.json([]);
    }
    return NextResponse.json(user.photos);
  } catch (err) {
    console.error("GET /api/book/[slug]/photos error:", err);
    return NextResponse.json({ error: "Failed to load photos" }, { status: 500 });
  }
}
