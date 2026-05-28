import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // By default we omit the base64 image blobs (logo, coverImage,
    // bannerImage). The dashboard reads /api/user constantly via
    // syncFromServer; shipping MBs of base64 on every dashboard mount
    // was the main thing making page loads feel slow. The booking-page
    // editor DOES need the raw base64 to preview + edit, so it requests
    // ?full=1 and keeps the old shape.
    const full = request.nextUrl.searchParams.get("full") === "1";
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      omit: full
        ? { password: true }
        : { password: true, logo: true, coverImage: true, bannerImage: true },
      include: {
        packages: true,
        bookings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // For the lightweight (non-full) payload, replace the omitted base64
    // images with cacheable binary URLs (or null). Components that do
    // <img src={user.logo}> keep working — the URL serves from
    // /api/user/me/img/[type] and the browser caches it.
    if (!full) {
      const flagRows = await prisma.$queryRaw<
        Array<{ hasLogo: boolean; hasBanner: boolean; hasCover: boolean }>
      >`SELECT (logo IS NOT NULL AND logo <> '') AS "hasLogo",
               ("bannerImage" IS NOT NULL AND "bannerImage" <> '') AS "hasBanner",
               ("coverImage" IS NOT NULL AND "coverImage" <> '') AS "hasCover"
        FROM "User" WHERE id = ${session.id}`;
      const flags = flagRows[0] ?? { hasLogo: false, hasBanner: false, hasCover: false };
      const ver = (user as any).updatedAt ? new Date((user as any).updatedAt).getTime() : 0;
      (user as any).logo = flags.hasLogo ? `/api/user/me/img/logo?v=${ver}` : null;
      (user as any).bannerImage = flags.hasBanner ? `/api/user/me/img/banner?v=${ver}` : null;
      (user as any).coverImage = flags.hasCover ? `/api/user/me/img/cover?v=${ver}` : null;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Whitelist only valid User model fields
    const ALLOWED_FIELDS = [
      "businessName", "name", "phone", "city", "slug", "plan", "trialEndsAt",
      "serviceType", "timezone", "bio", "address", "logo", "coverImage", "instagram", "facebook", "website",
      "rating", "reviewCount", "yearsInBusiness", "serviceAreas", "businessHours",
      "emailReminders", "customMessage", "advanceBookingDays",
      "bannerImage", "bannerOverlayOpacity", "serviceLayout",
      "bookingPageTheme", "accentColor", "bookingPageTitle", "bookingPageSubtitle",
      "showRating", "showSocialLinks", "showServiceAreas", "showBusinessHours",
      "showTrustBadges", "requireDeposit", "depositPercentage",
      "thankYouMessage", "termsText", "smsTemplates", "emailTemplates",
      "paymentMethods", "suspended",
      "emailConfirmations", "smsConfirmations", "smsRemindersEnabled", "emailRemindersEnabled",
      "hasSeenCustomizePrompt",
      "galleryLayout", "galleryShowTitle", "galleryTitle",
      "reviewsLayout", "reviewsShowStars", "reviewsShowAvatars", "reviewsShowDates",
      "pageContent", "bookingPageLayout",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    // Validate timezone if being updated — must be a valid IANA zone
    if (typeof updateData.timezone === "string") {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: updateData.timezone as string });
      } catch {
        return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: updateData,
      // Don't echo the heavy base64 image columns back in the response.
      // A tiny text edit in the booking-page editor was downloading
      // ~1-2MB of logo/banner/cover on every save, which is why saving
      // felt slow. The client already has whatever it just sent.
      omit: { password: true, logo: true, coverImage: true, bannerImage: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
