import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/sms
//   → list of conversations (latest message per contact + unread count)
// GET /api/admin/sms?contact=+1555…
//   → full message thread for one contact (also marks inbound as read)
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contact = req.nextUrl.searchParams.get("contact");

  try {
    if (contact) {
      const messages = await prisma.smsMessage.findMany({
        where: { contact },
        orderBy: { createdAt: "asc" },
      });
      // Mark inbound messages in this thread as read.
      await prisma.smsMessage.updateMany({
        where: { contact, direction: "inbound", read: false },
        data: { read: true },
      });
      return NextResponse.json({ messages });
    }

    // Conversation list. Pull recent messages and fold them down to one
    // entry per contact in JS — the volume here is admin-scale (one
    // business owner triaging texts), so a windowed scan is plenty and
    // avoids a groupBy + correlated-subquery dance.
    const recent = await prisma.smsMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const byContact = new Map<string, {
      contact: string;
      lastBody: string;
      lastDirection: string;
      lastAt: Date;
      unread: number;
    }>();

    for (const m of recent) {
      const existing = byContact.get(m.contact);
      if (!existing) {
        byContact.set(m.contact, {
          contact: m.contact,
          lastBody: m.body,
          lastDirection: m.direction,
          lastAt: m.createdAt,
          unread: m.direction === "inbound" && !m.read ? 1 : 0,
        });
      } else if (m.direction === "inbound" && !m.read) {
        existing.unread += 1;
      }
    }

    const conversations = Array.from(byContact.values())
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("GET /api/admin/sms error:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
