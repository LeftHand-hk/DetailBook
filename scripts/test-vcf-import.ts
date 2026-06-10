import { parseVcf, type VcfContact } from "@/lib/vcf";

// Standalone test for the .vcf importer. Run: npx tsx scripts/test-vcf-import.ts
// Covers the real-world exports a detailer would drop in: iOS Contacts (3.0),
// older Android / Outlook (2.1 + quoted-printable), modern vCard 4.0, plus the
// awkward bits — folded lines, group prefixes, FN-only cards, CRLF, junk cards.

let passed = 0;
let failed = 0;

function check(label: string, got: VcfContact | undefined, want: Partial<VcfContact>) {
  const fields: (keyof VcfContact)[] = ["firstName", "lastName", "email", "phone"];
  const bad: string[] = [];
  for (const f of fields) {
    if (want[f] !== undefined && (got?.[f] ?? "") !== want[f]) {
      bad.push(`${f}: expected "${want[f]}", got "${got?.[f] ?? ""}"`);
    }
  }
  if (bad.length === 0) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
    bad.forEach((b) => console.log(`      ${b}`));
  }
}

function expect(label: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}`); }
}

// 1) iOS / macOS Contacts export (vCard 3.0), multiple cards in one file.
console.log("\nvCard 3.0 (iOS export, multi-card):");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Anderson;Mike;;;",
    "FN:Mike Anderson",
    "TEL;TYPE=CELL:+1 (555) 123-4567",
    "EMAIL;TYPE=INTERNET;TYPE=HOME:mike@example.com",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Johnson;Sarah;;;",
    "FN:Sarah Johnson",
    "TEL;TYPE=CELL:+15552345678",
    "EMAIL:sarah@example.com",
    "END:VCARD",
  ].join("\n");
  const c = parseVcf(vcf);
  expect("parses 2 cards", c.length === 2);
  check("card 1", c[0], { firstName: "Mike", lastName: "Anderson", phone: "+1 (555) 123-4567", email: "mike@example.com" });
  check("card 2", c[1], { firstName: "Sarah", lastName: "Johnson", phone: "+15552345678", email: "sarah@example.com" });
}

// 2) vCard 2.1 with quoted-printable accented name (older Android / Outlook).
console.log("\nvCard 2.1 (quoted-printable, accented):");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:2.1",
    "N;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:Zogiani;Ardit=C3=AB;;;",
    "FN;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:Ardit=C3=AB Zogiani",
    "TEL;CELL:+355 69 123 4567",
    "EMAIL;INTERNET:ardit@example.al",
    "END:VCARD",
  ].join("\n");
  const c = parseVcf(vcf);
  check("decodes accent", c[0], { firstName: "Arditë", lastName: "Zogiani", phone: "+355 69 123 4567", email: "ardit@example.al" });
}

// 3) vCard 4.0 with tel: URI form.
console.log("\nvCard 4.0 (tel: URI):");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    "N:Doe;Jane;;;",
    "FN:Jane Doe",
    "TEL;TYPE=\"cell\";VALUE=uri:tel:+15558889999",
    "EMAIL:jane@example.com",
    "END:VCARD",
  ].join("\n");
  const c = parseVcf(vcf);
  check("strips tel: prefix", c[0], { firstName: "Jane", lastName: "Doe", phone: "+15558889999", email: "jane@example.com" });
}

// 4) Apple group prefixes (item1.TEL / item2.EMAIL).
console.log("\nGroup prefixes (item1.TEL):");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Smith;Bob;;;",
    "FN:Bob Smith",
    "item1.TEL;type=pref:+15551112222",
    "item1.X-ABLabel:phone",
    "item2.EMAIL;type=INTERNET:bob@example.com",
    "END:VCARD",
  ].join("\n");
  const c = parseVcf(vcf);
  check("reads grouped props", c[0], { firstName: "Bob", lastName: "Smith", phone: "+15551112222", email: "bob@example.com" });
}

// 5) FN only (no N) — name must be split from the formatted name.
console.log("\nFN-only card (name split):");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Maria Van Der Berg",
    "TEL:5550001111",
    "END:VCARD",
  ].join("\n");
  const c = parseVcf(vcf);
  check("splits first + rest", c[0], { firstName: "Maria", lastName: "Van Der Berg", phone: "5550001111" });
}

// 6) Folded long line (continuation begins with a space) + CRLF endings.
console.log("\nLine folding + CRLF:");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Wellington-Montgomery;Christopher;;;",
    "FN:Christopher",
    " Wellington-Montgomery",
    "EMAIL:chris.very.long.address@somelongcompanydomain.example.com",
    "TEL:+15553334444",
    "END:VCARD",
  ].join("\r\n");
  const c = parseVcf(vcf);
  check("unfolds FN", c[0], { firstName: "Christopher", lastName: "Wellington-Montgomery", phone: "+15553334444", email: "chris.very.long.address@somelongcompanydomain.example.com" });
}

// 7) First phone/email wins when several are listed.
console.log("\nMultiple phones/emails (first wins):");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Lee;Pat;;;",
    "TEL;TYPE=CELL:+15550000001",
    "TEL;TYPE=WORK:+15550000002",
    "EMAIL;TYPE=HOME:pat.home@example.com",
    "EMAIL;TYPE=WORK:pat.work@example.com",
    "END:VCARD",
  ].join("\n");
  const c = parseVcf(vcf);
  check("takes first of each", c[0], { firstName: "Pat", phone: "+15550000001", email: "pat.home@example.com" });
}

// 8) Junk / empty cards are dropped, valid ones kept.
console.log("\nEmpty + malformed cards dropped:");
{
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "END:VCARD",                       // totally empty -> drop
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Only Name Here",
    "END:VCARD",                       // name only -> keep
    "garbage line outside any card",
    "BEGIN:VCARD",
    "VERSION:3.0",
    "TEL:+15559998888",
    "END:VCARD",                       // phone only -> keep
  ].join("\n");
  const c = parseVcf(vcf);
  expect("keeps only the 2 usable cards", c.length === 2);
  check("name-only kept", c[0], { firstName: "Only", lastName: "Name Here" });
  check("phone-only kept", c[1], { phone: "+15559998888" });
}

// 9) Empty input is safe.
console.log("\nEdge: empty / non-vcf input:");
{
  expect("empty string -> []", parseVcf("").length === 0);
  expect("random text -> []", parseVcf("hello world\nnot a vcard").length === 0);
}

console.log(`\n${"-".repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
