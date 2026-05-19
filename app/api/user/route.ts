import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// User state changes constantly during signup/onboarding (Paddle webhook
// + recovery sync flip trialEndsAt, paddleCustomerId, subscriptionStatus
// in seconds). Marking the route dynamic ensures Next.js never reuses a
// rendered response between requests, and the no-store headers below
// keep the browser and any CDN layer (Netlify Edge) from serving stale
// JSON. Without this the dashboard could read a pre-Paddle snapshot of
// the user and bounce them to /onboarding right after Skip.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Omit base64 image blobs — coverImage and bannerImage are only used
    // on the public booking page, not on the dashboard. The logo IS used
    // in the dashboard header so we keep it.
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      omit: {
        password: true,
        coverImage: true,
        bannerImage: true,
      },
      include: {
        packages: true,
        bookings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const res = NextResponse.json({ user });
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    return res;
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
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
