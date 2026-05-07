import { NextResponse } from "next/server";
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

    // Omit logo/coverImage/bannerImage (base64 blobs in User table — they
    // can be 50MB+ per row). The dashboard fetches them via dedicated
    // endpoints when actually needed.
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      omit: {
        password: true,
        logo: true,
        coverImage: true,
        bannerImage: true,
      },
      include: {
        _count: {
          select: {
            packages: true,
            bookings: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Refresh lastLoginAt at most once every 5 minutes so the admin's
    // "active in last X" indicator stays accurate without writing to the
    // DB on every dashboard mount.
    const now = Date.now();
    const last = user.lastLoginAt ? user.lastLoginAt.getTime() : 0;
    if (now - last > 5 * 60 * 1000) {
      prisma.user
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date(now) } })
        .catch((e) => console.error("Failed to refresh lastLoginAt:", e));
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
