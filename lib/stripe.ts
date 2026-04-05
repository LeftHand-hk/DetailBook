import Stripe from "stripe";
import prisma from "@/lib/prisma";

// Get platform Stripe instance (for subscriptions)
export async function getPlatformStripe(): Promise<Stripe | null> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings?.stripeEnabled || !settings?.stripeSecretKey) return null;
  return new Stripe(settings.stripeSecretKey);
}

// Get business owner's Stripe instance (for deposits)
export async function getBusinessStripe(
  userId: string
): Promise<Stripe | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const pm = user?.paymentMethods as any;
  if (!pm?.stripe?.enabled || !pm?.stripe?.secretKey) return null;
  return new Stripe(pm.stripe.secretKey);
}
