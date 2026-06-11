// Reduce a phone number to a comparable form so the same number written in
// different styles all matches: "+1 (555) 123-4567", "555-123-4567",
// "1 555 123 4567" and "5551234567" every one normalises to "5551234567".
//
// We keep digits only, and for an 11-digit US number drop the leading "1"
// country code so it lines up with the 10-digit local form. The original,
// human-formatted phone is still what we store and display — this is used
// purely for matching a booking to a customer.
export function normalizePhone(raw: string | null | undefined): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}
