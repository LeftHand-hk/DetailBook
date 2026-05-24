import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isTrialExpired } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Photos are deliberately NOT included here. A user with 12 photos
    // (≤6 MB of base64) was making this response slow to parse and slow
    // to ship over the wire — and the booking flow doesn't need them
    // for the first paint. The booking page fetches them in a second
    // request via /api/book/[slug]/photos so the initial render isn't
    // blocked on photo download.
    const user = await prisma.user.findUnique({
      where: { slug },
      // Omit the heavy base64 image columns from the main payload. They
      // were dragging ~370KB over the DB→server link and the wire on
      // every booking-page load, blocking first paint. The page now
      // fetches them from /api/book/[slug]/images right after the first
      // render (same pattern as photos), so the hero shows its gradient
      // fallback instantly and the banner/logo/cover stream in.
      omit: { logo: true, coverImage: true, bannerImage: true },
      include: {
        packages: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
        },
        staff: {
          where: { active: true },
          select: { id: true, name: true, role: true, color: true, avatar: true },
          orderBy: { createdAt: "asc" },
        },
        reviews: {
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (user.suspended || isTrialExpired(user)) {
      return NextResponse.json(
        { error: "This business page is currently unavailable" },
        { status: 403 }
      );
    }

    // Fetch confirmed/pending bookings for availability (next 60 days only)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);
    const bookedSlots = await prisma.booking.findMany({
      where: {
        userId: user.id,
        status: { in: ["confirmed", "pending", "in_progress"] },
        date: {
          gte: new Date().toISOString().split("T")[0],
          lte: futureDate.toISOString().split("T")[0],
        },
      },
      select: { date: true, time: true, staffId: true },
    });

    // Brand images are served as cacheable binary from /img/[type] rather
    // than inlined as base64. We only need to know WHICH images exist so we
    // can hand back a URL (or null). A tiny raw query checks existence
    // without loading the multi-MB base64 columns into memory.
    const flagRows = await prisma.$queryRaw<
      Array<{ hasLogo: boolean; hasBanner: boolean; hasCover: boolean }>
    >`SELECT (logo IS NOT NULL AND logo <> '') AS "hasLogo",
             ("bannerImage" IS NOT NULL AND "bannerImage" <> '') AS "hasBanner",
             ("coverImage" IS NOT NULL AND "coverImage" <> '') AS "hasCover"
      FROM "User" WHERE id = ${user.id}`;
    const flags = flagRows[0] ?? { hasLogo: false, hasBanner: false, hasCover: false };
    // updatedAt-based cache buster: a new upload bumps updatedAt, changing
    // the URL so caches refetch; otherwise the image is served from cache.
    const ver = (user as any).updatedAt ? new Date((user as any).updatedAt).getTime() : 0;
    const imgUrl = (type: string) => `/api/book/${slug}/img/${type}?v=${ver}`;

    // Return public profile data (exclude sensitive fields like password)
    const profile = {
      id: user.id,
      businessName: user.businessName,
      name: user.name,
      phone: user.phone,
      city: user.city,
      slug: user.slug,
      bio: user.bio,
      address: user.address,
      // Brand images as cacheable binary URLs (null when not set) — see
      // the /img/[type] route. The browser/CDN cache these instead of us
      // re-shipping base64 on every load.
      logo: flags.hasLogo ? imgUrl("logo") : null,
      bannerImage: flags.hasBanner ? imgUrl("banner") : null,
      coverImage: flags.hasCover ? imgUrl("cover") : null,
      instagram: user.instagram,
      facebook: user.facebook,
      website: user.website,
      rating: user.rating,
      reviewCount: user.reviewCount,
      yearsInBusiness: user.yearsInBusiness,
      serviceAreas: user.serviceAreas,
      businessHours: user.businessHours,
      emailReminders: user.emailReminders,
      customMessage: user.customMessage,
      advanceBookingDays: user.advanceBookingDays,
      bannerOverlayOpacity: user.bannerOverlayOpacity,
      serviceLayout: user.serviceLayout,
      bookingPageTheme: user.bookingPageTheme,
      accentColor: user.accentColor,
      bookingPageTitle: user.bookingPageTitle,
      bookingPageSubtitle: user.bookingPageSubtitle,
      pageContent: (user as any).pageContent ?? null,
      bookingPageLayout: (user as any).bookingPageLayout ?? "classic",
      showRating: user.showRating,
      showSocialLinks: user.showSocialLinks,
      showServiceAreas: user.showServiceAreas,
      showBusinessHours: user.showBusinessHours,
      showTrustBadges: user.showTrustBadges,
      requireDeposit: user.requireDeposit,
      thankYouMessage: user.thankYouMessage,
      termsText: user.termsText,
      serviceType: (user as any).serviceType ?? "mobile",
      timezone: (user as any).timezone ?? "America/New_York",
      packages: user.packages,
      staff: (user as any).staff ?? [],
      // photos intentionally not returned here — booking page fetches
      // them separately from /api/book/[slug]/photos to keep first
      // paint fast.
      galleryLayout: (user as any).galleryLayout ?? "grid",
      galleryShowTitle: (user as any).galleryShowTitle ?? true,
      galleryTitle: (user as any).galleryTitle ?? "Our Work",
      // Reviews are small enough (text only, max 10 × ~300 chars) that
      // we ship them inline — no need for a deferred fetch like photos.
      reviews: (user as any).reviews ?? [],
      reviewsLayout: (user as any).reviewsLayout ?? "carousel",
      reviewsShowStars: (user as any).reviewsShowStars ?? true,
      reviewsShowAvatars: (user as any).reviewsShowAvatars ?? true,
      reviewsShowDates: (user as any).reviewsShowDates ?? true,
      bookedSlots,
      // Expose payment methods (strip secret keys for security)
      paymentMethods: (() => {
        const pm = user.paymentMethods as any;
        if (!pm) return undefined;
        const safe: any = {};
        if (pm.stripe?.enabled) {
          safe.stripe = { enabled: true, connected: !!(pm.stripe.publishableKey && pm.stripe.secretKey), publishableKey: pm.stripe.publishableKey || "" };
        }
        if (pm.square?.enabled) {
          safe.square = {
            enabled: true,
            connected: !!(pm.square.applicationId && pm.square.accessToken && pm.square.locationId),
            applicationId: pm.square.applicationId || "",
            locationId: pm.square.locationId || "",
            sandbox: !!pm.square.sandbox,
          };
        }
        if (pm.paypal?.enabled) {
          safe.paypal = { enabled: true, email: pm.paypal.email || "", paypalMeLink: pm.paypal.paypalMeLink || "", requireProof: pm.paypal.requireProof !== false };
        }
        if (pm.cashapp?.enabled) {
          safe.cashapp = { enabled: true, cashtag: pm.cashapp.cashtag || "", requireProof: pm.cashapp.requireProof !== false };
        }
        if (pm.bankTransfer?.enabled) {
          safe.bankTransfer = {
            enabled: true,
            bankName: pm.bankTransfer.bankName || "",
            accountName: pm.bankTransfer.accountName || "",
            iban: pm.bankTransfer.iban || "",
            sortCode: pm.bankTransfer.sortCode || "",
            accountNumber: pm.bankTransfer.accountNumber || "",
            instructions: pm.bankTransfer.instructions || "",
            requireProof: pm.bankTransfer.requireProof !== false,
          };
        }
        if (pm.cash?.enabled) {
          safe.cash = { enabled: true, instructions: pm.cash.instructions || "" };
        }
        return Object.keys(safe).length > 0 ? safe : undefined;
      })(),
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error("GET /api/book/[slug] error:", error);
    return NextResponse.json(
      { error: "Failed to load booking page" },
      { status: 500 }
    );
  }
}
