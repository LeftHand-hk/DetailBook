import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Public endpoint that lists a business's portfolio photos.
//
// The actual image bytes are NOT inlined here anymore — a user with 12
// base64 photos shipped ~6 MB of un-cacheable JSON, which made the
// booking page crawl. Instead we return lightweight metadata and a
// cacheable binary URL per photo (served by /api/book/[slug]/photo/[id]),
// so the browser/CDN cache the images and load them in parallel.
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
            // Note: we DON'T select photoUrl/beforePhotoUrl here — that's
            // the heavy base64. We only need to know if a before-image
            // exists, which we infer from photoType. The bytes come from
            // the per-photo binary route.
            caption: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user || user.suspended) {
      return NextResponse.json([]);
    }

    const photos = user.photos.map((p) => {
      const ver = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
      return {
        id: p.id,
        photoType: p.photoType,
        caption: p.caption,
        photoUrl: `/api/book/${slug}/photo/${p.id}?v=${ver}`,
        beforePhotoUrl:
          p.photoType === "before_after"
            ? `/api/book/${slug}/photo/${p.id}?before=1&v=${ver}`
            : null,
      };
    });

    return NextResponse.json(photos);
  } catch (err) {
    console.error("GET /api/book/[slug]/photos error:", err);
    return NextResponse.json({ error: "Failed to load photos" }, { status: 500 });
  }
}
