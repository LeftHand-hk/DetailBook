import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, signToken, signStaffToken } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Try business owner login
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      // Stamp the login time so admins can spot inactive accounts.
      // Fire-and-forget — failure here must not block the login response.
      prisma.user
        .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        .catch((e) => console.error("Failed to update lastLoginAt on login:", e));

      const token = signToken({ id: user.id, email: user.email });
      const { password: _, ...userWithoutPassword } = user;
      const response = NextResponse.json({ user: userWithoutPassword });

      response.cookies.set("detailbook_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }

    // 2. Try staff login
    const staff = await prisma.staff.findFirst({
      where: { email: normalizedEmail },
      include: { user: { select: { businessName: true, slug: true, logo: true } } },
    });

    if (staff && staff.active && staff.password) {
      const isValid = await verifyPassword(password, staff.password);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const token = signStaffToken({ id: staff.id, email: staff.email, userId: staff.userId });
      const { password: _, ...staffData } = staff;
      const response = NextResponse.json({ staff: staffData, isStaff: true });

      response.cookies.set("detailbook_staff_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }

    // 3. Try admin login
    const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
    if (admin) {
      const isValid = await verifyPassword(password, admin.password);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const token = signToken({ id: admin.id, email: admin.email, role: "admin" });
      const { password: _, ...adminData } = admin;
      const response = NextResponse.json({ admin: adminData, isAdmin: true });

      response.cookies.set("detailbook_admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
