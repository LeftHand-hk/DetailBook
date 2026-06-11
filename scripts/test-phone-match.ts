import { normalizePhone } from "@/lib/phone";

// Verifies phone matching is format-insensitive. Run:
//   npx tsx scripts/test-phone-match.ts

let passed = 0;
let failed = 0;

function same(label: string, a: string, b: string) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na === nb && na !== "") { passed++; console.log(`  ✓ ${label}  ("${a}" ≡ "${b}" -> ${na})`); }
  else { failed++; console.log(`  ✗ ${label}  ("${a}"->${na}) != ("${b}"->${nb})`); }
}

function differ(label: string, a: string, b: string) {
  if (normalizePhone(a) !== normalizePhone(b)) { passed++; console.log(`  ✓ ${label}  ("${a}" ≠ "${b}")`); }
  else { failed++; console.log(`  ✗ ${label}  both normalised to ${normalizePhone(a)}`); }
}

console.log("\nSame number, different formats — should match:");
same("dashes vs plain", "555-123-4567", "5551234567");
same("parens + spaces", "(555) 123 4567", "5551234567");
same("US +1 country code", "+1 555-123-4567", "5551234567");
same("leading 1, no plus", "1 (555) 123-4567", "555.123.4567");
same("dots vs dashes", "555.123.4567", "555-123-4567");
same("tel: leftovers stripped to digits", "+1-555-123-4567", "15551234567");
same("intl Albania kept as-is", "+355 69 123 4567", "355 69 123 4567");

console.log("\nDifferent numbers — should NOT match:");
differ("last digit differs", "555-123-4567", "555-123-4568");
differ("area code differs", "(444) 123-4567", "(555) 123-4567");

console.log("\nEdge cases:");
{
  const cases: [string, string][] = [
    ["", ""],
    ["   ", ""],
    ["abc", ""],
    ["+1", "1"],
  ];
  for (const [input, want] of cases) {
    const got = normalizePhone(input);
    if (got === want) { passed++; console.log(`  ✓ "${input}" -> "${got}"`); }
    else { failed++; console.log(`  ✗ "${input}" -> "${got}" (expected "${want}")`); }
  }
  // null / undefined must not throw
  try { normalizePhone(null); normalizePhone(undefined); passed++; console.log("  ✓ null/undefined safe"); }
  catch { failed++; console.log("  ✗ null/undefined threw"); }
}

console.log(`\n${"-".repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
