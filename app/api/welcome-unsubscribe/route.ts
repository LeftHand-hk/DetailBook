import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// One-click unsubscribe. Linked from the bottom of every welcome email.
// Token is stored on the user row (welcomeUnsubToken) and is unique, so
// there's no need for the user to be logged in to unsubscribe.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!token) {
    return htmlResponse(`<h1>Invalid link</h1><p>This unsubscribe link is missing a token.</p>`, 400);
  }

  const user = await prisma.user.findUnique({
    where: { welcomeUnsubToken: token },
    select: { id: true, email: true, welcomeEmailsPaused: true },
  });

  if (!user) {
    return htmlResponse(
      `<h1>Link not found</h1><p>This unsubscribe link is no longer valid. If you keep getting emails, reply to one and we'll remove you manually.</p>`,
      404,
    );
  }

  if (!user.welcomeEmailsPaused) {
    await prisma.user.update({
      where: { id: user.id },
      data: { welcomeEmailsPaused: true },
    });
  }

  return htmlResponse(
    `<h1>You're unsubscribed</h1>
     <p>You won't receive any more onboarding emails from DetailBook for <strong>${escapeHtml(user.email)}</strong>.</p>
     <p>You'll still get important account emails (booking confirmations, password resets, billing).</p>
     <p style="margin-top:32px;"><a href="https://detailbookapp.com" style="color:#2563eb;">← Back to detailbookapp.com</a></p>`,
    200,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlResponse(inner: string, status: number) {
  const body = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Unsubscribe — DetailBook</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;">
  <div style="max-width:520px;margin:64px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;">
    ${inner}
  </div>
</body></html>`;
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
