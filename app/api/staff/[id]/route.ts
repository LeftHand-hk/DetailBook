import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

// PUT /api/staff/[id] — update staff member
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.staff.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, email, phone, role, color, active, avatar, password } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email.toLowerCase().trim();
  if (phone !== undefined) data.phone = phone;
  if (role !== undefined) data.role = role;
  if (color !== undefined) data.color = color;
  if (active !== undefined) data.active = active;
  if (avatar !== undefined) data.avatar = avatar;
  if (password) data.password = await hashPassword(password);

  const updated = await prisma.staff.update({ where: { id: params.id }, data });
  const { password: _, ...staffData } = updated;
  return NextResponse.json(staffData);
}

// DELETE /api/staff/[id] — remove staff member
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.staff.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.staff.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
