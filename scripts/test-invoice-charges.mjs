/**
 * FINAL-INVOICE CHARGES — END-TO-END (issue #3)
 *
 * Logs in as the demo owner, takes an existing booking, and exercises the
 * owner "add a charge" flow through the real API:
 *   PUT /api/bookings/[id]  { selectedAddons, addonsTotal }
 *   GET /api/bookings/[id]  — verify it persisted
 *
 * Asserts addonsTotal stays in sync, the owner charge round-trips, and a
 * removed charge disappears. Restores the booking's original state at the end
 * so it's non-destructive.
 *
 *   BASE_URL=http://localhost:3000 node scripts/test-invoice-charges.mjs
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.DEMO_EMAIL || "mike@demo.com";
const PASSWORD = process.env.DEMO_PASSWORD || "demo123";

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`); } };

async function main() {
  // 1. Login → capture session cookie.
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const m = setCookie.match(/detailbook_token=[^;]+/);
  ok(`login as ${EMAIL}`, loginRes.ok && !!m);
  if (!m) { console.log("  (cannot continue without session)"); process.exit(1); }
  const cookie = m[0];
  const H = { "Content-Type": "application/json", cookie };

  // 2. Grab a booking to operate on.
  const list = await (await fetch(`${BASE}/api/bookings`, { headers: { cookie }, cache: "no-store" })).json();
  ok("GET /api/bookings returns a list", Array.isArray(list) && list.length > 0);
  if (!Array.isArray(list) || list.length === 0) { console.log("  (no bookings to test against)"); process.exit(1); }
  const b = list[0];
  const id = b.id;
  console.log(`\n  Using booking ${id} — service $${b.servicePrice}`);

  // Snapshot original state so we can restore it afterwards.
  const origAddons = Array.isArray(b.selectedAddons) ? b.selectedAddons : [];
  const origTotal = Number(b.addonsTotal) || 0;
  const customerAddons = origAddons.filter((a) => !a.owner);

  // 3. Add an owner charge.
  const charge = { id: `owner_e2e_${Date.now()}`, name: "E2E Heavy pet hair", price: 25, owner: true };
  const withCharge = [...origAddons, charge];
  const withChargeTotal = withCharge.reduce((s, a) => s + (Number(a.price) || 0), 0);
  await fetch(`${BASE}/api/bookings/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ selectedAddons: withCharge, addonsTotal: withChargeTotal }) });

  let got = await (await fetch(`${BASE}/api/bookings/${id}`, { headers: { cookie }, cache: "no-store" })).json();
  const gotAddons = Array.isArray(got.selectedAddons) ? got.selectedAddons : [];
  ok("owner charge persisted in selectedAddons", gotAddons.some((a) => a.id === charge.id && a.owner === true && a.name === charge.name && Number(a.price) === 25));
  ok("addonsTotal updated on the server", Number(got.addonsTotal) === withChargeTotal);
  ok("customer add-ons untouched", gotAddons.filter((a) => !a.owner).length === customerAddons.length);
  ok("final total = service + addons", (Number(got.servicePrice) + Number(got.addonsTotal)) === (Number(b.servicePrice) + withChargeTotal));

  // 4. Remove the owner charge.
  const removed = gotAddons.filter((a) => a.id !== charge.id);
  const removedTotal = removed.reduce((s, a) => s + (Number(a.price) || 0), 0);
  await fetch(`${BASE}/api/bookings/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ selectedAddons: removed, addonsTotal: removedTotal }) });
  got = await (await fetch(`${BASE}/api/bookings/${id}`, { headers: { cookie }, cache: "no-store" })).json();
  const afterAddons = Array.isArray(got.selectedAddons) ? got.selectedAddons : [];
  ok("removed charge is gone", !afterAddons.some((a) => a.id === charge.id));

  // 5. Reject a negative addonsTotal (server clamps to 0 only when it parses;
  //    we just confirm a malformed value doesn't blow up the row).
  const guard = await fetch(`${BASE}/api/bookings/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ addonsTotal: "-50" }) });
  got = await guard.json();
  ok("negative addonsTotal coerced to >= 0", Number(got.addonsTotal) >= 0);

  // 6. Restore original snapshot.
  await fetch(`${BASE}/api/bookings/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ selectedAddons: origAddons, addonsTotal: origTotal }) });
  got = await (await fetch(`${BASE}/api/bookings/${id}`, { headers: { cookie }, cache: "no-store" })).json();
  ok("booking restored to original state", Number(got.addonsTotal) === origTotal);

  console.log(`\n${"-".repeat(40)}\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
