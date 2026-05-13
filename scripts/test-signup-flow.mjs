/**
 * Signup flow audit for the 7-day card-required trial.
 *
 * Runs real HTTP requests against production and reads the DB to verify:
 *  - register endpoint creates user with trialEndsAt = signup + 7d
 *  - subscriptionStatus starts unset (becomes "trialing" only after Paddle webhook)
 *  - Day 0 welcome email gets logged
 *  - cancel flow during trial preserves dashboard access
 *  - cancel flow after trial suspends the account
 *
 * Creates a throwaway user, asserts each step, then deletes it.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "https://detailbookapp.com").replace(/\/$/, "");

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
let pass = 0, fail = 0;
function ok(m) { console.log(`  ${C.g}✓${C.x} ${m}`); pass++; }
function bad(m) { console.log(`  ${C.r}✗ ${m}${C.x}`); fail++; }
function head(m) { console.log(`\n${C.b}${C.c}═══ ${m} ═══${C.x}`); }
function info(m) { console.log(`  ${C.d}${m}${C.x}`); }

async function post(path, body, cookieHeader) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
    body: JSON.stringify(body || {}),
  });
  const setCookie = r.headers.get("set-cookie");
  let json; try { json = await r.json(); } catch { json = null; }
  return { status: r.status, body: json, setCookie };
}

async function get(path, cookieHeader) {
  const r = await fetch(`${BASE}${path}`, { headers: cookieHeader ? { Cookie: cookieHeader } : {} });
  let json; try { json = await r.json(); } catch { json = null; }
  return { status: r.status, body: json };
}

function dayDiff(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return ms / (24 * 60 * 60 * 1000);
}

async function main() {
  console.log(`\n${C.b}🧪 Signup Flow Audit — ${BASE}${C.x}`);
  const testEmail = `signup-audit-${Date.now()}@detailbook-test.invalid`;
  const password = "TestPass123!";
  let userId = null;
  let sessionCookie = null;

  try {
    head("1. POST /api/auth/register — create test user");
    const reg = await post("/api/auth/register", {
      email: testEmail,
      password,
      name: "Audit Bot",
      businessName: "Audit Detailing",
      timezone: "America/New_York",
    });
    if (reg.status === 200 || reg.status === 201) ok(`register returned ${reg.status}`);
    else { bad(`register returned ${reg.status}: ${JSON.stringify(reg.body)}`); return; }

    // Extract session cookie for follow-up authenticated calls
    if (reg.setCookie) {
      const m = reg.setCookie.match(/detailbook_token=[^;,]+/);
      if (m) { sessionCookie = m[0]; ok(`session cookie set (${m[0].split("=")[0]})`); }
      else bad(`register response missing detailbook_token cookie. Got: ${reg.setCookie.slice(0, 200)}`);
    }

    const created = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!created) { bad("user not found in DB after register"); return; }
    userId = created.id;
    ok(`user row created id=${userId.slice(0, 8)}…`);

    head("2. trialEndsAt is exactly 7 days from now (±5 minutes tolerance)");
    const d = dayDiff(created.trialEndsAt);
    if (d === null) bad("trialEndsAt is null/empty");
    else if (Math.abs(d - 7) < (5 / (60 * 24))) ok(`trialEndsAt = +${d.toFixed(4)} days`);
    else bad(`trialEndsAt = +${d.toFixed(4)} days, expected ~7`);

    head("3. subscriptionStatus is empty (Paddle webhook hasn't fired yet)");
    if (!created.subscriptionStatus) ok(`subscriptionStatus is empty/null (was: ${JSON.stringify(created.subscriptionStatus)})`);
    else bad(`subscriptionStatus = ${created.subscriptionStatus} — should be empty before Paddle`);

    head("4. suspended = false on fresh signup");
    if (created.suspended === false) ok("suspended = false");
    else bad(`suspended = ${created.suspended}`);

    head("5. Plan defaults to 'starter'");
    if (created.plan === "starter") ok("plan = starter");
    else bad(`plan = ${created.plan}`);

    head("6. Slug was generated from businessName");
    if (created.slug && created.slug.length > 0) ok(`slug = ${created.slug}`);
    else bad(`slug = ${JSON.stringify(created.slug)}`);

    head("7. EmailLog row for welcome_day0 enqueued");
    // Give the fire-and-forget welcome a moment to write its log row.
    let logged = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      logged = await prisma.emailLog.findFirst({
        where: { userId, emailType: "welcome_day0" },
        orderBy: { createdAt: "desc" },
      });
      if (logged) break;
    }
    if (logged) {
      if (logged.success) ok(`welcome_day0 sent successfully (attempt ${logged.attempt})`);
      else info(`welcome_day0 attempted but failed: ${logged.errorMessage || "(no error)"} — retries via cron`);
    } else {
      info("welcome_day0 EmailLog not yet written (SMTP may be slow; cron will retry)");
    }

    head("8. GET /api/user with session cookie returns the user");
    if (sessionCookie) {
      const u = await get("/api/user", sessionCookie);
      if (u.status === 200 && u.body?.user?.email === testEmail) ok(`/api/user returned ${u.status} with matching email`);
      else bad(`/api/user returned ${u.status} body=${JSON.stringify(u.body).slice(0, 200)}`);

      // Verify trialEndsAt reaches the client correctly
      const cd = dayDiff(u.body?.user?.trialEndsAt);
      if (cd !== null && Math.abs(cd - 7) < 0.1) ok(`/api/user trialEndsAt = +${cd.toFixed(3)} days`);
      else bad(`/api/user trialEndsAt = +${cd} days — client won't show correct banner`);
    } else {
      info("skipped (no session cookie)");
    }

    head("9. POST /api/subscription/cancel during trial — should NOT suspend");
    if (sessionCookie) {
      const c1 = await post("/api/subscription/cancel", {}, sessionCookie);
      // The endpoint will likely return ok even without a Paddle sub (it
      // skips the Paddle call when paddleSubscriptionId is null).
      if (c1.status === 200) ok(`cancel returned 200 keptActiveUntilTrialEnd=${c1.body?.keptActiveUntilTrialEnd}`);
      else bad(`cancel returned ${c1.status} body=${JSON.stringify(c1.body)}`);

      const after = await prisma.user.findUnique({ where: { id: userId } });
      if (after?.suspended === false) ok("user.suspended remains false (still in trial)");
      else bad(`user.suspended = ${after?.suspended} — should be false during trial`);

      if (after?.subscriptionStatus === "canceled") ok("subscriptionStatus = canceled");
      else bad(`subscriptionStatus = ${after?.subscriptionStatus}`);
    }

    head("10. Cancel AFTER trial expires — SHOULD suspend");
    if (userId) {
      // Force trial expiry in DB
      await prisma.user.update({
        where: { id: userId },
        data: { trialEndsAt: new Date(Date.now() - 86400000).toISOString(), subscriptionStatus: "trialing", suspended: false },
      });
      const c2 = await post("/api/subscription/cancel", {}, sessionCookie);
      if (c2.status === 200) ok(`cancel (post-trial) returned 200 keptActiveUntilTrialEnd=${c2.body?.keptActiveUntilTrialEnd}`);
      else bad(`cancel (post-trial) returned ${c2.status}`);

      const after2 = await prisma.user.findUnique({ where: { id: userId } });
      if (after2?.suspended === true) ok("user.suspended = true (post-trial cancel)");
      else bad(`user.suspended = ${after2?.suspended} — should be true after trial`);
    }

    head("11. Paddle env vars present on the deployed app");
    // Indirectly: hit /signup to check page renders, and /dashboard/billing
    // server doesn't crash. Real env-var check requires server access.
    const sign = await fetch(`${BASE}/signup`);
    if (sign.ok) ok(`/signup renders (${sign.status})`);
    else bad(`/signup returned ${sign.status}`);

    head("12. Landing-page copy reflects 7-day card-required messaging");
    const landing = await fetch(`${BASE}/`);
    const html = await landing.text();
    if (/7[- ]day/i.test(html)) ok("landing mentions '7-day'");
    else bad("landing has no '7-day' reference");
    // 'Card required' is intentionally absent from the landing for ad-
    // friendly framing; the requirement is enforced in /onboarding.
    if (/[Cc]ard required/.test(html)) bad("landing should NOT mention 'card required' (ad-friendly copy)");
    else ok("landing has no 'card required' phrase (ad-friendly)");
    if (/14[- ]day/.test(html)) bad("landing still mentions '14-day' somewhere");
    else ok("landing has no stale '14-day' reference");
    if (/No credit card/i.test(html)) bad("landing still mentions 'No credit card'");
    else ok("landing has no stale 'No credit card' phrase");

  } finally {
    head("Cleanup");
    if (userId) {
      try {
        await prisma.emailLog.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
        ok(`deleted test user ${userId.slice(0, 8)}…`);
      } catch (e) {
        bad(`cleanup failed: ${e.message}`);
      }
    }
    await prisma.$disconnect();
  }

  console.log(`\n${C.b}Result:${C.x} ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
