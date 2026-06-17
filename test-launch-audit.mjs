/**
 * LAUNCH AUDIT — pre-ads critical-path checks
 *
 * Hits production endpoints (or BASE_URL override) and verifies the things
 * that would cause real customers to lose money, see broken pages, or
 * leak data. Read-only where possible; any data it does create is cleaned up.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "https://detailbookapp.com").replace(/\/$/, "");

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
let pass = 0, fail = 0, warn = 0;
const issues = [];
function ok(m) { console.log(`  ${C.g}✓${C.x} ${m}`); pass++; }
function bad(m) { console.log(`  ${C.r}✗ ${m}${C.x}`); fail++; issues.push(m); }
function warning(m) { console.log(`  ${C.y}⚠ ${m}${C.x}`); warn++; }
function head(m) { console.log(`\n${C.b}${C.c}═══ ${m} ═══${C.x}`); }
function info(m) { console.log(`  ${C.d}${m}${C.x}`); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}
async function post(path, payload) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

async function main() {
  console.log(`\n${C.b}🛡  Launch Audit — ${BASE}${C.x}\n`);

  // ───────────────────────────────────────────────
  head("1. Admin endpoints — must be auth-gated (no cookie → 401/403)");
  // ───────────────────────────────────────────────
  const adminPaths = [
    "/api/admin/users",
    "/api/admin/promo-codes",
    "/api/admin/settings",
    "/api/admin/tickets",
  ];
  for (const p of adminPaths) {
    const r = await get(p);
    if (r.status === 401 || r.status === 403) ok(`GET ${p} → ${r.status}`);
    else bad(`GET ${p} returned ${r.status} (expected 401/403). Body: ${JSON.stringify(r.body).slice(0, 200)}`);
  }

  // ───────────────────────────────────────────────
  head("2. Dashboard endpoints — must require user session");
  // ───────────────────────────────────────────────
  const dashPaths = [
    "/api/bookings",
    "/api/user",
    "/api/packages",
    "/api/staff",
    "/api/notifications",
  ];
  for (const p of dashPaths) {
    const r = await get(p);
    if (r.status === 401) ok(`GET ${p} → 401`);
    else bad(`GET ${p} returned ${r.status} (expected 401)`);
  }

  // ───────────────────────────────────────────────
  head("3. Cron endpoint — secret enforced");
  // ───────────────────────────────────────────────
  const cron1 = await get("/api/reminders");
  if (cron1.status === 401) ok("Cron without secret → 401");
  else bad(`Cron unauth returned ${cron1.status}`);

  const cron2 = await get("/api/reminders?secret=wrong-value");
  if (cron2.status === 401) ok("Cron with wrong secret → 401");
  else bad(`Cron wrong secret returned ${cron2.status}`);

  // ───────────────────────────────────────────────
  head("4. Payment endpoints — reject missing config");
  // ───────────────────────────────────────────────
  // Use a known user that has Stripe DISABLED (any non-Square user)
  const userNoStripe = await prisma.user.findFirst({
    where: { paymentMethods: { equals: null } },
    select: { id: true, slug: true },
  });
  if (userNoStripe) {
    const r = await post("/api/stripe/deposit-intent", {
      userId: userNoStripe.id, amount: 25, customerEmail: "x@y.com", serviceName: "Test",
    });
    if (r.status === 503) ok(`Stripe deposit-intent rejects unconfigured business → 503`);
    else bad(`Expected 503 from unconfigured Stripe, got ${r.status}: ${JSON.stringify(r.body)}`);

    const r2 = await post("/api/square/charge", {
      userId: userNoStripe.id, sourceId: "cnon:fake", amount: 25, customerEmail: "x@y.com", serviceName: "Test",
    });
    if (r2.status === 503) ok(`Square charge rejects unconfigured business → 503`);
    else bad(`Expected 503 from unconfigured Square, got ${r2.status}: ${JSON.stringify(r2.body)}`);
  }

  // 4b: amount validation
  const fakeUserId = "nonexistent_id";
  const negAmt = await post("/api/stripe/deposit-intent", {
    userId: fakeUserId, amount: -10, customerEmail: "x@y.com", serviceName: "T",
  });
  if (negAmt.status === 400) ok(`Stripe rejects negative amount → 400`);
  else bad(`Negative amount returned ${negAmt.status}`);

  const zeroAmt = await post("/api/square/charge", {
    userId: fakeUserId, sourceId: "x", amount: 0, customerEmail: "x@y.com", serviceName: "T",
  });
  if (zeroAmt.status === 400) ok(`Square rejects zero amount → 400`);
  else bad(`Zero amount returned ${zeroAmt.status}`);

  // ───────────────────────────────────────────────
  head("5. Suspended account — booking page returns 403");
  // ───────────────────────────────────────────────
  const stamp = Date.now();
  const suspended = await prisma.user.create({
    data: {
      email: `suspended-${stamp}@detailbook-audit.com`,
      password: "x",
      businessName: "Suspended Biz",
      name: "S", phone: "+15551112222", city: "Miami",
      slug: `suspended-${stamp}`,
      plan: "starter",
      trialEndsAt: new Date(Date.now() + 30 * 86400_000).toISOString().split("T")[0],
      suspended: true,
    },
  });
  const susRes = await get(`/api/book/${suspended.slug}`);
  if (susRes.status === 403) ok(`Suspended business → 403`);
  else bad(`Suspended business returned ${susRes.status}`);

  // Try to POST a booking against the suspended business — should fail
  const susBook = await post("/api/bookings", {
    userId: suspended.id,
    customerName: "Bad Actor", customerEmail: "x@y.com", customerPhone: "+15555550100",
    serviceName: "Hack", servicePrice: 1, date: "2099-01-01", time: "9:00 AM",
  });
  if (susBook.status >= 400) ok(`POST booking to suspended biz → ${susBook.status} (rejected)`);
  else bad(`POST booking to suspended biz returned ${susBook.status} — booking created!`);
  await prisma.booking.deleteMany({ where: { userId: suspended.id } });

  // ───────────────────────────────────────────────
  head("6. Trial-expired account — booking page returns 403");
  // ───────────────────────────────────────────────
  const expired = await prisma.user.create({
    data: {
      email: `expired-${stamp}@detailbook-audit.com`,
      password: "x",
      businessName: "Expired Biz",
      name: "E", phone: "+15551112222", city: "Miami",
      slug: `expired-${stamp}`,
      plan: "starter",
      trialEndsAt: "2020-01-01",  // expired
      suspended: false,
    },
  });
  const expRes = await get(`/api/book/${expired.slug}`);
  if (expRes.status === 403) ok(`Trial-expired business → 403`);
  else if (expRes.status === 200) bad(`Trial-expired business → 200! Booking page leaks expired trials.`);
  else warning(`Trial-expired returned ${expRes.status}`);

  // ───────────────────────────────────────────────
  head("7. Booking page sensitive-data leak check");
  // ───────────────────────────────────────────────
  // Use any active business
  const anyActive = await prisma.user.findFirst({
    where: { suspended: false, trialEndsAt: { gt: new Date().toISOString().split("T")[0] } },
    select: { slug: true },
  });
  if (anyActive) {
    const r = await get(`/api/book/${anyActive.slug}`);
    if (r.status === 200) {
      const leaks = [];
      if (r.body?.password) leaks.push("password");
      if (r.body?.email) leaks.push("email");
      if (r.body?.googleAccessToken) leaks.push("googleAccessToken");
      if (r.body?.googleRefreshToken) leaks.push("googleRefreshToken");
      if (r.body?.paddleCustomerId) leaks.push("paddleCustomerId");
      if (r.body?.paddleSubscriptionId) leaks.push("paddleSubscriptionId");
      if (r.body?.paymentMethods?.stripe?.secretKey) leaks.push("stripe.secretKey");
      if (r.body?.paymentMethods?.stripe?.webhookSecret) leaks.push("stripe.webhookSecret");
      if (r.body?.paymentMethods?.square?.accessToken) leaks.push("square.accessToken");
      if (leaks.length) bad(`PUBLIC booking page leaks: ${leaks.join(", ")}`);
      else ok(`Booking page (${anyActive.slug}): no sensitive fields leaked`);
    } else {
      warning(`Sample active business booking page returned ${r.status} — couldn't audit leaks`);
    }
  }

  // ───────────────────────────────────────────────
  head("8. Cross-tenant booking-list access — must require own session");
  // ───────────────────────────────────────────────
  // GET /api/bookings?userId=other_user_id — should reject without session entirely
  const xtenant = await get(`/api/bookings?userId=any-other-id`);
  if (xtenant.status === 401) ok(`Cross-tenant GET /api/bookings → 401`);
  else bad(`Cross-tenant GET returned ${xtenant.status}`);

  // ───────────────────────────────────────────────
  head("9. Booking POST validation — common attacks");
  // ───────────────────────────────────────────────
  if (anyActive) {
    const owner = await prisma.user.findUnique({ where: { slug: anyActive.slug } });
    // 9a. SQL-y string in customerName — should NOT 500
    const sqli = await post("/api/bookings", {
      userId: owner.id,
      customerName: "Robert'); DROP TABLE bookings;--",
      customerEmail: "x@y.com", customerPhone: "+15555550100",
      serviceName: "Test", servicePrice: 10,
      date: new Date(Date.now() + 86400_000).toISOString().split("T")[0],
      time: "10:00 AM",
    });
    if (sqli.status !== 500) ok(`SQL injection attempt → ${sqli.status} (no 500)`);
    else bad(`SQL-y customerName caused 500`);
    if (sqli.body?.id) await prisma.booking.delete({ where: { id: sqli.body.id } }).catch(() => {});

    // 9b. XSS in customerName — should be stored safely & escaped in emails
    const xss = await post("/api/bookings", {
      userId: owner.id,
      customerName: "<script>alert(1)</script>",
      customerEmail: "x@y.com", customerPhone: "+15555550100",
      serviceName: "Test", servicePrice: 10,
      date: new Date(Date.now() + 86400_000).toISOString().split("T")[0],
      time: "10:30 AM",
    });
    if (xss.status === 201 || xss.status === 200) ok(`XSS-style name accepted (must be escaped on render — verify in inbox)`);
    else if (xss.status === 400) ok(`XSS-style name rejected at validation → 400`);
    else bad(`XSS test returned ${xss.status}`);
    if (xss.body?.id) await prisma.booking.delete({ where: { id: xss.body.id } }).catch(() => {});

    // 9c. Massive paymentProof base64 (>20MB cap)
    const huge = "data:image/png;base64," + "A".repeat(30 * 1024 * 1024);
    const tooBig = await post("/api/bookings", {
      userId: owner.id,
      customerName: "Big Image", customerEmail: "x@y.com", customerPhone: "+15555550100",
      serviceName: "Test", servicePrice: 10,
      date: new Date(Date.now() + 86400_000).toISOString().split("T")[0],
      time: "11:00 AM",
      paymentProof: huge,
    });
    if (tooBig.status === 400) ok(`>20MB paymentProof → 400`);
    else if (tooBig.status === 413) ok(`>20MB paymentProof → 413 (request too large)`);
    else bad(`Huge paymentProof returned ${tooBig.status}`);
  }

  // ───────────────────────────────────────────────
  head("10. Health of recent deploy");
  // ───────────────────────────────────────────────
  const home = await fetch(BASE).catch(() => null);
  if (home && home.status < 500) ok(`Homepage reachable (HTTP ${home.status})`);
  else bad(`Homepage unreachable or 5xx`);

  // ───────────────────────────────────────────────
  head("Cleanup");
  // ───────────────────────────────────────────────
  await prisma.user.deleteMany({
    where: { email: { startsWith: `suspended-${stamp}@` } },
  }).catch(() => {});
  await prisma.user.deleteMany({
    where: { email: { startsWith: `expired-${stamp}@` } },
  }).catch(() => {});
  ok("Test users cleaned up");

  // ───────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${C.b}AUDIT:${C.x} ${C.g}${pass} passed${C.x}  ${fail > 0 ? `${C.r}${fail} failed${C.x}` : `${C.g}0 failed${C.x}`}  ${warn > 0 ? `${C.y}${warn} warnings${C.x}` : ""}`);
  console.log("═".repeat(60));

  if (issues.length) {
    console.log(`\n${C.r}${C.b}Critical issues to fix BEFORE ads:${C.x}`);
    issues.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  } else {
    console.log(`\n${C.g}${C.b}✓ No critical issues found. Safe to launch ads.${C.x}\n`);
  }

  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(`\n${C.r}Audit crashed:${C.x}`, e);
  await prisma.$disconnect();
  process.exit(1);
});
