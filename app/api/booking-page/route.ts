import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { BOOKING_PAGE_FIELDS, IMAGE_FIELDS } from "@/lib/booking-page-settings";

// ──────────────────────────────────────────────────────────────────────────
// Booking-page design settings API — the ONE reader and writer for the public
// booking-page design (classic vs modern + every customization field).
//
// This replaces the tangle of writers (PUT /api/user, /api/user/layout, and
// the background whole-user sync) that all touched these columns and raced
// each other into the "design reverts after switching" + HTTP 504 bugs. The
// dashboard picker and both editors now go through here exclusively.
//
//   GET   → the design settings (image columns returned as small display URLs,
//           never the heavy base64 bytes, so the read is always fast).
//   PATCH → a partial update of ONLY the whitelisted design fields, in a
//           single atomic write that echoes back a small row (no images).
// ──────────────────────────────────────────────────────────────────────────

// Scalar design fields to read/echo. NEVER includes the base64 image columns
// (logo/bannerImage/coverImage) — those are heavy and handled separately so a
// read can't pull megabytes into the function. `id`/`plan`/`rating`/
// `reviewCount` are read-only context the editors need for their UI.
const SETTINGS_SELECT = {
  id: true,
  plan: true,
  slug: true,
  businessName: true,
  name: true,
  bio: true,
  city: true,
  address: true,
  yearsInBusiness: true,
  serviceAreas: true,
  phone: true,
  instagram: true,
  facebook: true,
  website: true,
  rating: true,
  reviewCount: true,
  bannerOverlayOpacity: true,
  serviceLayout: true,
  bookingPageTheme: true,
  accentColor: true,
  bookingPageTitle: true,
  bookingPageSubtitle: true,
  showRating: true,
  showSocialLinks: true,
  showServiceAreas: true,
  showBusinessHours: true,
  showTrustBadges: true,
  customMessage: true,
  thankYouMessage: true,
  termsText: true,
  advanceBookingDays: true,
  galleryLayout: true,
  galleryShowTitle: true,
  galleryTitle: true,
  reviewsLayout: true,
  reviewsShowStars: true,
  reviewsShowAvatars: true,
  reviewsShowDates: true,
  pageContent: true,
  bookingPageLayout: true,
} as const;

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const settings = await prisma.user.findUnique({
      where: { id: session.id },
      select: { ...SETTINGS_SELECT, updatedAt: true },
    });
    if (!settings) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Image columns are heavy (legacy rows can hold multi-MB base64). Never
    // pull the bytes: this query returns the URL only when it's an external
    // CDN link (small) and otherwise just a presence flag. We then hand back a
    // display URL the editors can render directly — a real upload URL as-is, or
    // the binary-serving route for legacy base64.
    const rows = await prisma.$queryRaw<
      Array<{
        logoUrl: string | null; hasLogo: boolean;
        bannerUrl: string | null; hasBanner: boolean;
        coverUrl: string | null; hasCover: boolean;
      }>
    >`SELECT
        (CASE WHEN logo LIKE 'http%' THEN logo END) AS "logoUrl",
        (logo IS NOT NULL AND logo <> '') AS "hasLogo",
        (CASE WHEN "bannerImage" LIKE 'http%' THEN "bannerImage" END) AS "bannerUrl",
        ("bannerImage" IS NOT NULL AND "bannerImage" <> '') AS "hasBanner",
        (CASE WHEN "coverImage" LIKE 'http%' THEN "coverImage" END) AS "coverUrl",
        ("coverImage" IS NOT NULL AND "coverImage" <> '') AS "hasCover"
      FROM "User" WHERE id = ${session.id}`;
    const img = rows[0];
    const ver = settings.updatedAt ? new Date(settings.updatedAt).getTime() : 0;

    const { updatedAt: _omit, ...rest } = settings as Record<string, unknown> & { updatedAt: Date | null };

    return NextResponse.json({
      settings: {
        ...rest,
        logo: img?.logoUrl ?? (img?.hasLogo ? `/api/user/me/img/logo?v=${ver}` : null),
        bannerImage: img?.bannerUrl ?? (img?.hasBanner ? `/api/user/me/img/banner?v=${ver}` : null),
        coverImage: img?.coverUrl ?? (img?.hasCover ? `/api/user/me/img/cover?v=${ver}` : null),
      },
    });
  } catch (error) {
    console.error("Get booking-page settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Whitelist: only ever write the design fields, and only the ones present
    // in this patch. Anything else in the body is ignored.
    const data: Record<string, unknown> = {};
    for (const key of BOOKING_PAGE_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key];
    }

    // Never write a placeholder/binary-route URL back into an image column —
    // that would overwrite the real image with a route string and every
    // consumer of the binary route would then 404. Real CDN URLs (http…) and
    // freshly compressed base64 pass through untouched.
    for (const k of IMAGE_FIELDS) {
      const v = data[k];
      if (typeof v === "string" && v.startsWith("/api/")) delete data[k];
    }

    // Validate the design selector.
    if (
      data.bookingPageLayout !== undefined &&
      data.bookingPageLayout !== "classic" &&
      data.bookingPageLayout !== "modern"
    ) {
      return NextResponse.json(
        { error: "bookingPageLayout must be 'classic' or 'modern'" },
        { status: 400 },
      );
    }

    // Normalize the slug to the URL-safe form the public /book/[slug] route
    // expects, and reject an empty one (the slug is the live page address).
    if (typeof data.slug === "string") {
      const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!slug.replace(/-/g, "")) {
        return NextResponse.json({ error: "Your booking page URL can't be empty." }, { status: 400 });
      }
      data.slug = slug;
    }

    // Coerce the one Int field that the modern editor sometimes sends as a
    // draft string, so a valid number never lands as text.
    if (typeof data.yearsInBusiness === "string") {
      data.yearsInBusiness = parseInt(data.yearsInBusiness, 10) || 0;
    }

    if (Object.keys(data).length === 0) {
      // Nothing recognized to write — treat as a no-op success.
      return NextResponse.json({ ok: true });
    }

    const settings = await prisma.user.update({
      where: { id: session.id },
      data,
      select: SETTINGS_SELECT,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    // A duplicate slug is the one expected user-facing rejection.
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { error: "That booking page URL is already taken. Please choose another." },
        { status: 409 },
      );
    }
    // Surface the real Prisma cause so a failed save shows an actionable
    // reason in the editor banner instead of an opaque 500.
    const code = (error as { code?: string })?.code ? ` [${(error as { code?: string }).code}]` : "";
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Couldn't save${code}: ${msg}` }, { status: 500 });
  }
}
