import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const items = await prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = items.filter((n) => !n.read).length;
    return NextResponse.json({ items, unread });
  } catch (e) {
    console.error("GET /api/notifications error:", e);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// Mark all notifications as read for the current user
export async function PATCH(_req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await prisma.notification.updateMany({
      where: { userId: session.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/notifications error:", e);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
