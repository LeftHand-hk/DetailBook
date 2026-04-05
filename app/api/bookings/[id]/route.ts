import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Handle nested vehicle object from frontend
    const vehicle = body.vehicle;
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.depositPaid !== undefined) data.depositPaid = parseFloat(body.depositPaid);
    if (body.customerName !== undefined) data.customerName = body.customerName;
    if (body.customerEmail !== undefined) data.customerEmail = body.customerEmail;
    if (body.customerPhone !== undefined) data.customerPhone = body.customerPhone;
    if (body.date !== undefined) data.date = body.date;
    if (body.time !== undefined) data.time = body.time;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.address !== undefined) data.address = body.address;
    // Support both flat and nested vehicle
    if (vehicle) {
      if (vehicle.make !== undefined) data.vehicleMake = vehicle.make;
      if (vehicle.model !== undefined) data.vehicleModel = vehicle.model;
      if (vehicle.year !== undefined) data.vehicleYear = vehicle.year;
      if (vehicle.color !== undefined) data.vehicleColor = vehicle.color;
    }
    if (body.vehicleMake !== undefined) data.vehicleMake = body.vehicleMake;
    if (body.vehicleModel !== undefined) data.vehicleModel = body.vehicleModel;
    if (body.vehicleYear !== undefined) data.vehicleYear = body.vehicleYear;
    if (body.vehicleColor !== undefined) data.vehicleColor = body.vehicleColor;
    if (body.staffId !== undefined) data.staffId = body.staffId || null;

    const updated = await prisma.booking.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/bookings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.booking.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/bookings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete booking" },
      { status: 500 }
    );
  }
}
