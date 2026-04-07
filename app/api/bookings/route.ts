import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // If userId is provided, filter by it (must still be the authenticated user's own data)
    const targetUserId = userId || session.id;

    // Only allow fetching own bookings
    if (targetUserId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("GET /api/bookings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      vehicle,
      serviceId,
      serviceName,
      servicePrice,
      date,
      time,
      depositPaid,
      depositRequired,
      notes,
      address,
      status,
    } = body;

    // userId can come from body (public booking) or from session (dashboard)
    let userId = body.userId;
    if (!userId) {
      const session = await getSessionUser();
      if (session) userId = session.id;
    }

    if (!userId || !customerName || !customerEmail || !serviceName || !date || !time) {
      return NextResponse.json(
        { error: "Missing required booking fields" },
        { status: 400 }
      );
    }

    // Verify the target user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Support both nested vehicle object and flat fields
    const vMake = vehicle?.make || body.vehicleMake || "";
    const vModel = vehicle?.model || body.vehicleModel || "";
    const vYear = vehicle?.year || body.vehicleYear || "";
    const vColor = vehicle?.color || body.vehicleColor || "";

    const booking = await prisma.booking.create({
      data: {
        userId,
        customerName,
        customerEmail,
        customerPhone: customerPhone || "",
        vehicleMake: vMake,
        vehicleModel: vModel,
        vehicleYear: vYear,
        vehicleColor: vColor,
        serviceId: serviceId || "",
        serviceName,
        servicePrice: parseFloat(servicePrice) || 0,
        date,
        time,
        depositPaid: depositPaid != null ? parseFloat(String(depositPaid)) : 0,
        depositRequired: depositRequired != null ? parseFloat(String(depositRequired)) : 0,
        notes: notes || null,
        address: address || null,
        status: status || "pending",
        staffId: body.staffId || null,
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POST /api/bookings error:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
