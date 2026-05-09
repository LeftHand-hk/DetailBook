import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Validates the addons payload from the owner. We accept an array of
// {id?, name, price} objects, drop anything malformed, and regenerate
// ids server-side so the front-end can't smuggle collisions. Returns
// the cleaned array (or null when the field was not provided — caller
// distinguishes "leave alone" from "set to empty list").
function sanitizeAddons(input: unknown): unknown[] | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (!Array.isArray(input)) return null;
  const out: { id: string; name: string; price: number }[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const priceNum = typeof r.price === "number" ? r.price : parseFloat(String(r.price));
    if (!name || !Number.isFinite(priceNum) || priceNum < 0) continue;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : `a_${Math.random().toString(36).slice(2, 10)}`,
      name,
      price: Math.round(priceNum * 100) / 100,
    });
  }
  return out;
}

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

    const cleanedAddons = sanitizeAddons(body.addons);

    const pkg = await prisma.package.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        duration: parseInt(duration),
        deposit: deposit != null ? parseFloat(deposit) : null,
        active: active !== undefined ? active : true,
        addons: cleanedAddons === undefined ? undefined : (cleanedAddons as any),
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
