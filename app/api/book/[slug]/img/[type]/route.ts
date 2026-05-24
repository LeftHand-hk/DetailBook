import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseDataUrl, IMAGE_CACHE_CONTROL } from "@/lib/dataurl";

// Serves a business's brand image (logo / banner / cover) as a real,
// cacheable binary response instead of a base64 string inside JSON.
//
// Why this exists: those columns are base64 data URLs in the DB. Shipping
// them inside the /api/book/[slug] JSON meant ~370KB+ of un-cacheable text
// on every booking-page load. Served here as binary with a 1-year
// immutable Cache-Control + a `?v=<updatedAt>` buster, the browser and the
// CDN cache them, so repeat loads (and every visitor after the first) get
// the image from cache instead of the database.

const COLUMN: Record<string, "logo" | "bannerImage" | "coverImage"> = {
  logo: "logo",
  banner: "bannerImage",
  cover: "coverImage",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; type: string }> }
) {
  const { slug, type } = await params;
  const column = COLUMN[type];
  if (!column) {
    return NextResponse.json({ error: "Unknown image type" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { slug },
    select: { suspended: true, [column]: true } as any,
  });

  if (!user || (user as any).suspended) {
    return new NextResponse(null, { status: 404 });
  }

  const value = (user as any)[column] as string | null;

  // Forward-compat: if the stored value is already an http(s) URL (e.g. a
  // future object-storage migration), just redirect to it.
  if (value && /^https?:\/\//.test(value)) {
    return NextResponse.redirect(value, 302);
  }

  const parsed = parseDataUrl(value);
  if (!parsed) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(parsed.buffer), {
    status: 200,
    headers: {
      "Content-Type": parsed.mime,
      "Content-Length": String(parsed.buffer.length),
      "Cache-Control": IMAGE_CACHE_CONTROL,
    },
  });
}
