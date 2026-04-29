import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { sendEmail } from "@/lib/email";

// Convert a "YYYY-MM-DD" + "h:mm AM/PM" + IANA timezone into the actual UTC instant.
// Plain `new Date(date + "T00:00:00")` interprets in the SERVER timezone (UTC on Netlify),
// which silently shifts every appointment by hours and breaks the reminder window.
function bookingMomentInUtc(date: string, time: string, tz: string): Date | null {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  const [Y, M, D] = date.split("-").map((s) => parseInt(s, 10));
  if (!Y || !M || !D || isNaN(h) || isNaN(min)) return null;

  // Start with naive UTC interpretation of the wall-clock.
  const naive = Date.UTC(Y, M - 1, D, h, min, 0);
  // Render that instant in the user's timezone — the difference between
  // what we got and what we wanted is the offset we must subtract.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = fmt.formatToParts(new Date(naive));
  const obj: Record<string, string> = {};
  for (const p of parts) obj[p.type] = p.value;
  const tzMs = Date.UTC(
    parseInt(obj.year, 10),
    parseInt(obj.month, 10) - 1,
    parseInt(obj.day, 10),
    parseInt(obj.hour, 10),
    parseInt(obj.minute, 10),
    0
  );
  const offset = tzMs - naive;
  return new Date(naive - offset);
}

const DEFAULT_SMS_REMINDER =
  "Reminder: Your {serviceName} appointment is in 2 hours at {time}. See you soon! — {businessName}";
const DEFAULT_EMAIL_REMINDER =
  "Hi {customerName},\n\nJust a friendly reminder that your {serviceName} appointment is in 2 hours at {time}.\n\nPlease make sure your vehicle is accessible and ready.\n\nSee you soon!\n— {businessName}";

// Secured cron endpoint — called every 30 minutes by cron-job.org
// Sends SMS and email reminders to customers whose appointment is ~2 hours away
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // Wide string-date filter so timezone math can fit either side of midnight.
    // We re-check the precise window per booking after parsing in the user's tz.
    const dayBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dayAfter  = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const bookings = await prisma.booking.findMany({
      where: {
        reminderSentAt: null,
        status: { in: ["pending", "confirmed"] },
        date: { gte: dayBefore, lte: dayAfter },
      },
      include: { user: true },
    });

    const results: { id: string; sms?: string; email?: string; reason?: string }[] = [];

    for (const booking of bookings) {
      const tz = (booking.user as any)?.timezone || "America/New_York";
      const apptUtc = bookingMomentInUtc(booking.date, booking.time, tz);
      if (!apptUtc) {
        results.push({ id: booking.id, reason: "Could not parse time" });
        continue;
      }

      const diffMs = apptUtc.getTime() - now.getTime();
      if (diffMs < 90 * 60 * 1000 || diffMs > 150 * 60 * 1000) {
        // Outside 90–150 minute window — skip silently (don't pollute results)
        continue;
      }

      const ctx: Record<string, string> = {
        customerName: booking.customerName || "",
        serviceName: booking.serviceName || "",
        date: new Date(booking.date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
        }),
        time: booking.time || "",
        businessName: booking.user.businessName || "",
      };
      const render = (tpl: string) => tpl.replace(/\{(\w+)\}/g, (_m, k) => ctx[k] ?? "");

      const u: any = booking.user;
      let smsResult: string | undefined;
      let emailResult: string | undefined;

      // SMS reminder — Pro plan + smsRemindersEnabled + customer phone present
      if (u.plan === "pro" && u.smsRemindersEnabled && booking.customerPhone) {
        const tpl = u.smsTemplates?.reminder24h || DEFAULT_SMS_REMINDER;
        const body = render(tpl);
        const r = await sendSms(booking.customerPhone, body).catch((err) => ({ success: false, error: String(err) }));
        smsResult = r.success ? "sent" : `failed: ${r.error}`;
      } else {
        smsResult = "skipped";
      }

      // Email reminder — emailRemindersEnabled + customer email present (no plan gate)
      if (u.emailRemindersEnabled !== false && booking.customerEmail) {
        const tpl = u.emailTemplates?.reminder24h || DEFAULT_EMAIL_REMINDER;
        const text = render(tpl);
        const html = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap;">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        const r = await sendEmail({
          to: booking.customerEmail,
          subject: `Reminder: ${booking.serviceName} in 2 hours`,
          html,
          text,
        }).catch((err) => ({ success: false, error: String(err) }));
        emailResult = r.success ? "sent" : `failed: ${(r as any).error}`;
      } else {
        emailResult = "skipped";
      }

      // Mark sent so we don't retry — even if both were skipped (toggle off),
      // we don't want to keep polling this row forever.
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });

      results.push({ id: booking.id, sms: smsResult, email: emailResult });
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("Reminders cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
