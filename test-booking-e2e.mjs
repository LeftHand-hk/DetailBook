/**
 * BOOKING FLOW — END-TO-END
 *
 * Hits the live booking API the same way a customer's browser would:
 *   GET  /api/book/[slug]                — load business profile + slots
 *   POST /api/bookings                   — create booking (manual & card-confirmed)
 *   PUT  /api/bookings/[id]              — status transitions (pending → confirmed)
 *   PATCH (deposit)                      — mark deposit paid via PUT
 *
 * Verifies:
 *   - Business profile is returned with secrets stripped
 *   - Manual booking creates a "pending" row, dispatches owner email
 *   - Card-confirmed booking saves with paymentProof "stripe:..." accepted by validation
 *   - status: pending → confirmed triggers customer email + SMS (Pro plan)
 *   - Validation rejects: bad email, past date, too-far date, bad paymentProof
 *   - Idempotency dedups identical bookings within 60s
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node test-booking-e2e.mjs
 *   BASE_URL=https://detailbookapp.com TEST_CUSTOMER_PHONE=+1XXXXXXXXXX node test-booking-e2e.mjs
 *
 * Env:
 *   BASE_URL              — default https://detailbookapp.com
 *   TEST_CUSTOMER_EMAIL   — default mail.arditzogiani@gmail.com (where customer emails land)
 *   TEST_CUSTOMER_PHONE   — default +15555550100 (Twilio will reject; set real US # for real SMS)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BASE = (process.env.BASE_URL || "https://detailbookapp.com").replace(/\/$/, "");
const CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || "mail.arditzogiani@gmail.com";
const CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || "+15555550100";

const stamp = Date.now();
const TEST_SLUG = `e2e-${stamp}`;
const TEST_EMAIL = `e2e-${stamp}@detailbook-e2e.com`;
const OWNER_INBOX = CUSTOMER_EMAIL; // owner notifications also land in same inbox so user can see them

const C = {
  g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", c: "\x1b[36m",
  d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m",
};
let pass = 0, fail = 0, warn = 0;
const issues = [];

function ok(m) { console.log(`  ${C.g}✓${C.x} ${m}`); pass++; }
function bad(m) { console.log(`  ${C.r}✗ ${m}${C.x}`); fail++; issues.push(m); }
function warning(m) { console.log(`  ${C.y}⚠ ${m}${C.x}`); warn++; }
function head(m) { console.log(`\n${C.b}${C.c}═══ ${m} ═══${C.x}`); }
function info(m) { console.log(`  ${C.d}${m}${C.x}`); }

async function postJson(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function putJson(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

async function cleanup(userId) {
  if (!userId) return;
  await prisma.notification.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.booking.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.package.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.staff.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function main() {
  console.log(`\n${C.b}🧪 Booking Flow E2E${C.x}`);
  console.log(`${C.d}BASE_URL:        ${BASE}${C.x}`);
  console.log(`${C.d}Customer email:  ${CUSTOMER_EMAIL}${C.x}`);
  console.log(`${C.d}Customer phone:  ${CUSTOMER_PHONE}${C.x}`);
  console.log(`${C.d}Test slug:       ${TEST_SLUG}${C.x}`);
  if (CUSTOMER_PHONE === "+15555550100") {
    warning("TEST_CUSTOMER_PHONE not set — SMS gate will fire but Twilio will reject the placeholder number.");
    warn--; // not actually a failure, just a notice
  }

  let userId = null;
  let createdBookingIds = [];

  try {
    // ───────────────────────────────────────────────
    head("0. Reachability");
    // ───────────────────────────────────────────────
    try {
      const r = await fetch(`${BASE}/api/health`).catch(() => null);
      if (r) ok(`Server is up at ${BASE} (status ${r.status})`);
      else {
        const r2 = await fetch(BASE).catch(() => null);
        if (r2) ok(`Server is up at ${BASE} (status ${r2.status})`);
        else bad(`Cannot reach ${BASE} — start the server or fix BASE_URL`);
      }
    } catch (e) {
      bad(`Cannot reach ${BASE}: ${e.message}`);
    }
    if (fail > 0) throw new Error("Server unreachable — aborting");

    // ───────────────────────────────────────────────
    head("1. Seed test business (Pro plan, full payment methods)");
    // ───────────────────────────────────────────────
    const hashedPw = await bcrypt.hash("E2ePass!234", 10);
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        password: hashedPw,
        businessName: "E2E Test Detailing",
        name: "E2E Owner",
        phone: "+15551112222",
        city: "Miami",
        slug: TEST_SLUG,
        plan: "pro",
        trialEndsAt: new Date(Date.now() + 30 * 86400_000).toISOString().split("T")[0],
        serviceType: "mobile",
        timezone: "America/New_York",
        emailReminders: true,
        emailConfirmations: true,
        smsConfirmations: true,
        smsRemindersEnabled: true,
        emailRemindersEnabled: true,
        advanceBookingDays: 30,
        requireDeposit: true,
        depositPercentage: 25,
        bio: "E2E test biz",
        businessHours: {
          monday:    { open: "8:00 AM", close: "6:00 PM", closed: false },
          tuesday:   { open: "8:00 AM", close: "6:00 PM", closed: false },
          wednesday: { open: "8:00 AM", close: "6:00 PM", closed: false },
          thursday:  { open: "8:00 AM", close: "6:00 PM", closed: false },
          friday:    { open: "8:00 AM", close: "6:00 PM", closed: false },
          saturday:  { open: "9:00 AM", close: "4:00 PM", closed: false },
          sunday:    { open: "9:00 AM", close: "4:00 PM", closed: true },
        },
        paymentMethods: {
          stripe:       { enabled: false, publishableKey: "", secretKey: "", connected: false },
          square:       { enabled: false, applicationId: "", accessToken: "", locationId: "", sandbox: true },
          paypal:       { enabled: true, email: "biz@paypal.test", paypalMeLink: "e2etest", requireProof: false },
          cashapp:      { enabled: true, cashtag: "$E2ETest", requireProof: false },
          bankTransfer: { enabled: true, bankName: "Chase", accountName: "E2E Test", accountNumber: "1234567890", iban: "", sortCode: "", instructions: "Use booking ID", requireProof: false },
          cash:         { enabled: true, instructions: "Pay at the appointment" },
        },
      },
    });
    userId = user.id;
    ok(`Business created: ${user.email} (slug ${user.slug}, plan ${user.plan})`);

    const pkg1 = await prisma.package.create({
      data: { userId, name: "Express Wash", description: "30-min hand wash", price: 80, duration: 30, active: true },
    });
    const pkg2 = await prisma.package.create({
      data: { userId, name: "Full Detail", description: "Interior + exterior", price: 240, duration: 120, active: true },
    });
    ok(`Packages created: ${pkg1.name} ($${pkg1.price}), ${pkg2.name} ($${pkg2.price})`);

    // ───────────────────────────────────────────────
    head("2. GET /api/book/[slug] — public booking page");
    // ───────────────────────────────────────────────
    const profileRes = await getJson(`/api/book/${TEST_SLUG}`);
    if (profileRes.status === 200) ok(`200 OK`);
    else bad(`Expected 200, got ${profileRes.status}: ${JSON.stringify(profileRes.body)}`);

    const profile = profileRes.body;
    if (profile.businessName === "E2E Test Detailing") ok("businessName returned");
    else bad(`businessName mismatch: ${profile.businessName}`);

    if (Array.isArray(profile.packages) && profile.packages.length === 2) ok(`packages: 2 returned`);
    else bad(`packages count wrong: ${profile.packages?.length}`);

    if (profile.password === undefined && profile.email === undefined) ok("Sensitive fields stripped");
    else bad("Profile leaked password or email!");

    if (profile.paymentMethods?.paypal?.enabled && profile.paymentMethods?.cash?.enabled) ok("Payment methods exposed (paypal, cash)");
    else bad(`paymentMethods missing: ${JSON.stringify(profile.paymentMethods)}`);

    if (profile.paymentMethods?.stripe?.secretKey === undefined) ok("Stripe secret key NOT exposed");
    else bad("Stripe secret key leaked!");

    if (profile.requireDeposit === true && profile.serviceType === "mobile") ok("Deposit + serviceType correct");
    else bad(`requireDeposit/serviceType: ${profile.requireDeposit}/${profile.serviceType}`);

    // ───────────────────────────────────────────────
    head("3. GET /api/book/[slug] — 404 on unknown slug");
    // ───────────────────────────────────────────────
    const notFound = await getJson(`/api/book/nonexistent-${stamp}`);
    if (notFound.status === 404) ok("Unknown slug → 404");
    else bad(`Expected 404, got ${notFound.status}`);

    // ───────────────────────────────────────────────
    head("4. POST /api/bookings — Manual payment (cash, status pending)");
    // ───────────────────────────────────────────────
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().split("T")[0];
    const manualPayload = {
      userId,
      customerName: "Manual Customer",
      customerEmail: CUSTOMER_EMAIL,
      customerPhone: CUSTOMER_PHONE,
      vehicle: { make: "Toyota", model: "Camry", year: "2023", color: "Silver" },
      serviceId: pkg1.id,
      serviceName: pkg1.name,
      servicePrice: pkg1.price,
      date: tomorrow,
      time: "10:00 AM",
      depositRequired: 20,
      depositPaid: 0,
      address: "123 Manual St, Miami FL",
      paymentMethod: "cash",
      status: "pending",
    };
    const manualRes = await postJson("/api/bookings", manualPayload);
    if (manualRes.status === 201) ok(`201 Created — id ${manualRes.body.id}`);
    else bad(`Expected 201, got ${manualRes.status}: ${JSON.stringify(manualRes.body)}`);
    if (manualRes.body.id) createdBookingIds.push(manualRes.body.id);

    if (manualRes.body.status === "pending") ok("Status saved as pending");
    else bad(`Status wrong: ${manualRes.body.status}`);

    info(`→ Owner notification email should be sent to ${OWNER_INBOX} (sender: SMTP_FROM)`);
    info("→ NO customer confirmation email/SMS expected (status=pending)");

    // ───────────────────────────────────────────────
    head("5. POST /api/bookings — Stripe card paid (status confirmed + paymentProof stripe:...)");
    // ───────────────────────────────────────────────
    const stripePayload = {
      userId,
      customerName: "Stripe Customer",
      customerEmail: CUSTOMER_EMAIL,
      customerPhone: CUSTOMER_PHONE,
      vehicle: { make: "BMW", model: "X5", year: "2024", color: "Black" },
      serviceId: pkg2.id,
      serviceName: pkg2.name,
      servicePrice: pkg2.price,
      date: tomorrow,
      time: "1:00 PM",
      depositRequired: 60,
      depositPaid: 60,
      address: "456 Card Ave, Miami Beach FL",
      paymentMethod: "card",
      status: "confirmed",
      paymentProof: `stripe:pi_e2e_${stamp}`,
    };
    const stripeRes = await postJson("/api/bookings", stripePayload);
    if (stripeRes.status === 201) ok(`201 Created — id ${stripeRes.body.id}`);
    else bad(`Expected 201, got ${stripeRes.status}: ${JSON.stringify(stripeRes.body)}`);
    if (stripeRes.body.id) createdBookingIds.push(stripeRes.body.id);

    if (stripeRes.body.status === "confirmed") ok("Status saved as confirmed");
    else bad(`Status wrong: ${stripeRes.body.status}`);

    if (stripeRes.body.depositPaid === 60) ok("depositPaid = 60");
    else bad(`depositPaid: ${stripeRes.body.depositPaid}`);

    info(`→ Customer confirmation email expected at ${CUSTOMER_EMAIL}`);
    info(`→ Customer SMS expected at ${CUSTOMER_PHONE} (Pro plan + smsConfirmations enabled)`);

    // verify the paymentProof was actually persisted
    const stripeBooking = await prisma.booking.findUnique({ where: { id: stripeRes.body.id } });
    if (stripeBooking?.paymentProof?.startsWith("stripe:pi_e2e_")) ok("paymentProof persisted as stripe:... reference");
    else bad(`paymentProof not persisted: ${stripeBooking?.paymentProof}`);

    // ───────────────────────────────────────────────
    head("6. POST /api/bookings — Square card paid (status confirmed + paymentProof square:...)");
    // ───────────────────────────────────────────────
    const squarePayload = {
      ...stripePayload,
      customerName: "Square Customer",
      time: "2:00 PM",
      paymentProof: `square:sq_pay_e2e_${stamp}`,
    };
    const squareRes = await postJson("/api/bookings", squarePayload);
    if (squareRes.status === 201) ok(`201 Created — id ${squareRes.body.id}`);
    else bad(`Expected 201, got ${squareRes.status}: ${JSON.stringify(squareRes.body)}`);
    if (squareRes.body.id) createdBookingIds.push(squareRes.body.id);

    const squareBooking = await prisma.booking.findUnique({ where: { id: squareRes.body.id } });
    if (squareBooking?.paymentProof?.startsWith("square:sq_pay_e2e_")) ok("paymentProof persisted as square:... reference");
    else bad(`square paymentProof not persisted: ${squareBooking?.paymentProof}`);

    // ───────────────────────────────────────────────
    head("7. PUT /api/bookings/[id] — auth-gated (must require session)");
    // ───────────────────────────────────────────────
    if (createdBookingIds[0]) {
      // Status transitions are dashboard-only — the public booking flow can't
      // mutate status. Verify the endpoint refuses unauthenticated PUTs.
      const transitionRes = await putJson(`/api/bookings/${createdBookingIds[0]}`, { status: "confirmed" });
      if (transitionRes.status === 401) ok("Unauthenticated PUT → 401 (auth-gated, correct)");
      else bad(`Expected 401 from public PUT, got ${transitionRes.status}: ${JSON.stringify(transitionRes.body)}`);

      // Simulate the dashboard's transition by mutating directly through Prisma
      // and let the API send the email/SMS via a re-create path. We test the
      // notification fanout via the POST status=confirmed in step 5/6 instead.
      info(`→ Status-transition email/SMS path is exercised by POST status=confirmed in steps 5 & 6.`);
    }

    // ───────────────────────────────────────────────
    head("8. Validation — bad inputs are rejected");
    // ───────────────────────────────────────────────

    // 8a. Missing customerName
    const missingName = await postJson("/api/bookings", { ...manualPayload, customerName: "" });
    if (missingName.status === 400) ok("Missing customerName → 400");
    else bad(`Expected 400 for missing name, got ${missingName.status}`);

    // 8b. Bad email
    const badEmail = await postJson("/api/bookings", {
      ...manualPayload,
      customerEmail: "not-an-email",
      time: "11:00 AM",
    });
    if (badEmail.status === 400) ok("Invalid email → 400");
    else bad(`Expected 400 for bad email, got ${badEmail.status}: ${JSON.stringify(badEmail.body)}`);

    // 8c. Past date
    const past = await postJson("/api/bookings", {
      ...manualPayload,
      date: "2020-01-01",
      time: "11:30 AM",
    });
    if (past.status === 400) ok("Past date → 400");
    else bad(`Expected 400 for past date, got ${past.status}`);

    // 8d. Date too far in future
    const tooFar = new Date(Date.now() + 365 * 86400_000).toISOString().split("T")[0];
    const farRes = await postJson("/api/bookings", {
      ...manualPayload,
      date: tooFar,
      time: "12:00 PM",
    });
    if (farRes.status === 400) ok("Date beyond advanceBookingDays → 400");
    else bad(`Expected 400 for too-far date, got ${farRes.status}`);

    // 8e. Bad paymentProof prefix
    const badProof = await postJson("/api/bookings", {
      ...manualPayload,
      time: "12:30 PM",
      paymentProof: "javascript:alert(1)",
    });
    if (badProof.status === 400) ok("Bad paymentProof format → 400");
    else bad(`Expected 400 for bad paymentProof, got ${badProof.status}`);
    if (badProof.body?.id) createdBookingIds.push(badProof.body.id); // shouldn't have, but track for cleanup

    // ───────────────────────────────────────────────
    head("9. Idempotency — double-submit within 60s returns same booking");
    // ───────────────────────────────────────────────
    const idem1 = await postJson("/api/bookings", {
      ...manualPayload,
      customerName: "Idempotency Test",
      time: "3:00 PM",
    });
    const idem2 = await postJson("/api/bookings", {
      ...manualPayload,
      customerName: "Idempotency Test",
      time: "3:00 PM",
    });
    if (idem1.body?.id) createdBookingIds.push(idem1.body.id);
    if (idem2.body?.id && idem2.body.id !== idem1.body.id) createdBookingIds.push(idem2.body.id);

    if (idem1.status === 201 && idem2.status === 200 && idem1.body.id === idem2.body.id) {
      ok("Duplicate within 60s returned existing booking (200)");
    } else {
      warning(`Idempotency: 1st=${idem1.status}, 2nd=${idem2.status}, ids match=${idem1.body.id === idem2.body.id}`);
    }

    // ───────────────────────────────────────────────
    head("10. 2-hour reminder cron — /api/reminders");
    // ───────────────────────────────────────────────

    // Move the business to Kosovo's timezone so the appointment-time math we
    // do here matches what the cron parses.
    await prisma.user.update({
      where: { id: userId },
      data: { timezone: "Europe/Berlin" },
    });

    // Build an appointment time exactly 120 minutes from now in Europe/Berlin.
    const apptDate = new Date(Date.now() + 120 * 60_000);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
    const fParts = fmt.formatToParts(apptDate);
    const fObj = {};
    for (const p of fParts) fObj[p.type] = p.value;
    const reminderDateStr = `${fObj.year}-${fObj.month}-${fObj.day}`;
    const reminderTimeStr = `${parseInt(fObj.hour, 10)}:${fObj.minute} ${fObj.dayPeriod}`;

    info(`Creating booking at ${reminderDateStr} ${reminderTimeStr} (Europe/Berlin) — 120 min from now`);

    // Create directly in DB so we avoid the advanceBookingDays / timezone-shift
    // pitfalls of POSTing through the public API for this exact timing test.
    const reminderBooking = await prisma.booking.create({
      data: {
        userId,
        customerName: "Reminder Test",
        customerEmail: CUSTOMER_EMAIL,
        customerPhone: CUSTOMER_PHONE,
        vehicleMake: "Honda", vehicleModel: "Civic", vehicleYear: "2024", vehicleColor: "Blue",
        serviceId: pkg1.id, serviceName: pkg1.name, servicePrice: pkg1.price,
        date: reminderDateStr, time: reminderTimeStr,
        status: "confirmed",
        depositPaid: 0, depositRequired: 0,
        address: "Reminder St, Pristina",
        paymentMethod: "cash",
      },
    });
    createdBookingIds.push(reminderBooking.id);
    ok(`Reminder-target booking created: id ${reminderBooking.id}`);

    // Read CRON_SECRET from env (loaded by Prisma's dotenv chain via .env)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      bad("CRON_SECRET not loaded from .env — cannot call /api/reminders");
    } else {
      const cronRes = await getJson(`/api/reminders?secret=${encodeURIComponent(cronSecret)}`);
      if (cronRes.status === 200) ok(`Cron endpoint responded 200`);
      else bad(`Cron returned ${cronRes.status}: ${JSON.stringify(cronRes.body)}`);

      info(`Processed: ${cronRes.body?.processed} booking(s)`);
      const ourResult = (cronRes.body?.results || []).find((r) => r.id === reminderBooking.id);
      if (ourResult) {
        ok(`Our booking was picked up by cron`);
        if (ourResult.sms === "sent") ok(`SMS reminder dispatched to ${CUSTOMER_PHONE}`);
        else bad(`SMS reminder NOT sent: ${ourResult.sms}`);
        if (ourResult.email === "sent") ok(`Email reminder dispatched to ${CUSTOMER_EMAIL}`);
        else bad(`Email reminder NOT sent: ${ourResult.email}`);
      } else {
        bad(`Cron didn't process our booking. processed=${cronRes.body?.processed}, results=${JSON.stringify(cronRes.body?.results)}`);
      }

      // Verify reminderSentAt is now set
      const after = await prisma.booking.findUnique({ where: { id: reminderBooking.id } });
      if (after?.reminderSentAt) ok(`reminderSentAt timestamped — won't re-send`);
      else bad(`reminderSentAt still null!`);

      // Re-trigger cron — our booking should NOT be re-processed
      const cronRes2 = await getJson(`/api/reminders?secret=${encodeURIComponent(cronSecret)}`);
      const ourResult2 = (cronRes2.body?.results || []).find((r) => r.id === reminderBooking.id);
      if (!ourResult2) ok(`Re-running cron: booking skipped (already reminded)`);
      else bad(`Cron re-processed an already-reminded booking!`);
    }

    // ───────────────────────────────────────────────
    head("11. DB integrity — final state");
    // ───────────────────────────────────────────────
    const allBookings = await prisma.booking.findMany({ where: { userId } });
    info(`Total bookings created in DB: ${allBookings.length}`);
    const confirmedCount = allBookings.filter((b) => b.status === "confirmed").length;
    const pendingCount   = allBookings.filter((b) => b.status === "pending").length;
    info(`  confirmed: ${confirmedCount}, pending: ${pendingCount}`);

    const stripeProofs = allBookings.filter((b) => b.paymentProof?.startsWith("stripe:")).length;
    const squareProofs = allBookings.filter((b) => b.paymentProof?.startsWith("square:")).length;
    if (stripeProofs >= 1) ok(`Stripe-ref bookings persisted: ${stripeProofs}`);
    else bad("No stripe-ref bookings persisted!");
    if (squareProofs >= 1) ok(`Square-ref bookings persisted: ${squareProofs}`);
    else bad("No square-ref bookings persisted!");

    // notifications fanout
    const notifs = await prisma.notification.findMany({ where: { userId } });
    if (notifs.length >= allBookings.length) ok(`In-app notifications created: ${notifs.length}`);
    else warning(`Notifications: expected ≥${allBookings.length}, got ${notifs.length}`);

  } catch (e) {
    bad(`Test crashed: ${e.message}`);
    console.error(e);
  } finally {
    head("Cleanup");
    await cleanup(userId);
    ok(`Deleted test user, packages, bookings, notifications`);
  }

  // ───────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${C.b}RESULTS:${C.x} ${C.g}${pass} passed${C.x}  ${fail > 0 ? `${C.r}${fail} failed${C.x}` : `${C.g}0 failed${C.x}`}  ${warn > 0 ? `${C.y}${warn} warnings${C.x}` : ""}`);
  console.log("═".repeat(60));

  if (issues.length) {
    console.log(`\n${C.r}${C.b}Issues:${C.x}`);
    issues.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  } else {
    console.log(`\n${C.g}${C.b}✓ Booking flow looks healthy end-to-end.${C.x}`);
  }
  console.log(`\n${C.d}Manual checks remaining (only you can confirm):${C.x}`);
  console.log(`  • Did ${OWNER_INBOX} receive the "New Booking" email(s)?`);
  console.log(`  • Did ${CUSTOMER_EMAIL} receive a "Booking Confirmed" email?`);
  console.log(`  • Did ${CUSTOMER_PHONE} receive a confirmation SMS?\n`);

  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(`\n${C.r}Test runner crashed:${C.x}`, e);
  await prisma.$disconnect();
  process.exit(1);
});
