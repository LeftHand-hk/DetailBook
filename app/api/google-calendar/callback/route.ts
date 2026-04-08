import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?tab=integrations&gcal=error`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${appUrl}/api/google-calendar/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return NextResponse.redirect(`${appUrl}/dashboard/settings?tab=integrations&gcal=error`);
    }

    // Get user's primary calendar ID
    const calendarRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const calendarData = await calendarRes.json();

    await prisma.user.update({
      where: { id: state },
      data: {
        googleAccessToken: tokenData.access_token,
        googleRefreshToken: tokenData.refresh_token || undefined,
        googleCalendarId: calendarData.id || "primary",
        googleCalendarEnabled: true,
      },
    });

    return NextResponse.redirect(`${appUrl}/dashboard/settings?tab=integrations&gcal=success`);
  } catch (err) {
    console.error("Google Calendar callback error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?tab=integrations&gcal=error`);
  }
}
