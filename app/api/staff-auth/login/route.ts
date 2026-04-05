import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signStaffToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const staff = await prisma.staff.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { user: { select: { businessName: true, slug: true, logo: true } } },
    });

    if (!staff || !staff.active) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!staff.password) {
      return NextResponse.json({ error: "Account not set up yet. Contact your manager." }, { status: 401 });
    }

    const valid = await verifyPassword(password, staff.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = signStaffToken({ id: staff.id, email: staff.email, userId: staff.userId });

    const { password: _, ...staffData } = staff;
    const response = NextResponse.json({ staff: staffData });

    response.cookies.set("detailbook_staff_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (err) {
    console.error("Staff login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
