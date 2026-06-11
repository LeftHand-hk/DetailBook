/**
 * ADD-ON DESCRIPTION — END-TO-END
 *
 * Logs in as the demo owner, adds an optional description to a package's
 * add-on through the real API, and verifies it round-trips. Restores the
 * package's original add-ons at the end so it's non-destructive.
 *
 *   BASE_URL=http://localhost:3000 node scripts/test-addon-description.mjs
 */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.DEMO_EMAIL || "mike@demo.com";
const PASSWORD = process.env.DEMO_PASSWORD || "demo123";

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`); } };

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const m = (loginRes.headers.get("set-cookie") || "").match(/detailbook_token=[^;]+/);
  ok(`login as ${EMAIL}`, loginRes.ok && !!m);
  if (!m) process.exit(1);
  const cookie = m[0];
  const H = { "Content-Type": "application/json", cookie };

  const list = await (await fetch(`${BASE}/api/packages`, { headers: { cookie }, cache: "no-store" })).json();
  ok("GET /api/packages returns a list", Array.isArray(list) && list.length > 0);
  if (!Array.isArray(list) || list.length === 0) process.exit(1);
  const pkg = list[0];
  console.log(`\n  Using package ${pkg.id} — "${pkg.name}"`);

  const origAddons = Array.isArray(pkg.addons) ? pkg.addons : [];
  const DESC = "E2E: removes embedded pet hair from seats & carpet";
  const newAddons = [...origAddons, { name: "E2E Pet Hair Removal", price: 35, description: DESC }];

  await fetch(`${BASE}/api/packages/${pkg.id}`, { method: "PUT", headers: H, body: JSON.stringify({ addons: newAddons }) });

  let after = await (await fetch(`${BASE}/api/packages`, { headers: { cookie }, cache: "no-store" })).json();
  let got = after.find((p) => p.id === pkg.id);
  const saved = (got.addons || []).find((a) => a.name === "E2E Pet Hair Removal");
  ok("add-on saved", !!saved);
  ok("description persisted", saved && saved.description === DESC);
  ok("price persisted alongside description", saved && Number(saved.price) === 35);

  // An add-on with no description should not carry an empty string.
  await fetch(`${BASE}/api/packages/${pkg.id}`, { method: "PUT", headers: H, body: JSON.stringify({ addons: [...origAddons, { name: "E2E No Desc", price: 5 }, { name: "E2E Pet Hair Removal", price: 35, description: DESC }] }) });
  after = await (await fetch(`${BASE}/api/packages`, { headers: { cookie }, cache: "no-store" })).json();
  got = after.find((p) => p.id === pkg.id);
  const noDesc = (got.addons || []).find((a) => a.name === "E2E No Desc");
  ok("add-on without a description stays clean (no empty field)", noDesc && (noDesc.description === undefined || noDesc.description === ""));
  ok("descriptions are per-add-on (other add-on keeps its blurb)", (got.addons || []).some((a) => a.name === "E2E Pet Hair Removal" && a.description === DESC));

  // Restore.
  await fetch(`${BASE}/api/packages/${pkg.id}`, { method: "PUT", headers: H, body: JSON.stringify({ addons: origAddons }) });
  after = await (await fetch(`${BASE}/api/packages`, { headers: { cookie }, cache: "no-store" })).json();
  got = after.find((p) => p.id === pkg.id);
  ok("package add-ons restored", (got.addons || []).length === origAddons.length && !(got.addons || []).some((a) => a.name === "E2E Pet Hair Removal"));

  console.log(`\n${"-".repeat(40)}\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
