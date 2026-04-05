import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";

export async function GET() {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: session.id },
    include: { user: { select: { businessName: true, slug: true, logo: true, accentColor: true } } },
  });

  if (!staff || !staff.active) {
    return NextResponse.json({ error: "Account not found or deactivated" }, { status: 401 });
  }

  const { password: _, ...staffData } = staff;
  return NextResponse.json({ staff: staffData });
}
