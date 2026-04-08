import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      plan: true,
      googleCalendarEnabled: true,
      googleCalendarId: true,
      googleRefreshToken: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    plan: user.plan,
    connected: !!(user.googleCalendarEnabled && user.googleRefreshToken),
    calendarId: user.googleCalendarId,
  });
}
