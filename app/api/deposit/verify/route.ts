import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function squareApiBase(sandbox: boolean) {
  return sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
}

// Server-side verification of the deposit after the customer returns from a
// hosted-checkout redirect. We re-query the processor with the merchant's
// credentials to confirm the payment really completed before marking the
// booking deposit as paid — never trust the redirect URL alone.
export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();
    if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    if (booking.depositPaid > 0) {
      return NextResponse.json({ paid: true, amount: booking.depositPaid });
    }

    const proof = booking.paymentProof || "";
    const [provider, refId] = proof.split(":");
    if (!provider || !refId) {
      return NextResponse.json({ paid: false, reason: "No external payment reference" });
    }

    const user = await prisma.user.findUnique({ where: { id: booking.userId } });
    if (!user) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    const pm = user.paymentMethods as any;
    let paid = false;
    let paidAmount = 0;

    if (provider === "square") {
      const cfg = pm?.square;
      if (!cfg?.accessToken) return NextResponse.json({ paid: false, reason: "Square not configured" });
      // Look up payments tied to this order — Square pays the order via one or more payments.
      const r = await fetch(
        `${squareApiBase(!!cfg.sandbox)}/v2/payments?order_id=${refId}&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${cfg.accessToken}`,
            "Square-Version": "2024-11-20",
          },
          cache: "no-store",
        }
      );
      if (r.ok) {
        const j = await r.json();
        const payments: any[] = j?.payments || [];
        const completed = payments.find(
          (p) => p.status === "COMPLETED" || p.status === "APPROVED" || p.status === "CAPTURED"
        );
        if (completed) {
          const cents = completed?.total_money?.amount || 0;
          paid = true;
          paidAmount = cents > 0 ? cents / 100 : booking.depositRequired;
        }
      }
    } else {
      return NextResponse.json({ paid: false, reason: `Unsupported provider: ${provider}` });
    }

    if (paid) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { depositPaid: paidAmount },
      });
      return NextResponse.json({ paid: true, amount: paidAmount });
    }

    return NextResponse.json({ paid: false });
  } catch (err) {
    console.error("POST /api/deposit/verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
