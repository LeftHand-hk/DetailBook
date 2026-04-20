import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";

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
      subscriptionStatus: user.subscriptionStatus,
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
    const { userId, plan, suspended, email, trialEndsAt, subscriptionStatus } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (plan !== undefined) {
      if (!["starter", "pro"].includes(plan)) {
        return NextResponse.json({ error: "Invalid plan. Must be 'starter' or 'pro'" }, { status: 400 });
      }
      data.plan = plan;
    }

    if (suspended !== undefined) {
      data.suspended = Boolean(suspended);
    }

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
      }
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== existing.email) {
        const duplicate = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (duplicate) {
          return NextResponse.json({ error: "That email is already in use by another account" }, { status: 400 });
        }
        data.email = normalizedEmail;
      }
    }

    if (trialEndsAt !== undefined) {
      data.trialEndsAt = trialEndsAt;
    }

    if (subscriptionStatus !== undefined) {
      data.subscriptionStatus = subscriptionStatus;
    }

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
      trialEndsAt: updated.trialEndsAt,
      subscriptionStatus: updated.subscriptionStatus,
    });
  } catch (error) {
    console.error("PUT /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cascades defined in schema will remove packages, bookings, staff, tickets
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
