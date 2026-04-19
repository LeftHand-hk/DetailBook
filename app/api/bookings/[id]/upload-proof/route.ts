import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = await request.json();
    const { proof } = body;

    if (!proof || typeof proof !== "string") {
      return NextResponse.json(
        { error: "Missing proof image data" },
        { status: 400 }
      );
    }

    // Validate it looks like a data URL (base64 image)
    if (!proof.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format. Please upload a JPG, PNG, or similar image." },
        { status: 400 }
      );
    }

    // Limit to ~5MB base64 (roughly 3.75MB actual file)
    if (proof.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    await prisma.booking.update({
      where: { id },
      data: { paymentProof: proof },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/bookings/[id]/upload-proof error:", error);
    return NextResponse.json(
      { error: "Failed to upload proof" },
      { status: 500 }
    );
  }
}
