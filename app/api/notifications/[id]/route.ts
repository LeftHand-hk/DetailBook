import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Mark a single notification as read
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const n = await prisma.notification.findUnique({ where: { id: params.id } });
    if (!n || n.userId !== session.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.notification.update({
      where: { id: params.id },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/notifications/[id] error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
