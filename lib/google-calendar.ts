import prisma from "@/lib/prisma";

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) return null;

    await prisma.user.update({
      where: { id: userId },
      data: { googleAccessToken: data.access_token },
    });

    return data.access_token;
  } catch {
    return null;
  }
}

function parseTime(time: string): { hours: number; minutes: number } {
  const ampm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    if (ampm[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm[3].toUpperCase() === "AM" && h === 12) h = 0;
    return { hours: h, minutes: m };
  }
  const h24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return { hours: parseInt(h24[1]), minutes: parseInt(h24[2]) };
  return { hours: 9, minutes: 0 };
}

export async function syncBookingToGoogleCalendar(booking: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  serviceName: string;
  servicePrice: number;
  date: string;
  time: string;
  notes?: string | null;
  address?: string | null;
  depositPaid: number;
  userId: string;
  staffId?: string | null;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: booking.userId },
      select: {
        googleCalendarEnabled: true,
        googleAccessToken: true,
        googleRefreshToken: true,
        googleCalendarId: true,
      },
    });

    if (!user?.googleCalendarEnabled || !user.googleRefreshToken) return;

    let accessToken = user.googleAccessToken;
    if (!accessToken) {
      accessToken = await refreshAccessToken(booking.userId, user.googleRefreshToken);
      if (!accessToken) return;
    }

    let staffName = "";
    if (booking.staffId) {
      const staff = await prisma.staff.findUnique({ where: { id: booking.staffId }, select: { name: true } });
      staffName = staff?.name || "";
    }

    const { hours, minutes } = parseTime(booking.time);
    const startDate = new Date(`${booking.date}T00:00:00`);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const event = {
      summary: `${booking.serviceName} - ${booking.customerName}`,
      description: [
        `Customer: ${booking.customerName}`,
        `Phone: ${booking.customerPhone}`,
        booking.customerEmail ? `Email: ${booking.customerEmail}` : "",
        `Vehicle: ${booking.vehicleYear} ${booking.vehicleMake} ${booking.vehicleModel} (${booking.vehicleColor})`,
        `Price: $${booking.servicePrice}`,
        booking.depositPaid > 0 ? `Deposit Paid: $${booking.depositPaid}` : "",
        staffName ? `Staff: ${staffName}` : "",
        booking.notes ? `Notes: ${booking.notes}` : "",
      ].filter(Boolean).join("\n"),
      location: booking.address || undefined,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    const calendarId = user.googleCalendarId || "primary";

    let res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (res.status === 401 && user.googleRefreshToken) {
      accessToken = await refreshAccessToken(booking.userId, user.googleRefreshToken);
      if (accessToken) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );
      }
    }
  } catch (err) {
    console.error("Google Calendar sync error:", err);
  }
}
