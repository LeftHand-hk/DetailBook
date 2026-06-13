import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Dedicated, minimal endpoint for switching the public booking-page design.
//
// The general PUT /api/user can touch dozens of columns and echoes a row
// back; this does the absolute minimum — a single-column UPDATE that SELECTs
// only that column back — so the switch is the fastest possible write and
// can't be slowed down (or 504'd) by any of the heavier user fields. The
// design picker calls this and nothing else.
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const layout = body?.bookingPageLayout;
    if (layout !== "classic" && layout !== "modern") {
      return NextResponse.json(
        { error: "bookingPageLayout must be 'classic' or 'modern'" },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { bookingPageLayout: layout },
      select: { bookingPageLayout: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const code = (error as { code?: string })?.code ? ` [${(error as { code?: string }).code}]` : "";
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Couldn't switch design${code}: ${msg}` },
      { status: 500 },
    );
  }
}
