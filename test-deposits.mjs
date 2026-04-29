/**
 * DEPOSIT ENDPOINTS TEST
 * Validates the new Paddle / Square / verify endpoints behave correctly
 * for the input contracts we just shipped.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || "https://detailbookapp.com";

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
let pass = 0, fail = 0;
const issues = [];

function ok(m) { console.log(`  ${C.g}✓${C.x} ${m}`); pass++; }
function bad(m) { console.log(`  ${C.r}✗ ${m}${C.x}`); fail++; issues.push(m); }
function head(m) { console.log(`\n${C.b}${C.c}═══ ${m} ═══${C.x}`); }

async function postJson(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function main() {
  console.log(`${C.b}🧪 Deposit Endpoints Test — ${BASE}${C.x}\n`);

  // ═══════════════════════════════════════════════════════════════════
  head("Endpoint reachability (deploy sanity)");
  // ═══════════════════════════════════════════════════════════════════
  for (const path of ["/api/paddle/deposit", "/api/square/deposit", "/api/deposit/verify"]) {
    const r = await postJson(path, {});
    if (r.status === 404) bad(`${path} returns 404 — deploy missing this endpoint`);
    else ok(`${path} reachable (status ${r.status})`);
  }

  // ═══════════════════════════════════════════════════════════════════
  head("Input validation — Paddle deposit");
  // ═══════════════════════════════════════════════════════════════════
  {
    const r = await postJson("/api/paddle/deposit", {});
    if (r.status === 400) ok("Empty body → 400");
    else bad(`Empty body should be 400, got ${r.status}`);
  }
  {
    const r = await postJson("/api/paddle/deposit", {
      userId: "x", bookingId: "x", amount: -5, customerEmail: "a@b.c", serviceName: "X",
    });
    if (r.status === 400 && /positive/i.test(r.body?.error || "")) ok("Negative amount → 400 with explanation");
    else bad(`Negative amount should reject, got ${r.status} ${JSON.stringify(r.body)}`);
  }
  {
    const r = await postJson("/api/paddle/deposit", {
      userId: "nonexistent_user_id", bookingId: "x", amount: 25,
      customerEmail: "a@b.c", serviceName: "X",
    });
    if (r.status === 404 || r.status === 503) ok(`Unknown user → ${r.status} (expected)`);
    else bad(`Unknown user should be 404/503, got ${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  head("Input validation — Square deposit");
  // ═══════════════════════════════════════════════════════════════════
  {
    const r = await postJson("/api/square/deposit", {});
    if (r.status === 400) ok("Empty body → 400");
    else bad(`Empty body should be 400, got ${r.status}`);
  }
  {
    const r = await postJson("/api/square/deposit", {
      userId: "x", bookingId: "x", amount: 0, customerEmail: "a@b.c", serviceName: "X",
    });
    if (r.status === 400) ok("Zero amount → 400");
    else bad(`Zero amount should reject, got ${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  head("Verify endpoint contract");
  // ═══════════════════════════════════════════════════════════════════
  {
    const r = await postJson("/api/deposit/verify", {});
    if (r.status === 400) ok("Missing bookingId → 400");
    else bad(`Missing bookingId should be 400, got ${r.status}`);
  }
  {
    const r = await postJson("/api/deposit/verify", { bookingId: "nonexistent_xyz" });
    if (r.status === 404) ok("Unknown booking → 404");
    else bad(`Unknown booking should be 404, got ${r.status}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  head("Verify against a real booking with no proof");
  // ═══════════════════════════════════════════════════════════════════
  // Pick any existing booking to make sure verify doesn't crash on a real row
  const someBooking = await prisma.booking.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!someBooking) {
    console.log(`  ${C.y}⚠ no bookings in DB to test verify against${C.x}`);
  } else {
    const r = await postJson("/api/deposit/verify", { bookingId: someBooking.id });
    if (r.status === 200) ok(`Real booking verify returned 200 with paid=${r.body.paid}`);
    else bad(`Real booking verify should be 200, got ${r.status} ${JSON.stringify(r.body)}`);
    // If the booking already had depositPaid > 0, verify should report paid=true
    if (someBooking.depositPaid > 0 && r.body.paid !== true) {
      bad(`Booking has depositPaid=${someBooking.depositPaid} but verify said paid=${r.body.paid}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  head("Schema sanity — new payment method fields accepted");
  // ═══════════════════════════════════════════════════════════════════
  // Make sure the JSON shape we're saving from the dashboard round-trips.
  const testUser = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (testUser) {
    const before = testUser.paymentMethods;
    try {
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          paymentMethods: {
            ...(before || {}),
            paddle: { enabled: false, apiKey: "test_key", productId: "pro_test", sandbox: true },
            square: { enabled: false, accessToken: "test_token", locationId: "L_test", sandbox: true },
          },
        },
      });
      const after = await prisma.user.findUnique({ where: { id: testUser.id } });
      const pm = after.paymentMethods;
      if (pm?.paddle?.apiKey === "test_key" && pm?.square?.accessToken === "test_token") {
        ok("Paddle + Square config persists in paymentMethods JSON");
      } else {
        bad("Paddle/Square config did not round-trip through DB");
      }
      // Restore
      await prisma.user.update({
        where: { id: testUser.id },
        data: { paymentMethods: before === null ? undefined : before },
      });
    } catch (e) {
      bad(`Schema write failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log(`\n${C.b}═══ Results ═══${C.x}`);
  console.log(`  ${C.g}✓ ${pass} passed${C.x}`);
  if (fail > 0) {
    console.log(`  ${C.r}✗ ${fail} failed${C.x}`);
    for (const i of issues) console.log(`    ${C.r}- ${i}${C.x}`);
  }
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
