// ──────────────────────────────────────────────────────────────────────────
// Booking-page design settings — the ONE place the whole booking-page design
// infrastructure agrees on.
//
// Why this exists: the design (classic vs modern + every customization field)
// used to be written by three different things — the classic editor, the
// modern editor, and the background whole-user sync (storage.setUser) — all
// hitting PUT /api/user with overlapping field sets, plus a fourth path
// (/api/user/layout) for the design toggle. With no single writer, a stale
// background sync would silently revert a just-made change ("it won't save"),
// and re-sending heavy fields blew past the serverless timeout (HTTP 504).
//
// Now there is exactly one reader and one writer: GET / PATCH /api/booking-page.
// Every dashboard surface (picker + both editors) goes through the helpers
// below, and the API whitelists writes against BOOKING_PAGE_FIELDS — so the
// client and server can never drift, and nothing else can touch these columns.
// ──────────────────────────────────────────────────────────────────────────

// The canonical set of writable booking-page design fields. Imported by the
// API route (as its PATCH whitelist) AND used here, so the two can't diverge.
// NOTE: deliberately excludes billing/auth/subscription fields — this resource
// owns ONLY the public booking-page design.
export const BOOKING_PAGE_FIELDS = [
  // Business profile shown on the page
  "slug", "businessName", "name", "bio", "city", "address",
  "yearsInBusiness", "serviceAreas",
  "phone", "instagram", "facebook", "website",
  // Brand images (stored as small CDN URLs; see lib/image-upload)
  "logo", "bannerImage", "coverImage",
  // Branding / appearance
  "bannerOverlayOpacity", "serviceLayout", "bookingPageTheme", "accentColor",
  "bookingPageTitle", "bookingPageSubtitle",
  // Content visibility toggles
  "showRating", "showSocialLinks", "showServiceAreas", "showBusinessHours", "showTrustBadges",
  // Messages
  "customMessage", "thankYouMessage", "termsText",
  // Booking rules
  "advanceBookingDays",
  // Gallery display
  "galleryLayout", "galleryShowTitle", "galleryTitle",
  // Reviews display
  "reviewsLayout", "reviewsShowStars", "reviewsShowAvatars", "reviewsShowDates",
  // Free-form v2 copy overrides + the design selector itself
  "pageContent", "bookingPageLayout",
] as const;

export type BookingPageField = (typeof BOOKING_PAGE_FIELDS)[number];

// The three brand-image columns. They hold a tiny CDN URL today (uploads go to
// Supabase Storage) but legacy rows may still hold base64. The API never writes
// the placeholder binary-route URLs back into them.
export const IMAGE_FIELDS = ["logo", "bannerImage", "coverImage"] as const;

export type BookingPageLayout = "classic" | "modern";

// Everything the editors/picker read back. Extra read-only fields (id, plan,
// rating, reviewCount) ride along for the UI; they are not in the write set.
export interface BookingPageSettings {
  id: string;
  plan: string;
  slug: string;
  businessName: string;
  name: string | null;
  bio: string | null;
  city: string | null;
  address: string | null;
  yearsInBusiness: number | null;
  serviceAreas: string[] | null;
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  logo: string | null;
  bannerImage: string | null;
  coverImage: string | null;
  bannerOverlayOpacity: number;
  serviceLayout: string;
  bookingPageTheme: string;
  accentColor: string;
  bookingPageTitle: string | null;
  bookingPageSubtitle: string | null;
  showRating: boolean;
  showSocialLinks: boolean;
  showServiceAreas: boolean;
  showBusinessHours: boolean;
  showTrustBadges: boolean;
  customMessage: string | null;
  thankYouMessage: string | null;
  termsText: string | null;
  advanceBookingDays: number;
  galleryLayout: string;
  galleryShowTitle: boolean;
  galleryTitle: string;
  reviewsLayout: string;
  reviewsShowStars: boolean;
  reviewsShowAvatars: boolean;
  reviewsShowDates: boolean;
  pageContent: Record<string, unknown> | null;
  bookingPageLayout: BookingPageLayout;
  [key: string]: unknown;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Read: the single GET. Returns null on any failure so callers can fall
// back to their local cache for an instant first paint. ──
export async function fetchBookingPageSettings(): Promise<BookingPageSettings | null> {
  try {
    const res = await fetch("/api/booking-page", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data?.settings as BookingPageSettings) ?? null;
  } catch {
    return null;
  }
}

// ── Write: the single PATCH. Sends ONLY the fields in `patch` (a partial
// update), and RETRIES transient 5xx/504/network failures a few times with
// backoff — a 504 here is almost always the connection pool being momentarily
// busy, so a retry a beat later succeeds instead of surfacing a hard error. A
// 4xx (e.g. slug taken) is a real rejection and returns immediately. ──
export async function saveBookingPageSettings(
  patch: Record<string, unknown>,
): Promise<SaveResult> {
  const layoutOnly =
    Object.keys(patch).length === 1 &&
    (patch.bookingPageLayout === "classic" || patch.bookingPageLayout === "modern");
  const endpoint = layoutOnly ? "/api/user/layout" : "/api/booking-page";
  const method = layoutOnly ? "PUT" : "PATCH";

  let lastError = "Couldn't save. Please try again.";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        cache: "no-store",
      });
      if (res.ok) return { ok: true };
      if (res.status < 500) {
        const data = await res.json().catch(() => null);
        return { ok: false, error: data?.error || `Couldn't save (HTTP ${res.status}).` };
      }
      lastError = `Server busy (HTTP ${res.status}).`;
    } catch {
      lastError = "Network error.";
    }
    await sleep(400 * (attempt + 1)); // 400ms, 800ms backoff
  }
  return { ok: false, error: `${lastError} Please try again.` };
}
