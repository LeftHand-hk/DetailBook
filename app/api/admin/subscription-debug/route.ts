import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { paddleApiBase } from "@/lib/paddle";

// Admin diagnostic for "the trial ended but Paddle didn't charge".
//
//   GET /api/admin/subscription-debug?email=customer@example.com
//   GET /api/admin/subscription-debug?userId=<id>
//
// Pulls the customer's real subscription from Paddle and checks the three
// things that actually stop an auto-charge:
//   1. No payment method on file  → trial wasn't card-required; nothing to charge.
//   2. collection_mode != automatic → Paddle invoices instead of charging.
//   3. scheduled_change = cancel   → the sub won't renew, so it won't charge.
// Read-only. Admin session required.
export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
  if (!apiKey || apiKey === "your_paddle_api_key") {
    return NextResponse.json({ error: "PADDLE_API_KEY not configured in this environment" }, { status: 503 });
  }

  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  const userId = req.nextUrl.searchParams.get("userId");
  if (!email && !userId) {
    return NextResponse.json({ error: "Provide ?email= or ?userId=" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: email! },
    select: {
      id: true, email: true, plan: true, subscriptionStatus: true,
      trialEndsAt: true, paddleCustomerId: true, paddleSubscriptionId: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const headers = { Authorization: `Bearer ${apiKey}` };
  const base = paddleApiBase();
  const out: any = {
    env: process.env.NEXT_PUBLIC_PADDLE_ENV || "production",
    apiBase: base,
    local: user,
  };

  // Subscription
  let sub: any = null;
  if (user.paddleSubscriptionId) {
    const r = await fetch(`${base}/subscriptions/${user.paddleSubscriptionId}`, { headers, cache: "no-store" });
    const j = await r.json().catch(() => ({} as any));
    sub = j?.data || null;
    out.subscription = sub
      ? {
          id: sub.id,
          status: sub.status,
          collection_mode: sub.collection_mode,
          next_billed_at: sub.next_billed_at,
          scheduled_change: sub.scheduled_change || null,
          trial_dates: (sub.items || []).map((i: any) => i.trial_dates).filter(Boolean),
          items: (sub.items || []).map((i: any) => ({ price_id: i.price?.id, status: i.status })),
        }
      : { error: `Paddle GET /subscriptions returned ${r.status}`, body: j };
  } else {
    out.subscription = "NO paddleSubscriptionId stored on this user";
  }

  // Payment methods on file
  let pmCount = -1;
  if (user.paddleCustomerId) {
    const r = await fetch(`${base}/customers/${user.paddleCustomerId}/payment-methods`, { headers, cache: "no-store" });
    const j = await r.json().catch(() => ({} as any));
    if (Array.isArray(j?.data)) {
      pmCount = j.data.length;
      out.paymentMethods = j.data.map((p: any) => ({
        type: p.type,
        card: p.card ? { brand: p.card.type, last4: p.card.last4, expiry: `${p.card.expiry_month}/${p.card.expiry_year}` } : undefined,
      }));
    } else {
      out.paymentMethods = { error: `Paddle GET /payment-methods returned ${r.status}`, body: j };
    }
  } else {
    out.paymentMethods = "NO paddleCustomerId stored on this user";
  }

  // ALL subscriptions for this customer — the single stored
  // paddleSubscriptionId can't reveal an orphan/duplicate that keeps
  // billing. List every sub across every customer record sharing this email.
  out.allSubscriptions = [];
  const customerIds = new Set<string>();
  if (user.paddleCustomerId) customerIds.add(user.paddleCustomerId);
  try {
    const cr = await fetch(`${base}/customers?email=${encodeURIComponent(user.email)}`, { headers, cache: "no-store" });
    const cj = await cr.json().catch(() => ({} as any));
    for (const c of cj?.data || []) if (c?.id) customerIds.add(c.id);
  } catch { /* ignore */ }
  for (const cid of Array.from(customerIds)) {
    try {
      const sr = await fetch(`${base}/subscriptions?customer_id=${cid}&per_page=50`, { headers, cache: "no-store" });
      const sj = await sr.json().catch(() => ({} as any));
      for (const s of sj?.data || []) {
        out.allSubscriptions.push({
          id: s.id,
          customerId: cid,
          status: s.status,
          next_billed_at: s.next_billed_at,
          scheduled_change: s.scheduled_change?.action || null,
          priceIds: (s.items || []).map((i: any) => i.price?.id || i.price_id),
          isTracked: s.id === user.paddleSubscriptionId,
        });
      }
    } catch { /* ignore */ }
  }
  const billable = (out.allSubscriptions as any[]).filter((s) =>
    ["active", "trialing", "past_due"].includes(s.status)
  );
  if (billable.length > 1) {
    out.DUPLICATE_WARNING =
      `This customer has ${billable.length} active/trialing/past_due subscriptions — likely duplicate billing. ` +
      `Keep one (ideally the "isTracked" one), cancel the rest in Paddle, and refund the extra charges.`;
  }

  // Diagnosis
  const problems: string[] = [];
  if (sub) {
    if (sub.collection_mode !== "automatic") {
      problems.push(`collection_mode is "${sub.collection_mode}" — Paddle will NOT auto-charge (it expects manual/invoice payment). It must be "automatic".`);
    }
    if (sub.scheduled_change?.action === "cancel") {
      problems.push(`Subscription is SCHEDULED TO CANCEL at ${sub.scheduled_change.effective_at} — it will not renew or charge.`);
    }
    if (sub.status === "canceled" || sub.status === "paused") {
      problems.push(`Subscription status is "${sub.status}" — it won't charge.`);
    }
    if (pmCount === 0) {
      problems.push("NO payment method on file — the trial was NOT card-required, so Paddle has nothing to charge at trial end. Fix: make the price's trial require a payment method.");
    }
  } else if (typeof out.subscription === "string") {
    problems.push("This account has no linked Paddle subscription — they never completed the card step, so there's nothing to charge.");
  }

  out.diagnosis = problems.length
    ? problems
    : ["No blocker found — subscription looks chargeable. If next_billed_at is in the future, the charge simply hasn't come due yet."];

  return NextResponse.json(out);
}
