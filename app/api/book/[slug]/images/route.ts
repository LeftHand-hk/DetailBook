import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Returns ONLY the business's base64 brand images (logo, banner, cover).
// Split out of /api/book/[slug] because these columns are large and were
// blocking the booking page's first paint. The page fetches the rest of
// the profile first (small, fast), renders with gradient fallbacks, then
// streams these in.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await prisma.user.findUnique({
      where: { slug },
      select: { suspended: true, logo: true, bannerImage: true, coverImage: true },
    });
    if (!user || user.suspended) {
      return NextResponse.json({ logo: null, bannerImage: null, coverImage: null });
    }
    return NextResponse.json({
      logo: user.logo,
      bannerImage: user.bannerImage,
      coverImage: user.coverImage,
    });
  } catch (err) {
    console.error("GET /api/book/[slug]/images error:", err);
    return NextResponse.json({ logo: null, bannerImage: null, coverImage: null });
  }
}
