import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { paddleApiBase } from "@/lib/paddle";

// Admin-only, READ-ONLY scan of the whole Paddle account for customers with
// more than one billable subscription (active / trialing / past_due) — i.e.
// anyone who could be charged twice. Never cancels or refunds; only reports.
//
//   GET /api/admin/scan-duplicate-subs
//
// Runs in production where the real PADDLE_API_KEY lives, so no secret has to
// leave Netlify. Use the result to clean up duplicates in the Paddle
// dashboard (keep one sub, cancel the rest, refund extra charges).

const BILLABLE = new Set(["active", "trialing", "past_due"]);

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
  if (!apiKey || apiKey === "your_paddle_api_key") {
    return NextResponse.json({ error: "PADDLE_API_KEY not configured in this environment" }, { status: 503 });
  }

  const base = paddleApiBase();
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Page through all subscriptions (bounded so a serverless invocation can't
  // run away — 30 pages x 100 = 3000 subscriptions, well beyond current size).
  const subs: any[] = [];
  let url: string | null = `${base}/subscriptions?per_page=100`;
  let pages = 0;
  try {
    while (url && pages < 30) {
      const r: Response = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) {
        return NextResponse.json(
          { error: `Paddle returned ${r.status}`, body: await r.json().catch(() => ({})) },
          { status: 502 },
        );
      }
      const j: any = await r.json();
      subs.push(...(j.data || []));
      url = j.meta?.pagination?.has_more ? j.meta.pagination.next : null;
      pages++;
    }
  } catch (e) {
    return NextResponse.json({ error: "Failed to reach Paddle", detail: String(e) }, { status: 502 });
  }

  // Group by customer; flag anyone with >1 billable subscription.
  const byCustomer = new Map<string, any[]>();
  for (const s of subs) {
    const k = s.customer_id || "unknown";
    if (!byCustomer.has(k)) byCustomer.set(k, []);
    byCustomer.get(k)!.push(s);
  }

  const duplicates: any[] = [];
  for (const [cid, list] of Array.from(byCustomer.entries())) {
    const billable = list.filter((s) => BILLABLE.has(s.status));
    if (billable.length > 1) {
      let email = cid;
      try {
        const cr = await fetch(`${base}/customers/${cid}`, { headers, cache: "no-store" });
        if (cr.ok) email = (await cr.json())?.data?.email || cid;
      } catch { /* ignore */ }
      duplicates.push({
        customerId: cid,
        email,
        count: billable.length,
        subscriptions: billable.map((s) => ({
          id: s.id,
          status: s.status,
          next_billed_at: s.next_billed_at,
          priceIds: (s.items || []).map((i: any) => i.price?.id || i.price_id),
        })),
      });
    }
  }

  const billableTotal = subs.filter((s) => BILLABLE.has(s.status)).length;

  return NextResponse.json({
    env: process.env.NEXT_PUBLIC_PADDLE_ENV || "production",
    scanned: subs.length,
    customers: byCustomer.size,
    billableSubscriptions: billableTotal,
    duplicateCustomers: duplicates.length,
    duplicates,
    note: duplicates.length
      ? "Keep one subscription per customer, cancel the rest in Paddle, and refund the extra charges."
      : "No customer has more than one billable subscription.",
  });
}
