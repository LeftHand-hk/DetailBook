import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { paddleApiBase } from "@/lib/paddle";

// Called right before the billing page opens a BRAND-NEW Paddle checkout.
// It prevents creating a SECOND subscription for a customer who already has
// one — the root cause of the duplicate-charge bug. We look the customer up
// at Paddle (by stored id AND by email, since a user can end up with more
// than one customer record) and decide what to do instead of blindly
// creating a new subscription:
//
//   { action: "already_active", user }        → adopt + reload, no checkout
//   { action: "pay_existing", transactionId } → pay the existing invoice
//   { action: "create_new" }                  → safe to open a fresh checkout
//
// If Paddle can't be reached we FAIL OPEN (return create_new) so a transient
// error never blocks a real purchase — the webhook orphan-guard is the
// backstop in that case.

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.PADDLE_STARTER_PRICE_ID || ""]: "starter",
  [process.env.PADDLE_PRO_PRICE_ID || ""]: "pro",
};

function planFromItems(items: any[]): string | null {
  for (const item of items || []) {
    const priceId = item.price?.id || item.price_id;
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
  }
  return null;
}

function paddleApiKey(): string | null {
  const k = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
  if (!k || k === "your_paddle_api_key") return null;
  return k;
}

async function latestPayableTransaction(
  base: string,
  headers: Record<string, string>,
  subId: string,
): Promise<string | null> {
  const res = await fetch(
    `${base}/transactions?subscription_id=${encodeURIComponent(subId)}&status=past_due,billed,ready&order_by=billed_at[DESC]&per_page=10`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({} as any));
  const txs: any[] = json.data || [];
  const tx =
    txs.find((t) => t.status === "past_due") ||
    txs.find((t) => t.status === "billed") ||
    txs.find((t) => t.status === "ready");
  return tx?.id && typeof tx.id === "string" ? tx.id : null;
}

export async function POST() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const apiKey = paddleApiKey();
  // Can't verify with Paddle — preserve current behavior (let them buy).
  if (!apiKey) return NextResponse.json({ action: "create_new", reason: "no_api_key" });

  const base = paddleApiBase();
  const headers = { Authorization: `Bearer ${apiKey}` };
  const storedCustomerId = (user as any).paddleCustomerId as string | null;

  try {
    // Candidate customer ids: the one we stored + any Paddle customer that
    // shares this email (a botched earlier checkout can spawn a 2nd record).
    const customerIds = new Set<string>();
    if (storedCustomerId) customerIds.add(storedCustomerId);
    const cr = await fetch(
      `${base}/customers?email=${encodeURIComponent(user.email)}`,
      { headers, cache: "no-store" },
    );
    if (cr.ok) {
      const cj = await cr.json().catch(() => ({} as any));
      for (const c of cj?.data || []) if (c?.id) customerIds.add(c.id);
    }

    if (customerIds.size === 0) return NextResponse.json({ action: "create_new" });

    // Gather all billable subscriptions across those customers.
    const subs: any[] = [];
    for (const cid of Array.from(customerIds)) {
      const sr = await fetch(
        `${base}/subscriptions?customer_id=${cid}&status=active,trialing,past_due&per_page=50`,
        { headers, cache: "no-store" },
      );
      if (!sr.ok) continue;
      const sj = await sr.json().catch(() => ({} as any));
      for (const s of sj?.data || []) subs.push(s);
    }

    // Already paying / on a live trial → adopt it locally, no new checkout.
    const live = subs.find((s) => s.status === "active") || subs.find((s) => s.status === "trialing");
    if (live) {
      const plan = planFromItems(live.items);
      const status = live.status === "trialing" ? "trialing" : "active";
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          paddleSubscriptionId: live.id,
          subscriptionStatus: status,
          suspended: false,
          trialEndsAt: status === "trialing" ? (live.next_billed_at || "") : "",
          ...(live.customer_id ? { paddleCustomerId: live.customer_id } : {}),
          ...(plan ? { plan } : {}),
        },
        select: {
          id: true, email: true, plan: true, subscriptionStatus: true,
          trialEndsAt: true, suspended: true, paddleSubscriptionId: true, paddleCustomerId: true,
        },
      });
      return NextResponse.json({ action: "already_active", user: updated });
    }

    // Past-due subscription → pay THAT invoice instead of creating a new sub.
    const pastDue = subs.find((s) => s.status === "past_due");
    if (pastDue) {
      const txId = await latestPayableTransaction(base, headers, pastDue.id);
      if (txId) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            paddleSubscriptionId: pastDue.id,
            ...(pastDue.customer_id ? { paddleCustomerId: pastDue.customer_id } : {}),
          },
        });
        return NextResponse.json({ action: "pay_existing", transactionId: txId });
      }
    }

    return NextResponse.json({ action: "create_new" });
  } catch (e) {
    console.error("[checkout-precheck] error:", e);
    return NextResponse.json({ action: "create_new", reason: "error" });
  }
}
