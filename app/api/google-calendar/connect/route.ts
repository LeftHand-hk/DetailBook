import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is on Pro plan
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || user.plan !== "pro") {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google Calendar not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/google-calendar/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state: session.id,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
