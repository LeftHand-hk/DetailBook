import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";

// Secured cron endpoint — called every 30 minutes by Vercel Cron
// Sends SMS reminders to customers whose appointment is ~2 hours away
export async function GET(request: NextRequest) {
  // Verify cron secret so it can't be triggered by random people
  const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Window: bookings starting between 90 and 150 minutes from now (centered on 2 hours)
    const windowStart = new Date(now.getTime() + 90 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 150 * 60 * 1000);

    // Format as "YYYY-MM-DD" for date comparison
    const dateStart = windowStart.toISOString().split("T")[0];
    const dateEnd   = windowEnd.toISOString().split("T")[0];

    // Fetch bookings in the window that haven't had a reminder sent
    const bookings = await prisma.booking.findMany({
      where: {
        reminderSentAt: null,
        status: { in: ["pending", "confirmed"] },
        customerPhone: { not: "" },
        date: { gte: dateStart, lte: dateEnd },
        user: {
          smsRemindersEnabled: true,
          plan: "pro",
        },
      },
      include: { user: true },
    });

    const results: { id: string; success: boolean; reason?: string }[] = [];

    for (const booking of bookings) {
      // Parse appointment datetime
      const apptDate = new Date(booking.date + "T00:00:00");
      const timeStr = booking.time; // e.g. "10:00 AM"
      const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!ampm) {
        results.push({ id: booking.id, success: false, reason: "Could not parse time" });
        continue;
      }
      let h = parseInt(ampm[1]);
      const m = parseInt(ampm[2]);
      if (ampm[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm[3].toUpperCase() === "AM" && h === 12) h = 0;
      apptDate.setHours(h, m, 0, 0);

      // Confirm this booking is actually within the 90–150 minute window
      const diffMs = apptDate.getTime() - now.getTime();
      if (diffMs < 90 * 60 * 1000 || diffMs > 150 * 60 * 1000) {
        // Date matched but time doesn't — skip
        results.push({ id: booking.id, success: false, reason: "Time outside window" });
        continue;
      }

      const businessName = booking.user.businessName;
      const phone = booking.user.phone;
      const message =
        `Reminder from ${businessName}: Your ${booking.serviceName} appointment is in about 2 hours at ${booking.time}.` +
        (booking.address ? ` Address: ${booking.address}.` : "") +
        (phone ? ` Questions? Call ${phone}.` : "");

      const smsResult = await sendSms(booking.customerPhone, message);

      // Mark reminder sent even if SMS failed (to avoid retry spam)
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });

      results.push({ id: booking.id, success: smsResult.success, reason: smsResult.error });
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("Reminders cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
