import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!ticket || ticket.userId !== session.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.supportTicket.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE ticket error:", error);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}
