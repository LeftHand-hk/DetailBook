import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";
import { cancelPaddleSubscription } from "@/lib/paddle";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Drop the heavy base64 columns — without omit the list query was
    // shipping hundreds of MB per call (logo/coverImage/bannerImage are
    // ~50MB each) and crashing the DB pool.
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      omit: {
        password: true,
        logo: true,
        coverImage: true,
        bannerImage: true,
        bio: true,
        customMessage: true,
        thankYouMessage: true,
        termsText: true,
        googleAccessToken: true,
        googleRefreshToken: true,
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

    // 1) Stop billing at Paddle first so a deleted account can never be
    //    charged again. This is a network call, so it runs OUTSIDE the DB
    //    transaction. We don't block deletion if it fails (the admin wants
    //    the account gone) — we report the result so they can cancel
    //    manually in Paddle if needed.
    const paddle = await cancelPaddleSubscription((existing as any).paddleSubscriptionId);

    // 2) Delete the account and EVERY related row. Children are removed
    //    explicitly (rather than leaning only on FK cascade) so the wipe
    //    is complete and deterministic regardless of cascade config:
    //    bookings BEFORE staff (staff's SetNull on booking.staffId must
    //    not fight the user-cascade), then the rest. PasswordReset keys on
    //    email, not userId. SmsMessage is platform-level (no user link).
    const uid = userId;
    const email = existing.email;
    await prisma.$transaction(
      async (tx) => {
        await tx.notification.deleteMany({ where: { userId: uid } });
        await tx.ticketMessage.deleteMany({ where: { ticket: { userId: uid } } });
        await tx.supportTicket.deleteMany({ where: { userId: uid } });
        await tx.businessReview.deleteMany({ where: { userId: uid } });
        await tx.businessPhoto.deleteMany({ where: { userId: uid } });
        await tx.feedback.deleteMany({ where: { userId: uid } });
        await tx.emailLog.deleteMany({ where: { userId: uid } });
        await tx.booking.deleteMany({ where: { userId: uid } });
        await tx.staff.deleteMany({ where: { userId: uid } });
        await tx.package.deleteMany({ where: { userId: uid } });
        if (email) await tx.passwordReset.deleteMany({ where: { email } });
        await tx.user.delete({ where: { id: uid } });
      },
      {
        // Default 5s is too tight for users with many bookings/notifications.
        timeout: 30_000,
        maxWait: 10_000,
      }
    );

    // Tell the admin what happened with Paddle so an active subscription
    // that couldn't be auto-canceled doesn't slip through unnoticed.
    const paddleWarning =
      paddle.status === "failed"
        ? `Account deleted, but Paddle did NOT confirm cancellation (${paddle.detail || "unknown error"}). Cancel it manually in Paddle.`
        : paddle.status === "not_configured" && (existing as any).paddleSubscriptionId
          ? "Account deleted, but PADDLE_API_KEY isn't set — cancel the subscription manually in Paddle."
          : undefined;

    return NextResponse.json({ success: true, paddle: paddle.status, paddleWarning });
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
