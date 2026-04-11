import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const SUPPORT_INBOX = process.env.SUPPORT_INBOX || "info@detailbookapp.com";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subject, message, category } = body;

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    if (subject.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: "Subject or message too long" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true, email: true, name: true, businessName: true, plan: true, phone: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const priority = user.plan === "pro" ? "priority" : "normal";

    // Save ticket to DB
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: subject.trim(),
        message: message.trim(),
        category: category || "general",
        priority,
      },
    });

    // Send email notification (non-blocking on failure)
    const priorityTag = priority === "priority" ? "[PRIORITY]" : "[NORMAL]";
    const emailSubject = `${priorityTag} ${subject.trim()}`;

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${priority === "priority" ? "#3B82F6" : "#6B7280"}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">
            ${priority === "priority" ? "Priority Support Ticket" : "Support Ticket"}
          </div>
          <h1 style="margin: 8px 0 0; font-size: 22px;">${escapeHtml(subject)}</h1>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0;"><strong>From:</strong></td><td>${escapeHtml(user.name)}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Business:</strong></td><td>${escapeHtml(user.businessName)}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Email:</strong></td><td><a href="mailto:${user.email}">${escapeHtml(user.email)}</a></td></tr>
            ${user.phone ? `<tr><td style="padding: 4px 0;"><strong>Phone:</strong></td><td>${escapeHtml(user.phone)}</td></tr>` : ""}
            <tr><td style="padding: 4px 0;"><strong>Plan:</strong></td><td style="text-transform: capitalize;">${user.plan}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Category:</strong></td><td style="text-transform: capitalize;">${escapeHtml(category || "general")}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Ticket ID:</strong></td><td style="font-family: monospace; font-size: 12px;">${ticket.id}</td></tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
            <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px;">Message</div>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #1f2937;">${escapeHtml(message)}</div>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
            Reply to this email to respond directly to the customer.
          </p>
        </div>
      </div>
    `;

    const text = [
      `${priority === "priority" ? "PRIORITY SUPPORT TICKET" : "SUPPORT TICKET"}`,
      ``,
      `Subject: ${subject}`,
      `From: ${user.name}`,
      `Business: ${user.businessName}`,
      `Email: ${user.email}`,
      user.phone ? `Phone: ${user.phone}` : "",
      `Plan: ${user.plan}`,
      `Category: ${category || "general"}`,
      `Ticket ID: ${ticket.id}`,
      ``,
      `--- MESSAGE ---`,
      message,
      ``,
      `Reply to this email to respond directly to the customer.`,
    ].filter(Boolean).join("\n");

    sendEmail({
      to: SUPPORT_INBOX,
      subject: emailSubject,
      text,
      html,
      replyTo: user.email,
    }).catch((err) => console.error("Support email send error:", err));

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (error) {
    console.error("POST /api/support/ticket error:", error);
    return NextResponse.json({ error: "Failed to submit ticket" }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
