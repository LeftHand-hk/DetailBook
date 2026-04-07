import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const user = await prisma.user.findUnique({
      where: { slug },
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
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (user.suspended) {
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
      logo: user.logo,
      coverImage: user.coverImage,
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
      bannerImage: user.bannerImage,
      bannerOverlayOpacity: user.bannerOverlayOpacity,
      serviceLayout: user.serviceLayout,
      bookingPageTheme: user.bookingPageTheme,
      accentColor: user.accentColor,
      bookingPageTitle: user.bookingPageTitle,
      bookingPageSubtitle: user.bookingPageSubtitle,
      showRating: user.showRating,
      showSocialLinks: user.showSocialLinks,
      showServiceAreas: user.showServiceAreas,
      showBusinessHours: user.showBusinessHours,
      showTrustBadges: user.showTrustBadges,
      requireDeposit: user.requireDeposit,
      depositPercentage: user.depositPercentage,
      thankYouMessage: user.thankYouMessage,
      termsText: user.termsText,
      serviceType: (user as any).serviceType ?? "mobile",
      packages: user.packages,
      staff: (user as any).staff ?? [],
      bookedSlots,
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
