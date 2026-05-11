import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";

const VALID_TYPES = new Set(["suggestion", "review", "bug"]);

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const ratingRaw = body?.rating;

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Message is too long (max 4000 characters)" },
        { status: 400 },
      );
    }

    let rating: number | null = null;
    if (type === "review") {
      const n = typeof ratingRaw === "number" ? ratingRaw : parseInt(String(ratingRaw), 10);
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        return NextResponse.json(
          { error: "Reviews need a rating between 1 and 5" },
          { status: 400 },
        );
      }
      rating = n;
    }

    const created = await prisma.feedback.create({
      data: {
        userId: session.id,
        type,
        rating,
        message,
      },
    });

    // Fire-off a notification email to the founder so feedback gets
    // seen even if the admin panel isn't being checked. Fire-and-forget
    // is OK here — the DB row is the source of truth; the email is a
    // nudge. We await it so on serverless the send actually completes.
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { email: true, businessName: true, name: true },
      });
      if (user) {
        const typeLabel = type === "bug" ? "Bug report"
          : type === "review" ? `Review${rating ? ` (${rating}★)` : ""}`
          : "Suggestion";
        await sendEmail({
          to: "info@detailbookapp.com",
          subject: `[${typeLabel}] from ${user.businessName || user.email}`,
          text: `Type: ${typeLabel}\nFrom: ${user.name || ""} <${user.email}>\nBusiness: ${user.businessName || ""}\n\n${message}`,
          html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;padding:16px;">
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${escapeHtml(typeLabel)}</p>
            <p style="margin:0 0 4px;font-size:14px;"><strong>${escapeHtml(user.name || "")}</strong> &lt;${escapeHtml(user.email)}&gt;</p>
            <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${escapeHtml(user.businessName || "")}</p>
            <pre style="font-family:-apple-system,sans-serif;white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:13px;color:#111;">${escapeHtml(message)}</pre>
          </div>`,
        });
      }
    } catch (err) {
      console.error("[feedback] notify email failed:", err);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/feedback error:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

// Lists the calling user's own feedback so the dashboard page can show
// a history below the form.
export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.feedback.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/feedback error:", err);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
