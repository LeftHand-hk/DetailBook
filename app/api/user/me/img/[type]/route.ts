import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { parseDataUrl, IMAGE_CACHE_CONTROL } from "@/lib/dataurl";

// Serves the logged-in user's own brand image (logo/banner/cover) as a
// cacheable binary response. Mirrors /api/book/[slug]/img/[type] but
// keyed off the session instead of a public slug — so the dashboard nav
// can show the owner's logo without /api/user shipping the base64 blob
// on every fetch.

const COLUMN: Record<string, "logo" | "bannerImage" | "coverImage"> = {
  logo: "logo",
  banner: "bannerImage",
  cover: "coverImage",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await getSessionUser();
  if (!session) return new NextResponse(null, { status: 401 });

  const { type } = await params;
  const column = COLUMN[type];
  if (!column) return new NextResponse(null, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { [column]: true } as any,
  });
  if (!user) return new NextResponse(null, { status: 404 });

  const value = (user as any)[column] as string | null;
  if (value && /^https?:\/\//.test(value)) {
    return NextResponse.redirect(value, 302);
  }

  const parsed = parseDataUrl(value);
  if (!parsed) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(parsed.buffer), {
    status: 200,
    headers: {
      "Content-Type": parsed.mime,
      "Content-Length": String(parsed.buffer.length),
      "Cache-Control": IMAGE_CACHE_CONTROL,
    },
  });
}
