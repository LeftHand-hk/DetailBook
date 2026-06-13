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

    // Run the user fetch and image-flag check in parallel — they are
    // independent queries on the same row and used to run sequentially,
    // adding ~50-150ms of pure waiting on every dashboard load.
    // Bookings are intentionally excluded: the lightweight sync only needs
    // the user profile + packages; bookings have their own /api/bookings
    // endpoint and storage.ts already fetches them separately. Loading all
    // booking rows here was the single biggest cause of slow dashboard
    // loads (200+ rows × all fields on every page mount).
    const [user, flagRows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        omit: full
          ? { password: true }
          : { password: true, logo: true, coverImage: true, bannerImage: true },
        include: { packages: true },
      }),
      full
        ? Promise.resolve(null)
        : prisma.$queryRaw<Array<{ hasLogo: boolean; hasBanner: boolean; hasCover: boolean }>>`
            SELECT (logo IS NOT NULL AND logo <> '' AND logo NOT LIKE '/api/%') AS "hasLogo",
                   ("bannerImage" IS NOT NULL AND "bannerImage" <> '' AND "bannerImage" NOT LIKE '/api/%') AS "hasBanner",
                   ("coverImage" IS NOT NULL AND "coverImage" <> '' AND "coverImage" NOT LIKE '/api/%') AS "hasCover"
            FROM "User" WHERE id = ${session.id}`,
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!full && flagRows) {
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

    // CRITICAL: refuse to write the placeholder URLs that the lightweight
    // GET response returns for the image columns ("/api/user/me/img/..." ,
    // "/api/book/.../img/...") back into the actual base64 column. A
    // client that round-trips the response (storage.setUser → PUT) would
    // otherwise overwrite the real image data with the URL string and
    // every consumer of the binary route would then 404.
    for (const k of ["logo", "bannerImage", "coverImage"] as const) {
      const v = updateData[k];
      if (typeof v === "string" && v.startsWith("/api/")) {
        delete updateData[k];
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
    // Surface the real cause (Prisma code + message) so a failed save —
    // e.g. a photo that won't save — shows the actual reason in the editor's
    // banner instead of an opaque "Internal server error".
    const code = (error as { code?: string })?.code ? ` [${(error as { code?: string }).code}]` : "";
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Couldn't save${code}: ${msg}` },
      { status: 500 }
    );
  }
}
