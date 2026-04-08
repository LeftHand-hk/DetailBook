import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.id },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleCalendarId: null,
      googleCalendarEnabled: false,
    },
  });

  return NextResponse.json({ success: true });
}
