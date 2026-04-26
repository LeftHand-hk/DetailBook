import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = body?.userId;
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Short-lived impersonation token (2 hours) so a forgotten admin session
    // doesn't leave a lingering user-level cookie.
    const token = jwt.sign(
      {
        id: target.id,
        email: target.email,
        role: "user",
        impersonatedBy: admin.id,
        impersonatedByEmail: admin.email,
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    const res = NextResponse.json({ success: true });
    // httpOnly auth cookie
    res.cookies.set("detailbook_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60,
    });
    // JS-readable flag so the dashboard can show a banner
    res.cookies.set("detailbook_impersonating", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60,
    });
    return res;
  } catch (error) {
    console.error("POST /api/admin/users/impersonate error:", error);
    return NextResponse.json({ error: "Failed to impersonate" }, { status: 500 });
  }
}

export async function DELETE() {
  // No admin check — anyone holding an impersonation cookie can drop it.
  // Admin cookie is separate and untouched, so admin remains logged in.
  const res = NextResponse.json({ success: true });
  res.cookies.set("detailbook_token", "", { path: "/", maxAge: 0 });
  res.cookies.set("detailbook_impersonating", "", { path: "/", maxAge: 0 });
  return res;
}
