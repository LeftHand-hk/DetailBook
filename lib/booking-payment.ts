import prisma from "@/lib/prisma";
import { getBusinessStripe } from "@/lib/stripe";

function squareApiBase(sandbox: boolean) {
  return sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
}

export async function verifyBookingPayment(
  userId: string,
  proof: string,
  requiredAmount: number,
): Promise<{ paid: boolean; amount: number; reason?: string }> {
  const [provider, refId] = proof.split(":");
  if (!provider || !refId) return { paid: false, amount: 0, reason: "Missing payment reference" };

  const alreadyUsed = await prisma.booking.findFirst({
    where: { userId, paymentProof: proof },
    select: { id: true },
  });
  if (alreadyUsed) return { paid: false, amount: 0, reason: "Payment reference was already used" };

  if (provider === "stripe") {
    const stripe = await getBusinessStripe(userId);
    if (!stripe) return { paid: false, amount: 0, reason: "Stripe is not configured" };
    try {
      const intent = await stripe.paymentIntents.retrieve(refId);
      const amount = intent.amount_received / 100;
      const belongsToBusiness = intent.metadata?.userId === userId && intent.metadata?.type === "deposit";
      if (intent.status === "succeeded" && belongsToBusiness && amount + 0.001 >= requiredAmount) {
        return { paid: true, amount };
      }
    } catch (error) {
      console.error("[booking payment] Stripe verification failed:", error);
    }
    return { paid: false, amount: 0, reason: "Stripe payment could not be verified" };
  }

  if (provider === "square") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { paymentMethods: true } });
    const cfg = (user?.paymentMethods as any)?.square;
    if (!cfg?.enabled || !cfg?.accessToken) return { paid: false, amount: 0, reason: "Square is not configured" };
    try {
      const response = await fetch(`${squareApiBase(!!cfg.sandbox)}/v2/payments/${encodeURIComponent(refId)}`, {
        headers: {
          Authorization: `Bearer ${cfg.accessToken}`,
          "Square-Version": "2024-11-20",
        },
        cache: "no-store",
      });
      if (response.ok) {
        const payment = (await response.json())?.payment;
        const amount = Number(payment?.total_money?.amount || 0) / 100;
        if (["COMPLETED", "APPROVED", "CAPTURED"].includes(payment?.status) && amount + 0.001 >= requiredAmount) {
          return { paid: true, amount };
        }
      }
    } catch (error) {
      console.error("[booking payment] Square verification failed:", error);
    }
    return { paid: false, amount: 0, reason: "Square payment could not be verified" };
  }

  return { paid: false, amount: 0, reason: "Unsupported payment provider" };
}
