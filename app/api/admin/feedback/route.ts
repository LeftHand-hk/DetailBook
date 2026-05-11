import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// Admin feedback list. Returns the most recent submissions across all
// users with enough user context for the admin to know who sent each.
export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: {
          select: { id: true, email: true, name: true, businessName: true },
        },
      },
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/admin/feedback error:", err);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

// Mark a row as read so the admin list can highlight unread items.
//   PATCH { id, read }
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const read = body?.read !== false;
    const updated = await prisma.feedback.update({ where: { id }, data: { read } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/admin/feedback error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
