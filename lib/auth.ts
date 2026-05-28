import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * Whether the auth cookie should carry the `Secure` flag.
 *
 * We can't key this off NODE_ENV: `next start` forces NODE_ENV=production,
 * which would mark the cookie Secure even when the app is served over plain
 * HTTP on a LAN IP (e.g. http://192.168.x.x:3000 for phone testing).
 * Browsers silently DROP Secure cookies on non-HTTPS origins (localhost is
 * the only HTTP exception), so the session cookie never gets stored and the
 * user looks "not logged in" (e.g. "Account not loaded" at the card step).
 *
 * Instead we read the actual request protocol. Behind Netlify / any proxy
 * the original scheme is in `x-forwarded-proto`; we fall back to the request
 * URL's own protocol. Result: HTTPS (production) → Secure; HTTP (LAN/local)
 * → not Secure. This is strictly more correct than the NODE_ENV check.
 */
export function cookieSecure(request: NextRequest): boolean {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    request.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  throw new Error("JWT_SECRET environment variable must be set (at least 16 characters)");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: {
  id: string;
  email: string;
  role?: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(
  token: string
): { id: string; email: string; role?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

// In-memory throttle so a hot serverless instance doesn't re-write
// lastLoginAt on every authenticated request. Across cold starts this
// resets and we do at most one extra update — the DB WHERE clause keeps
// it atomic so concurrent requests can't double-write either.
const recentActivityWrites = new Map<string, number>();
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export async function getSessionUser(): Promise<{
  id: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("detailbook_token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  // "Last active" heartbeat. The lastLoginAt column doubles as the
  // most-recent-activity timestamp the admin dashboard shows — a user who
  // stays signed in via remember-me but keeps using the app needs to look
  // active, not stuck on whenever they last hit the login form. Fire-and-
  // forget; only writes if the row is >5min stale so writes are cheap.
  const now = Date.now();
  const last = recentActivityWrites.get(payload.id) || 0;
  if (now - last > HEARTBEAT_INTERVAL_MS) {
    recentActivityWrites.set(payload.id, now);
    // Lazy import keeps this file safe to use from contexts (middleware,
    // tests) that don't want the Prisma client bundled in.
    import("./prisma").then(({ default: prisma }) => {
      const fiveMinAgo = new Date(now - HEARTBEAT_INTERVAL_MS);
      return prisma.user.updateMany({
        where: { id: payload.id, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: fiveMinAgo } }] },
        data: { lastLoginAt: new Date(now) },
      });
    }).catch(() => { /* heartbeat must never break auth */ });
  }

  return payload;
}

export async function getAdminSession(): Promise<{
  id: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("detailbook_admin_token")?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

export function signStaffToken(payload: {
  id: string;
  email: string;
  userId: string; // owner's userId
}): string {
  return jwt.sign({ ...payload, role: "staff" }, JWT_SECRET, { expiresIn: "30d" });
}

export function isTrialExpired(user: { trialEndsAt?: string; subscriptionStatus?: string | null }): boolean {
  if (user.subscriptionStatus === "active") return false;
  if (!user.trialEndsAt) return false;
  return new Date(user.trialEndsAt) < new Date();
}

export async function getStaffSession(): Promise<{
  id: string;
  email: string;
  userId: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("detailbook_staff_token")?.value;
  if (!token) return null;
  const payload = verifyToken(token) as any;
  if (!payload || payload.role !== "staff") return null;
  return { id: payload.id, email: payload.email, userId: payload.userId };
}
