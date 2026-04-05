import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        packages: true,
        bookings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword });
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
      "serviceType", "bio", "address", "logo", "coverImage", "instagram", "facebook", "website",
      "rating", "reviewCount", "yearsInBusiness", "serviceAreas", "businessHours",
      "emailReminders", "customMessage", "advanceBookingDays",
      "bannerImage", "bannerOverlayOpacity", "serviceLayout",
      "bookingPageTheme", "accentColor", "bookingPageTitle", "bookingPageSubtitle",
      "showRating", "showSocialLinks", "showServiceAreas", "showBusinessHours",
      "showTrustBadges", "requireDeposit", "depositPercentage",
      "thankYouMessage", "termsText", "smsTemplates", "emailTemplates",
      "paymentMethods", "suspended",
    ];

    const updateData: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
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
