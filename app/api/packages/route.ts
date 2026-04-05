import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Public access: if userId query param is provided, return active packages for that user
    if (userId) {
      const packages = await prisma.package.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(packages);
    }

    // Authenticated access: return all packages for the current user
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const packages = await prisma.package.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(packages);
  } catch (error) {
    console.error("GET /api/packages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, price, duration, deposit, active } = body;

    if (!name || !description || price == null || duration == null) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, price, duration" },
        { status: 400 }
      );
    }

    const pkg = await prisma.package.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        duration: parseInt(duration),
        deposit: deposit != null ? parseFloat(deposit) : null,
        active: active !== undefined ? active : true,
        userId: session.id,
      },
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error("POST /api/packages error:", error);
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}
