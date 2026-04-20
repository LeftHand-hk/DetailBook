import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      // Invalidate any existing tokens for this email
      await prisma.passwordReset.updateMany({
        where: { email: normalizedEmail, used: false },
        data: { used: true },
      });

      // Create new token (valid for 1 hour)
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordReset.create({
        data: { email: normalizedEmail, token, expiresAt },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://detailbookapp.com";
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      await sendEmail({
        to: normalizedEmail,
        subject: "Reset Your Password — DetailBook",
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
              <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">DetailBook</div>
              <h1 style="margin:8px 0 0;font-size:20px;">Password Reset</h1>
            </div>
            <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="font-size:14px;color:#374151;margin:0 0 16px;">
                Hi ${user.name},
              </p>
              <p style="font-size:14px;color:#374151;margin:0 0 20px;">
                We received a request to reset your password. Click the button below to choose a new one:
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${resetUrl}" style="background:#2563EB;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;display:inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </div>`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
