// Duplicate-subscription scanner.
//
// Finds any Paddle customer that has MORE THAN ONE billable subscription
// (active / trialing / past_due) — i.e. anyone who could be charged twice.
// Read-only: it never cancels or refunds anything, it only reports.
//
// Usage:
//   node scripts/scan-duplicate-subs.mjs
//     -> uses PADDLE_API_KEY + NEXT_PUBLIC_PADDLE_ENV from .env / .env.local
//
//   To scan PRODUCTION from your machine, run with the production key:
//     PADDLE_API_KEY=<prod_key> NEXT_PUBLIC_PADDLE_ENV=production node scripts/scan-duplicate-subs.mjs
//
// (The repo .env points at the Paddle SANDBOX; your live customers are in
//  production, whose key lives in Netlify's environment.)

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

const API_KEY = process.env.PADDLE_API_KEY?.replace(/^["']|["']$/g, "")?.trim();
const ENV = (process.env.NEXT_PUBLIC_PADDLE_ENV || "production").replace(/^["']|["']$/g, "").trim();
const BASE = ENV === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
const BILLABLE = new Set(["active", "trialing", "past_due"]);

if (!API_KEY || API_KEY === "your_paddle_api_key") {
  console.error("PADDLE_API_KEY is not set. Add it to .env or pass it inline.");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${API_KEY}` };

async function getAllPages(path) {
  let url = `${BASE}${path}`;
  const out = [];
  while (url) {
    const r = await fetch(url, { headers });
    if (!r.ok) {
      console.error("Paddle API error", r.status, await r.text().catch(() => ""));
      break;
    }
    const j = await r.json();
    out.push(...(j.data || []));
    url = j.meta?.pagination?.has_more ? j.meta.pagination.next : null;
  }
  return out;
}

async function customerEmail(id) {
  try {
    const r = await fetch(`${BASE}/customers/${id}`, { headers });
    if (r.ok) return (await r.json()).data?.email || id;
  } catch { /* ignore */ }
  return id;
}

console.log(`Scanning Paddle (${ENV}) for duplicate subscriptions...\n`);

const subs = await getAllPages("/subscriptions?per_page=100");

const byCustomer = new Map();
for (const s of subs) {
  const k = s.customer_id || "unknown";
  if (!byCustomer.has(k)) byCustomer.set(k, []);
  byCustomer.get(k).push(s);
}

let flagged = 0;
let totalActive = 0;
for (const s of subs) if (BILLABLE.has(s.status)) totalActive++;

for (const [cid, list] of byCustomer) {
  const billable = list.filter((s) => BILLABLE.has(s.status));
  if (billable.length > 1) {
    flagged++;
    const email = await customerEmail(cid);
    console.log(`⚠️  ${email}: ${billable.length} billable subscriptions`);
    for (const s of billable) {
      console.log(`     - ${s.id}  ${s.status}  next_billed_at=${s.next_billed_at || "-"}`);
    }
    console.log("");
  }
}

console.log("----------------------------------------------------");
console.log(`Subscriptions scanned : ${subs.length}`);
console.log(`Customers             : ${byCustomer.size}`);
console.log(`Billable subs total   : ${totalActive}`);
console.log(`Customers w/ DUPLICATES: ${flagged}`);
if (flagged === 0) console.log("\n✅ No customer has more than one billable subscription.");
else console.log("\n❌ Review the customers above in Paddle: keep one sub, cancel the rest, refund extra charges.");
