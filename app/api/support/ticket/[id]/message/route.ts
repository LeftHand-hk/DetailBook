import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const SUPPORT_INBOX = process.env.SUPPORT_INBOX || "info@detailbookapp.com";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, email: true, name: true, businessName: true } } },
    });

    if (!ticket || ticket.userId !== session.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (ticket.status === "resolved" || ticket.status === "closed") {
      return NextResponse.json({ error: "Ticket is closed" }, { status: 400 });
    }

    const body = await req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: "user",
        content: content.trim(),
      },
    });

    // Set ticket back to open so admin sees it needs attention
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "open" },
    });

    // Email admin about follow-up
    sendEmail({
      to: SUPPORT_INBOX,
      subject: `[Follow-up] ${ticket.subject}`,
      text: `${ticket.user.name} sent a follow-up on ticket #${ticket.id.slice(-8)}:\n\n${content.trim()}`,
      html: `<p><strong>${ticket.user.name}</strong> sent a follow-up on ticket "<strong>${ticket.subject}</strong>":</p><p>${content.trim()}</p>`,
      replyTo: ticket.user.email,
    }).catch(() => {});

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("POST follow-up error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
