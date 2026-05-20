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

// Editable fields, grouped by section on /admin/data. Keep this list
// tight — anything not in here is silently dropped, so a stray field
// in the admin UI can't clobber server-managed columns like id,
// createdAt, paddleCustomerId, or password.
const EDITABLE_FIELDS = new Set<string>([
  // Account
  "email", "name", "businessName", "phone",
  // Business Profile
  "slug", "address", "city", "serviceType", "timezone", "bio",
  "yearsInBusiness", "instagram", "facebook", "website",
  "serviceAreas", "businessHours",
  // Booking Page
  "bookingPageTitle", "bookingPageSubtitle", "bookingPageTheme",
  "accentColor", "serviceLayout", "bannerOverlayOpacity",
  "showRating", "showSocialLinks", "showServiceAreas",
  "showBusinessHours", "showTrustBadges",
  "thankYouMessage", "termsText", "customMessage", "advanceBookingDays",
  // Subscription overrides (admin support tasks)
  "plan", "trialEndsAt", "subscriptionStatus", "suspended",
]);

const STRING_NULLABLE = new Set<string>([
  "phone", "address", "city", "bio", "instagram", "facebook", "website",
  "bookingPageTitle", "bookingPageSubtitle", "thankYouMessage", "termsText",
  "customMessage", "trialEndsAt", "subscriptionStatus",
]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(body)) {
      if (!EDITABLE_FIELDS.has(key)) continue;
      const value = raw;

      // Numbers
      if (key === "yearsInBusiness" || key === "advanceBookingDays" || key === "bannerOverlayOpacity") {
        const n = typeof value === "number" ? value : parseInt(String(value), 10);
        if (Number.isFinite(n)) data[key] = n;
        continue;
      }

      // Booleans
      if (
        key === "showRating" || key === "showSocialLinks" || key === "showServiceAreas" ||
        key === "showBusinessHours" || key === "showTrustBadges" || key === "suspended"
      ) {
        data[key] = Boolean(value);
        continue;
      }

      // Service areas — accept array or comma-separated string.
      if (key === "serviceAreas") {
        if (Array.isArray(value)) {
          data[key] = value.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
        } else if (typeof value === "string") {
          data[key] = value.split(",").map((s) => s.trim()).filter(Boolean);
        }
        continue;
      }

      // Business hours JSON.
      if (key === "businessHours") {
        if (value && typeof value === "object") data[key] = value;
        continue;
      }

      // Slug — normalise and ensure uniqueness against any OTHER user.
      // This is the public booking-page URL, so we treat changes here
      // as a real rename and forbid collisions.
      if (key === "slug") {
        if (typeof value !== "string") continue;
        const cleaned = slugify(value);
        if (!cleaned) {
          return NextResponse.json({ error: "Slug must contain letters or numbers." }, { status: 400 });
        }
        const clash = await prisma.user.findFirst({
          where: { slug: cleaned, NOT: { id: params.id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json(
            { error: `Slug "${cleaned}" is already taken by another account.` },
            { status: 409 },
          );
        }
        data[key] = cleaned;
        continue;
      }

      // Email — normalise + validate + uniqueness check.
      if (key === "email") {
        if (typeof value !== "string") continue;
        const normalised = value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) {
          return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
        }
        const clash = await prisma.user.findFirst({
          where: { email: normalised, NOT: { id: params.id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json(
            { error: "Another account is already using that email." },
            { status: 409 },
          );
        }
        data[key] = normalised;
        continue;
      }

      // Nullable strings — empty string saved as "", explicit null clears.
      if (STRING_NULLABLE.has(key)) {
        if (typeof value === "string") data[key] = value;
        else if (value === null) data[key] = null;
        continue;
      }

      // Plain strings (name, businessName, serviceType, etc.)
      if (typeof value === "string") data[key] = value;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      omit: {
        password: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        welcomeUnsubToken: true,
      },
      include: {
        _count: {
          select: { packages: true, bookings: true, staff: true },
        },
      },
    });

    console.log("[admin] user", params.id, "patched fields:", Object.keys(data).join(","));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
