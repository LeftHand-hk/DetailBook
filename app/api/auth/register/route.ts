import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

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
    const { email, password, businessName, name, phone, city } = body;

    if (!email || !password || !businessName || !name) {
      return NextResponse.json(
        { error: "Email, password, business name, and name are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
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

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        businessName,
        name,
        phone: phone || "",
        city: city || "",
        slug,
        plan: "starter",
        trialEndsAt: trialEndsAt.toISOString(),
      },
    });

    const token = signToken({ id: user.id, email: user.email });

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
