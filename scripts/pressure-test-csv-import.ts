// Pressure-test the customer CSV import end-to-end. Runs the same
// client-side parse + autoMap logic on a variety of CSV layouts
// (Square, Vagaro, Spanish, Albanian, combined full-name, no-header,
// embedded commas, duplicates, broken rows), then POSTs each mapped
// payload to the live /api/customers/import endpoint and verifies the
// server's response. Cleans up by deleting every customer it created
// so the demo dashboard stays empty.
import "dotenv/config";

const BASE = "https://detailbookapp.com";

// ── client-side helpers ported verbatim from app/dashboard/customers/page.tsx
type ParsedCSV = { headers: string[]; rows: string[][] };

function parseCsv(text: string): ParsedCSV {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || row.length) { row.push(field); rows.push(row); }
        row = []; field = "";
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1).filter((r) => r.some((c) => (c || "").trim() !== "")) };
}

function scoreColumn(header: string, samples: string[]) {
  const h = (header || "").trim().toLowerCase();
  const filled = samples.map((s) => (s || "").trim()).filter(Boolean);
  const n = Math.max(1, filled.length);
  const hit = (...keys: string[]) => keys.some((k) => h.includes(k));

  const emailHeader = hit("email", "e-mail", "mail", "correo", "posta");
  const emailContent = filled.filter((s) => s.includes("@") && s.includes(".")).length / n;

  const phoneHeader = hit("phone", "mobile", "tel", "cell", "number", "celular", "movil", "kontakt");
  const phoneContent = filled.filter((s) => /^[+\d][\d\s\-().]{5,}$/.test(s)).length / n;

  const firstHeader = hit("first", "given", "fname", "fore", "emri");
  const lastHeader  = hit("last", "surname", "family", "lname", "mbiemr");
  const fullHeader  = hit("name", "full", "client", "customer", "nom", "nombre");
  const alphaContent = filled.filter((s) => /^[A-Za-zÀ-ÿ' \-.]+$/.test(s)).length / n;
  const spaceContent = filled.filter((s) => /\s/.test(s)).length / n;

  return {
    email: (emailHeader ? 0.6 : 0) + emailContent,
    phone: (phoneHeader ? 0.6 : 0) + phoneContent,
    firstName: (firstHeader ? 0.9 : 0) + (alphaContent * 0.5),
    lastName:  (lastHeader  ? 0.9 : 0) + (alphaContent * 0.3),
    fullName:  (fullHeader && !firstHeader && !lastHeader ? 0.8 : 0) + alphaContent * 0.4 + spaceContent * 0.4,
  };
}

function autoMap(headers: string[], sampleRows: string[][] = []) {
  const samples = headers.map((_, i) => sampleRows.slice(0, 10).map((r) => r[i] || ""));
  const scores = headers.map((h, i) => scoreColumn(h, samples[i]));
  const argmax = (key: keyof ReturnType<typeof scoreColumn>, threshold: number, exclude: number[]) => {
    let bestIdx = -1; let bestScore = threshold;
    scores.forEach((sc, i) => {
      if (exclude.includes(i)) return;
      if (sc[key] > bestScore) { bestScore = sc[key]; bestIdx = i; }
    });
    return bestIdx;
  };
  const email = argmax("email", 0.4, []);
  const phone = argmax("phone", 0.4, [email].filter((i) => i >= 0));
  const lastName = argmax("lastName", 0.7, [email, phone].filter((i) => i >= 0));
  let firstName = -1;
  if (lastName >= 0) firstName = argmax("firstName", 0.4, [email, phone, lastName]);
  else {
    firstName = argmax("fullName", 0.4, [email, phone].filter((i) => i >= 0));
    if (firstName < 0) firstName = argmax("firstName", 0.3, [email, phone].filter((i) => i >= 0));
  }
  return { firstName, lastName, email, phone };
}

function buildRowsFromMapping(parsed: ParsedCSV, m: ReturnType<typeof autoMap>) {
  return parsed.rows.map((cells) => {
    const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : "");
    let firstName = get(m.firstName);
    let lastName = get(m.lastName);
    if (firstName && !lastName && m.lastName < 0 && firstName.trim().includes(" ")) {
      const parts = firstName.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    }
    return { firstName, lastName, email: get(m.email), phone: get(m.phone) };
  });
}

// ── http helpers ──────────────────────────────────────────────────
async function loginAsDemo(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mike@demo.com", password: "demo123" }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  return (r.headers.get("set-cookie") || "").split(",").map((c) => c.split(";")[0]).join("; ");
}

async function postImport(cookie: string, rows: any[]) {
  return fetch(`${BASE}/api/customers/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ rows }),
  });
}

async function listCustomers(cookie: string) {
  const r = await fetch(`${BASE}/api/customers`, { headers: { cookie }, cache: "no-store" });
  return r.ok ? r.json() : [];
}

async function deleteCustomer(cookie: string, id: string) {
  return fetch(`${BASE}/api/customers/${id}`, { method: "DELETE", headers: { cookie } });
}

// ── test fixtures ─────────────────────────────────────────────────
const ts = Date.now();
const tag = (s: string) => `pt${ts}${s}`; // unique suffix per run to avoid cross-test dedup

const fixtures: { name: string; csv: string; expectImported: number; expectFailures?: number; expectSkipped?: number; describe: string }[] = [
  {
    name: "T1 standard headers",
    describe: "Name, Email, Phone — clean & simple",
    csv: [
      "Name,Email,Phone",
      `Carlos Cruz,carlos.${tag("a")}@test.com,+15551110001`,
      `Diana Lee,diana.${tag("a")}@test.com,+15551110002`,
      `Eric Stone,eric.${tag("a")}@test.com,+15551110003`,
    ].join("\n"),
    expectImported: 3,
  },
  {
    name: "T2 Square export style",
    describe: "Headers from a Square POS export — 'Customer Name' / 'Email Address' / 'Phone Number'",
    csv: [
      "Customer Name,Email Address,Phone Number,Address,Customer Group",
      `Frank White,frank.${tag("b")}@test.com,(555) 222 3001,123 Main St,VIP`,
      `Gina Harris,gina.${tag("b")}@test.com,555-222-3002,456 Oak St,Regular`,
    ].join("\n"),
    expectImported: 2,
  },
  {
    name: "T3 Spanish headers",
    describe: "Spanish-language headers — Nombre, Correo, Teléfono",
    csv: [
      "Nombre,Correo,Telefono",
      `Hugo Vega,hugo.${tag("c")}@test.com,+34 600 100 001`,
      `Isabel Romero,isabel.${tag("c")}@test.com,+34 600 100 002`,
    ].join("\n"),
    expectImported: 2,
  },
  {
    name: "T4 Albanian headers",
    describe: "Albanian-language headers — Emri, Mbiemri, Email, Kontakti",
    csv: [
      "Emri,Mbiemri,Email,Kontakti",
      `Jeton,Hoxha,jeton.${tag("d")}@test.com,+383 44 100 001`,
      `Klea,Berisha,klea.${tag("d")}@test.com,+383 44 100 002`,
    ].join("\n"),
    expectImported: 2,
  },
  {
    name: "T5 combined Full Name",
    describe: "One 'Full Name' column with first+last together — should be split",
    csv: [
      "Full Name,Email,Phone",
      `Liam Anderson,liam.${tag("e")}@test.com,+15553330001`,
      `Mia Robertson,mia.${tag("e")}@test.com,+15553330002`,
    ].join("\n"),
    expectImported: 2,
  },
  {
    name: "T6 dups in same file",
    describe: "Same email twice in the upload — second should be skipped",
    csv: [
      "Name,Email,Phone",
      `Nate Park,nate.${tag("f")}@test.com,+15554440001`,
      `Nate Park,nate.${tag("f")}@test.com,+15554440002`,
    ].join("\n"),
    expectImported: 1,
    expectSkipped: 1,
  },
  {
    name: "T7 quoted commas",
    describe: "Field with a comma inside quotes — must NOT split",
    csv: [
      "Name,Email,Phone,Notes",
      `"Ortega, Pablo",pablo.${tag("g")}@test.com,+15555550001,"Notes: prefers Tue, Thu"`,
    ].join("\n"),
    expectImported: 1,
  },
  {
    name: "T8 empty rows",
    describe: "CSV padded with totally blank lines — should silently skip them",
    csv: [
      "Name,Email,Phone",
      `Quinn Reed,quinn.${tag("h")}@test.com,+15556660001`,
      ",,",
      ",,",
      `Riley Bennett,riley.${tag("h")}@test.com,+15556660002`,
    ].join("\n"),
    expectImported: 2,
    expectSkipped: 0, // blank rows are filtered by parseCsv, never reach server
  },
  {
    name: "T9 missing first name",
    describe: "Row with only email/phone but no name → must land in failures",
    csv: [
      "Name,Email,Phone",
      `,onlyemail.${tag("i")}@test.com,+15557770001`,
      `Tara Klein,tara.${tag("i")}@test.com,+15557770002`,
    ].join("\n"),
    expectImported: 1,
    expectFailures: 1,
  },
  {
    name: "T10 no email and no phone",
    describe: "Row with a name but no contact info → failure with reason",
    csv: [
      "Name,Email,Phone",
      `Uma Patel,,`,
      `Vince Hardy,vince.${tag("j")}@test.com,+15558880001`,
    ].join("\n"),
    expectImported: 1,
    expectFailures: 1,
  },
  {
    name: "T11 phone-only customers",
    describe: "Phone-only rows (no email) — brief explicitly allows this",
    csv: [
      "Name,Phone",
      `Wendy Lin,+15559990001`,
      `Xander Cole,+15559990002`,
    ].join("\n"),
    expectImported: 2,
  },
  {
    name: "T12 extra columns ignored",
    describe: "CSV has irrelevant junk columns — they don't break detection",
    csv: [
      "Internal ID,Source,Customer Name,Notes,Email,Phone,Tag,Status",
      `12345,web,Yara Lopez,VIP,yara.${tag("k")}@test.com,+15550000001,detailing,active`,
      `12346,web,Zane Cox,,zane.${tag("k")}@test.com,+15550000002,wash,active`,
    ].join("\n"),
    expectImported: 2,
  },
];

// ── execution ─────────────────────────────────────────────────────
type Outcome = { test: string; pass: boolean; detail: string };
const results: Outcome[] = [];
const createdEmails = new Set<string>();
const createdPhones = new Set<string>();

async function runOne(cookie: string, f: typeof fixtures[number]) {
  const parsed = parseCsv(f.csv);
  const m = autoMap(parsed.headers, parsed.rows);
  const mapped = buildRowsFromMapping(parsed, m);

  // log column mapping decisions so we can debug failures at a glance
  const cols = parsed.headers.map((h, i) => `${i}:${h}`).join(" | ");
  console.log(`\n══ ${f.name}: ${f.describe}`);
  console.log(`   headers: [${cols}]`);
  console.log(`   mapping → firstName=${m.firstName}  lastName=${m.lastName}  email=${m.email}  phone=${m.phone}`);

  if (m.firstName < 0) {
    results.push({ test: f.name, pass: false, detail: "autoMap couldn't find a name column" });
    console.log(`   ✗ FAIL — autoMap could not detect a name column`);
    return;
  }

  const res = await postImport(cookie, mapped);
  const data = await res.json().catch(() => ({} as any));
  console.log(`   server → imported=${data.imported}  skipped=${data.skipped}  failures=${(data.failures || []).length}`);

  const importOk = data.imported === f.expectImported;
  const failuresOk = f.expectFailures == null || (data.failures || []).length === f.expectFailures;
  const skippedOk = f.expectSkipped == null || data.skipped === f.expectSkipped;
  const allOk = res.ok && importOk && failuresOk && skippedOk;

  results.push({
    test: f.name,
    pass: allOk,
    detail: `expected imported=${f.expectImported}${f.expectFailures != null ? ` failures=${f.expectFailures}` : ""}${f.expectSkipped != null ? ` skipped=${f.expectSkipped}` : ""}  got imported=${data.imported} failures=${(data.failures || []).length} skipped=${data.skipped}`,
  });
  console.log(`   ${allOk ? "✓ PASS" : "✗ FAIL"}`);
  if (!allOk && Array.isArray(data.failures) && data.failures.length) {
    console.log(`     failure rows: ${JSON.stringify(data.failures)}`);
  }

  // track created emails/phones so we can clean up
  mapped.forEach((r) => {
    if (r.email) createdEmails.add(r.email.toLowerCase().trim());
    if (r.phone) createdPhones.add(r.phone.trim());
  });
}

async function main() {
  console.log("Logging in as mike@demo.com …");
  const cookie = await loginAsDemo();
  console.log("✓ logged in");

  for (const f of fixtures) await runOne(cookie, f);

  // ── duplicate-against-existing test (T13)
  console.log(`\n══ T13: re-import same emails — should be 100% skipped`);
  const firstFixture = fixtures[0];
  const parsed = parseCsv(firstFixture.csv);
  const m = autoMap(parsed.headers, parsed.rows);
  const mapped = buildRowsFromMapping(parsed, m);
  const res = await postImport(cookie, mapped);
  const data = await res.json().catch(() => ({} as any));
  console.log(`   server → imported=${data.imported}  skipped=${data.skipped}`);
  const t13Ok = data.imported === 0 && data.skipped === firstFixture.expectImported;
  results.push({ test: "T13 re-import dedup", pass: t13Ok, detail: `imported=${data.imported} (want 0)  skipped=${data.skipped} (want ${firstFixture.expectImported})` });
  console.log(`   ${t13Ok ? "✓ PASS" : "✗ FAIL"}`);

  // ── summary ────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  const passed = results.filter((r) => r.pass).length;
  console.log(`Total: ${results.length}  Passed: ${passed}  Failed: ${results.length - passed}`);
  if (results.length - passed > 0) {
    console.log("\nFailures:");
    for (const r of results) if (!r.pass) console.log(`  ✗ ${r.test}: ${r.detail}`);
  }

  // ── cleanup ────────────────────────────────────────────────────
  console.log("\nCleanup — deleting created test customers…");
  const list = await listCustomers(cookie);
  let deleted = 0;
  for (const c of list) {
    const e = (c.email || "").toLowerCase();
    const p = (c.phone || "").trim();
    if (createdEmails.has(e) || createdPhones.has(p)) {
      await deleteCustomer(cookie, c.id);
      deleted++;
    }
  }
  console.log(`✓ cleanup done — removed ${deleted} test customers`);

  if (results.some((r) => !r.pass)) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
