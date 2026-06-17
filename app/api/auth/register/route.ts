import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken, cookieSecure } from "@/lib/auth";
import { isValidEmail, validatePassword } from "@/lib/validation";
import { getClientIp, getClientCountry } from "@/lib/geo";
// The app-owned trial begins at signup. The hourly email cron delivers the
// onboarding sequence without making registration wait on SMTP.

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
    let promoData: {
      id: string;
      code: string;
      discountValue: number;
      discountType: string;
      appliesTo: string;
      maxUses: number | null;
    } | null = null;
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
          id: promo.id,
          code: promo.code,
          discountValue: promo.discountValue,
          discountType: promo.discountType,
          appliesTo: promo.appliesTo,
          maxUses: promo.maxUses,
        };
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

    const user = await prisma.$transaction(async (tx) => {
      if (promoData) {
        const claimed = await tx.promoCode.updateMany({
          where: {
            id: promoData.id,
            active: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
            ...(promoData.maxUses === null
              ? {}
              : { usedCount: { lt: promoData.maxUses } }),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw new Error("PROMO_NO_LONGER_AVAILABLE");
        }
      }

      return tx.user.create({
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
          // New accounts ship on the modern (v2) booking page. The schema
          // default is still "classic" so existing accounts aren't migrated
          // out from under their preference; only fresh signups land on v2.
          bookingPageLayout: "modern",
          ...(safeTimezone ? { timezone: safeTimezone } : {}),
        },
      });
    });

    const token = signToken({ id: user.id, email: user.email });

    // Email delivery stays out of this request so SMTP retries cannot make
    // signup time out. The hourly cron sends the day 1/3/5/7 sequence.

    const { password: _, ...userWithoutPassword } = user;

    const response = NextResponse.json(
      { user: userWithoutPassword },
      { status: 201 }
    );

    response.cookies.set("detailbook_token", token, {
      httpOnly: true,
      secure: cookieSecure(request),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "PROMO_NO_LONGER_AVAILABLE") {
      return NextResponse.json(
        { error: "This promo code is no longer available." },
        { status: 400 }
      );
    }
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
