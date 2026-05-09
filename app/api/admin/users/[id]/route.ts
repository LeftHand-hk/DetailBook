import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// Returns the full user record so the admin Data page can show every
// field a customer filled in at signup, onboarding, and later in
// Settings. The list endpoint omits the heavy base64 image columns to
// keep the table snappy — this single-user fetch loads them so the
// admin can preview logos/banners.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      omit: {
        password: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        welcomeUnsubToken: true,
      },
      include: {
        _count: {
          select: {
            packages: true,
            bookings: true,
            staff: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
