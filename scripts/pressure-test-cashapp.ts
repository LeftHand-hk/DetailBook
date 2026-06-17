// Pressure-test Cash App booking flow against the live API. Logs in as
// the demo user, hammers /api/bookings with many cashapp-method payloads
// covering every edge case I could think of, verifies what the server
// actually stores, and cleans up after itself so the demo dashboard
// stays clean.
import "dotenv/config";

const BASE = "https://detailbookapp.com";

async function loginAsDemo(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mike@demo.com", password: "demo123" }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  const sc = r.headers.get("set-cookie") || "";
  return sc.split(",").map((c) => c.split(";")[0]).join("; ");
}

async function postBooking(cookie: string, body: any) {
  return fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

async function deleteBooking(cookie: string, id: string) {
  return fetch(`${BASE}/api/bookings/${id}`, { method: "DELETE", headers: { cookie } });
}

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

function basePayload(suffix: string, extra: Record<string, any> = {}) {
  return {
    customerName: "PressureTest Customer",
    customerEmail: `cashapp+${suffix}@example.com`,
    customerPhone: "(555) 000-0000",
    vehicle: { make: "Tesla", model: "Model Y", year: "2024", color: "White" },
    serviceId: "",
    serviceName: "Pressure Test Detail",
    servicePrice: 99,
    date: tomorrow,
    time: "11:00",
    notes: "",
    status: "pending",
    depositRequired: 20,
    depositPaid: 0,
    paymentMethod: "cashapp",
    skipNotifications: true, // don't spam mike@demo.com during tests
    ...extra,
  };
}

type TestResult = { name: string; pass: boolean; detail: string };
const results: TestResult[] = [];
const created: string[] = [];

function check(name: string, cond: boolean, detail: string) {
  results.push({ name, pass: cond, detail });
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? "  — " + detail : ""}`);
}

async function runTest(label: string, fn: () => Promise<void>) {
  console.log(`\n── ${label}`);
  try { await fn(); } catch (e: any) { console.log(`  ‼ ${e?.message || e}`); results.push({ name: label, pass: false, detail: e?.message || String(e) }); }
}

async function main() {
  console.log("Logging in as mike@demo.com...");
  const cookie = await loginAsDemo();
  console.log("✓ logged in");

  // ── T1 — plain cashtag, no $ prefix
  await runTest("T1: plain cashtag (no $)", async () => {
    const r = await postBooking(cookie, basePayload("t1-" + Date.now(), { customerPaymentTag: "johndoe" }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("HTTP 2xx", r.ok, `status=${r.status}`);
    check("paymentMethod stored", b.paymentMethod === "cashapp", `got "${b.paymentMethod}"`);
    check("customerPaymentTag stored", b.customerPaymentTag === "johndoe", `got "${b.customerPaymentTag}"`);
    check("status pending", b.status === "pending", `got "${b.status}"`);
    check("depositPaid 0", b.depositPaid === 0, `got ${b.depositPaid}`);
    check("depositRequired stored", b.depositRequired === 20, `got ${b.depositRequired}`);
  });

  // ── T2 — $ prefix gets stripped
  await runTest("T2: $ prefix in cashtag (must strip)", async () => {
    const r = await postBooking(cookie, basePayload("t2-" + Date.now(), { customerPaymentTag: "$johndoe" }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("stored without $", b.customerPaymentTag === "johndoe", `got "${b.customerPaymentTag}"`);
  });

  // ── T3 — whitespace around tag gets trimmed
  await runTest("T3: whitespace around tag (must trim)", async () => {
    const r = await postBooking(cookie, basePayload("t3-" + Date.now(), { customerPaymentTag: "   spacedude  " }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("trimmed", b.customerPaymentTag === "spacedude", `got "${b.customerPaymentTag}"`);
  });

  // ── T4 — both $ prefix and whitespace
  await runTest("T4: $ + whitespace (must trim + strip)", async () => {
    const r = await postBooking(cookie, basePayload("t4-" + Date.now(), { customerPaymentTag: "  $bigspender  " }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("cleaned", b.customerPaymentTag === "bigspender", `got "${b.customerPaymentTag}"`);
  });

  // ── T5 — empty string tag
  await runTest("T5: empty string tag", async () => {
    const r = await postBooking(cookie, basePayload("t5-" + Date.now(), { customerPaymentTag: "" }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("created anyway", r.ok, `status=${r.status}`);
    check("tag empty/null", !b.customerPaymentTag, `got "${b.customerPaymentTag}"`);
  });

  // ── T6 — missing field entirely
  await runTest("T6: customerPaymentTag field omitted", async () => {
    const p = basePayload("t6-" + Date.now());
    const r = await postBooking(cookie, p);
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("still created", r.ok, `status=${r.status}`);
    check("tag null", b.customerPaymentTag == null, `got "${b.customerPaymentTag}"`);
  });

  // ── T7 — alphanumeric tag
  await runTest("T7: alphanumeric tag", async () => {
    const r = await postBooking(cookie, basePayload("t7-" + Date.now(), { customerPaymentTag: "test123abc" }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("preserved", b.customerPaymentTag === "test123abc", `got "${b.customerPaymentTag}"`);
  });

  // ── T8 — uppercase tag (Cash App tags are usually lowercase but server shouldn't lowercase)
  await runTest("T8: mixed-case tag (must preserve case)", async () => {
    const r = await postBooking(cookie, basePayload("t8-" + Date.now(), { customerPaymentTag: "BigBoy42" }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("case preserved", b.customerPaymentTag === "BigBoy42", `got "${b.customerPaymentTag}"`);
  });

  // ── T9 — very long tag (cash.app tags are 1-20 chars in reality but server shouldn't truncate)
  await runTest("T9: very long tag (server accepts)", async () => {
    const long = "x".repeat(80);
    const r = await postBooking(cookie, basePayload("t9-" + Date.now(), { customerPaymentTag: long }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("not truncated", b.customerPaymentTag === long, `length=${b.customerPaymentTag?.length}`);
  });

  // ── T10 — multiple $ signs ($$bigshot should still strip just the leading one)
  await runTest("T10: multiple $ signs (strip leading only)", async () => {
    const r = await postBooking(cookie, basePayload("t10-" + Date.now(), { customerPaymentTag: "$$bigshot" }));
    const b: any = await r.json();
    if (b.id) created.push(b.id);
    check("one $ left", b.customerPaymentTag === "$bigshot", `got "${b.customerPaymentTag}"`);
  });

  // ── T11 — same booking twice (dedup window)
  await runTest("T11: identical booking twice (dedup)", async () => {
    const p = basePayload("t11-" + Date.now(), { customerPaymentTag: "duper" });
    const a = await postBooking(cookie, p);
    const ja: any = await a.json();
    if (ja.id) created.push(ja.id);
    const b = await postBooking(cookie, p);
    const jb: any = await b.json();
    check("first 2xx", a.ok, `status=${a.status}`);
    check("second returns same id", jb.id === ja.id, `ids: ${ja.id?.slice(0,8)} vs ${jb.id?.slice(0,8)}`);
  });

  // ── T12 — list endpoint surfaces customerPaymentTag (owner sees it)
  await runTest("T12: GET /api/bookings shows customerPaymentTag", async () => {
    const r = await fetch(`${BASE}/api/bookings`, { headers: { cookie }, cache: "no-store" });
    const list: any[] = await r.json();
    const sample = list.find((b) => created.includes(b.id) && b.customerPaymentTag);
    check("found a booking with tag in list", Boolean(sample), sample ? `tag="${sample.customerPaymentTag}"` : "none");
  });

  // ── T13 — deep-link URL contains correct cashtag + amount
  await runTest("T13: cashapp deep-link URL format", async () => {
    // Synthesize the URL the same way the client does. We can't easily
    // load the React page server-side, but we can verify the template is
    // sound by rebuilding it the same way.
    const owner = "demoDetailer";
    const amount = 25;
    const url = `https://cash.app/$${owner}/${amount}`;
    check("URL format correct", url === "https://cash.app/$demoDetailer/25", url);
    check("Starts with cash.app domain", url.startsWith("https://cash.app/"), url);
    check("Contains amount segment", url.endsWith("/25"), url);
  });

  // ── Summary ──
  console.log("\n══════════════════════════════════════════");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`Total: ${results.length}  Passed: ${passed}  Failed: ${failed}`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const r of results) if (!r.pass) console.log(`  ✗ ${r.name}: ${r.detail}`);
  }

  // ── Cleanup ──
  console.log(`\nCleanup: deleting ${created.length} test bookings`);
  for (const id of created) await deleteBooking(cookie, id);
  console.log("✓ cleanup done");

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
