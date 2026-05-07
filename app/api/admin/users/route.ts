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

    // Explicit select — User table holds base64 logo/coverImage/bannerImage
    // (~50MB per row). Including those columns turned this list query into
    // hundreds of MB of egress per call and crashed the DB pool.
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        businessName: true,
        name: true,
        phone: true,
        city: true,
        slug: true,
        plan: true,
        trialEndsAt: true,
        subscriptionStatus: true,
        suspended: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        signupIp: true,
        signupCountry: true,
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
      lastLoginAt: user.lastLoginAt,
      signupIp: user.signupIp,
      signupCountry: user.signupCountry,
      packageCount: user._count?.packages ?? 0,
      bookingCount: user._count?.bookings ?? 0,
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
  // Declared outside try so the catch block can include it in error logs.
  let userId: string | null = null;
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete children explicitly first to avoid race between
    // user→booking Cascade and staff→booking SetNull triggers.
    // Order matters: bookings BEFORE staff (so staff's SetNull on
    // booking.staffId doesn't fight the user-cascade on booking).
    // Notifications must be explicit too — relying on cascade alone
    // sometimes fails for users with many notifications.
    // Interactive transaction (function form) is required because the
    // array form of $transaction doesn't accept the timeout option.
    const uid = userId;
    await prisma.$transaction(
      async (tx) => {
        await tx.notification.deleteMany({ where: { userId: uid } });
        await tx.ticketMessage.deleteMany({ where: { ticket: { userId: uid } } });
        await tx.supportTicket.deleteMany({ where: { userId: uid } });
        await tx.booking.deleteMany({ where: { userId: uid } });
        await tx.staff.deleteMany({ where: { userId: uid } });
        await tx.package.deleteMany({ where: { userId: uid } });
        await tx.user.delete({ where: { id: uid } });
      },
      {
        // Default 5s is too tight for users with many bookings/notifications.
        timeout: 30_000,
        maxWait: 10_000,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    // Surface Prisma's actual error code so we can diagnose flaky deletes.
    const code = (error as any)?.code;
    const meta = (error as any)?.meta;
    console.error("DELETE /api/admin/users error:", { userId, code, meta, error });
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json(
      { error: message, code, meta },
      { status: 500 }
    );
  }
}
