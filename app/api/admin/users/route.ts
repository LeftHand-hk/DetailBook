import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            packages: true,
            bookings: true,
          },
        },
      },
    });

    // Map to include counts at the top level for convenience
    const result = users.map((user) => ({
      id: user.id,
      email: user.email,
      businessName: user.businessName,
      name: user.name,
      phone: user.phone,
      city: user.city,
      slug: user.slug,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      suspended: user.suspended,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      packageCount: user._count.packages,
      bookingCount: user._count.bookings,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, plan, suspended } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (plan !== undefined) data.plan = plan;
    if (suspended !== undefined) data.suspended = suspended;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      businessName: updated.businessName,
      name: updated.name,
      plan: updated.plan,
      suspended: updated.suspended,
    });
  } catch (error) {
    console.error("PUT /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
