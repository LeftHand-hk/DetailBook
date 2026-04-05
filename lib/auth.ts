import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "detailbook-secret";

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

export async function getSessionUser(): Promise<{
  id: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("detailbook_token")?.value;
  if (!token) return null;
  return verifyToken(token);
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
