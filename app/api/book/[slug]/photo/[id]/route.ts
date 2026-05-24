import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseDataUrl, IMAGE_CACHE_CONTROL } from "@/lib/dataurl";

// Serves a single portfolio photo as cacheable binary (see the sibling
// /img/[type] route for the rationale). `?before=1` returns the BEFORE
// image of a before/after pair; otherwise the main (after / single) photo.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;
  const wantBefore = request.nextUrl.searchParams.get("before") === "1";

  const photo = await prisma.businessPhoto.findUnique({
    where: { id },
    select: { photoUrl: true, beforePhotoUrl: true },
  });

  if (!photo) {
    return new NextResponse(null, { status: 404 });
  }

  const value = wantBefore ? photo.beforePhotoUrl : photo.photoUrl;

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
