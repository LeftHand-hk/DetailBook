import type { NextRequest } from "next/server";

// Extracts the visitor's IP address from a Next.js request, preferring
// platform-specific headers that hold the true client IP rather than the
// edge proxy's address.
//
// Order: Netlify-injected `x-nf-client-connection-ip` → first entry of
// `x-forwarded-for` (standard) → `x-real-ip` (some proxies). Returns
// null in dev where no proxy adds these headers.
export function getClientIp(request: NextRequest): string | null {
  const nf = request.headers.get("x-nf-client-connection-ip");
  if (nf) return nf.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  return null;
}

// Extracts the ISO-3166 alpha-2 country code from request headers.
// Netlify Edge populates `x-country` automatically for every request.
// Cloudflare uses `cf-ipcountry`. Returns null when not running behind
// such a proxy (e.g. local dev) — caller should treat that as "unknown".
export function getClientCountry(request: NextRequest): string | null {
  const candidates = [
    request.headers.get("x-country"),
    request.headers.get("x-nf-country"),
    request.headers.get("cf-ipcountry"),
    request.headers.get("x-vercel-ip-country"),
  ];

  for (const value of candidates) {
    if (value && value.length === 2 && /^[A-Za-z]{2}$/.test(value)) {
      return value.toUpperCase();
    }
  }

  return null;
}

// Converts an ISO-3166 alpha-2 country code into the matching flag emoji
// using regional indicator symbols (U+1F1E6..U+1F1FF). Returns an empty
// string for invalid codes so callers can render unconditionally.
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return "";
  const upper = code.toUpperCase();
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + upper.charCodeAt(0) - 65,
    A + upper.charCodeAt(1) - 65
  );
}
