import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { isValidEmail, validatePassword } from "@/lib/validation";
import { getClientIp, getClientCountry } from "@/lib/geo";
import { sendWelcomeEmail } from "@/lib/welcome-emails";

function generateSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, businessName, name, phone, city, promoCode, timezone } = body;

    if (!email || !password || !businessName || !name) {
      return NextResponse.json(
        { error: "Email, password, business name, and name are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    // Validate promo code if provided
    let promoData: { code: string; discountValue: number; discountType: string; appliesTo: string } | null = null;
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCode.toUpperCase().trim() },
      });
      if (
        promo &&
        promo.active &&
        (!promo.expiresAt || new Date(promo.expiresAt) > new Date()) &&
        (promo.maxUses === null || promo.usedCount < promo.maxUses)
      ) {
        promoData = {
          code: promo.code,
          discountValue: promo.discountValue,
          discountType: promo.discountType,
          appliesTo: promo.appliesTo,
        };
        await prisma.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    let slug = generateSlug(businessName);
    const existingSlug = await prisma.user.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const hashedPassword = await hashPassword(password);

    // Default 7-day trial; promo codes of type "free_months" extend this.
    const trialEndsAt = new Date();
    if (promoData?.discountType === "free_months") {
      const months = Math.max(1, Math.min(3, Math.round(promoData.discountValue)));
      trialEndsAt.setMonth(trialEndsAt.getMonth() + months);
    } else {
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    }

    // If the free_months promo applies to a specific plan, grant that plan for the trial.
    const plan = promoData?.discountType === "free_months" && (promoData.appliesTo === "starter" || promoData.appliesTo === "pro")
      ? promoData.appliesTo
      : "starter";

    // Validate the browser-reported IANA timezone; fall back to America/New_York.
    const safeTimezone = (() => {
      if (!timezone || typeof timezone !== "string") return undefined;
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
        return timezone;
      } catch {
        return undefined;
      }
    })();

    // Capture the visitor's IP and country from edge headers — used by
    // admin to know which country an account signed up from. Both will be
    // null in local dev where no proxy populates these headers.
    const signupIp = getClientIp(request);
    const signupCountry = getClientCountry(request);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        businessName,
        name,
        phone: phone || "",
        city: city || "",
        slug,
        plan,
        trialEndsAt: trialEndsAt.toISOString(),
        promoCodeUsed: promoData?.code || null,
        promoDiscount: promoData?.discountValue || null,
        signupIp,
        signupCountry,
        ...(safeTimezone ? { timezone: safeTimezone } : {}),
      },
    });

    const token = signToken({ id: user.id, email: user.email });

    // Day 0 welcome email — fire and forget. Awaiting it here used to
    // make sense for retry reliability, but with 3 attempts × ~10s SMTP
    // timeouts the worst case (~30s) blew past Netlify's 10s function
    // timeout and signup itself started failing for new users. Two
    // safety nets keep email delivery intact:
    //   1. sendEmail now has tight SMTP timeouts (5/5/10s) so a single
    //      attempt fails fast — Netlify usually keeps the function
    //      alive past the response long enough to complete it.
    //   2. The hourly /api/cron/welcome-emails picks up any user with
    //      welcomeEmailDay0At still null and re-runs sendWelcomeEmail.
    sendWelcomeEmail(user.id, "day0").catch((err) => {
      console.error("[register] welcome day0 email failed:", err);
    });

    const { password: _, ...userWithoutPassword } = user;

    const response = NextResponse.json(
      { user: userWithoutPassword },
      { status: 201 }
    );

    response.cookies.set("detailbook_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
