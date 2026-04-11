import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (priority && priority !== "all") where.priority = priority;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: [
      { priority: "desc" }, // priority first
      { createdAt: "desc" },
    ],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          phone: true,
          plan: true,
        },
      },
    },
  });

  return NextResponse.json(tickets);
}
