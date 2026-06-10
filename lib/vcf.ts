export type VcfContact = { firstName: string; lastName: string; email: string; phone: string };

// Parse a phone-contacts export (.vcf / vCard 2.1, 3.0 or 4.0; one or many
// cards). Pulls the first email + phone per card and splits the name from
// N: (Family;Given;…) or, failing that, the formatted FN: line.
export function parseVcf(text: string): VcfContact[] {
  // Unfold: a line starting with space/tab is a continuation of the prior one.
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: VcfContact[] = [];
  let cur: (VcfContact & { fn: string }) | null = null;

  // vCard 2.1 may quoted-printable-encode non-ASCII values (e.g. accented names).
  const decode = (value: string, head: string) => {
    if (!/quoted-printable/i.test(head)) return value;
    const bytes = value.replace(/=\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    try { return decodeURIComponent(escape(bytes)); } catch { return bytes; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VCARD") { cur = { firstName: "", lastName: "", email: "", phone: "", fn: "" }; continue; }
    if (upper === "END:VCARD") {
      if (cur) {
        if (!cur.firstName && cur.fn) {
          const parts = cur.fn.trim().split(/\s+/);
          cur.firstName = parts[0] || "";
          if (!cur.lastName) cur.lastName = parts.slice(1).join(" ");
        }
        if (cur.firstName || cur.email || cur.phone) {
          out.push({ firstName: cur.firstName, lastName: cur.lastName, email: cur.email, phone: cur.phone });
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = decode(line.slice(colon + 1), head).trim();
    // Strip any group prefix ("item1.TEL") and parameters ("TEL;TYPE=CELL").
    const prop = head.split(";")[0].split(".").pop()!.toUpperCase();

    if (prop === "FN") cur.fn = value;
    else if (prop === "N") {
      const seg = value.split(";");
      cur.lastName = (seg[0] || "").trim();
      cur.firstName = (seg[1] || "").trim();
    } else if (prop === "EMAIL") { if (!cur.email) cur.email = value; }
    else if (prop === "TEL") { if (!cur.phone) cur.phone = value.replace(/^tel:/i, "").trim(); }
  }
  return out;
}
