import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          phone: true,
          plan: true,
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { status, adminReply } = body;

  const existing = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    include: { user: { select: { email: true, name: true, businessName: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: any = {};
  if (status) data.status = status;

  // If admin is replying, save the reply, timestamp, and auto-mark as resolved (if not already set)
  if (adminReply !== undefined && adminReply !== null) {
    data.adminReply = adminReply;
    data.repliedAt = new Date();
    if (!status) data.status = "resolved";
  }

  const updated = await prisma.supportTicket.update({
    where: { id: params.id },
    data,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          phone: true,
          plan: true,
        },
      },
    },
  });

  // Send email notification to the user when admin replies
  if (adminReply && existing.user.email) {
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563EB; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">DetailBook Support</div>
          <h1 style="margin: 8px 0 0; font-size: 22px;">Reply to your ticket</h1>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 14px; color: #374151;">Hi ${escapeHtml(existing.user.name)},</p>
          <p style="font-size: 14px; color: #374151;">We've replied to your support ticket:</p>
          <div style="background: white; border-left: 3px solid #d1d5db; padding: 12px 16px; margin: 12px 0; border-radius: 4px;">
            <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your ticket</div>
            <div style="font-size: 13px; color: #6b7280; font-weight: 600;">${escapeHtml(existing.subject)}</div>
          </div>
          <div style="background: white; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 12px 0;">
            <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px;">Our Reply</div>
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #1f2937;">${escapeHtml(adminReply)}</div>
          </div>
          <p style="font-size: 13px; color: #6b7280;">
            You can also view this reply in your dashboard under <strong>Support</strong>.
          </p>
          <p style="font-size: 13px; color: #6b7280;">— The DetailBook Team</p>
        </div>
      </div>
    `;

    const text = [
      `Hi ${existing.user.name},`,
      ``,
      `We've replied to your support ticket: "${existing.subject}"`,
      ``,
      `--- Our Reply ---`,
      adminReply,
      ``,
      `You can also view this reply in your dashboard under Support.`,
      ``,
      `— The DetailBook Team`,
    ].join("\n");

    sendEmail({
      to: existing.user.email,
      subject: `Re: ${existing.subject}`,
      text,
      html,
    }).catch((err) => console.error("Reply email send error:", err));
  }

  return NextResponse.json(updated);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
