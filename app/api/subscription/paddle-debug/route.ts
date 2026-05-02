import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Diagnostic endpoint. Visit /api/subscription/_paddle-debug while
// logged in to see exactly what's wrong with the Paddle config.
// Reveals key shape (masked), env, and a live auth probe to Paddle.

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = process.env.PADDLE_API_KEY || "";
  const trimmed = raw.replace(/^["']|["']$/g, "").trim();
  const env = process.env.NEXT_PUBLIC_PADDLE_ENV || "production";
  const base = env === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

  const keyShape = {
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hasLeadingWhitespace: raw !== raw.trimStart(),
    hasTrailingWhitespace: raw !== raw.trimEnd(),
    hasInternalWhitespace: /\s/.test(trimmed),
    hasQuotes: /^["']|["']$/.test(raw),
    prefix: trimmed.slice(0, 14),
    suffix: trimmed.slice(-4),
    looksLikePaddleKey: /^(pdl_|apikey_)/.test(trimmed),
  };

  // Live probe: GET /event-types is the cheapest authenticated endpoint
  let probe: any = { skipped: true };
  if (trimmed) {
    try {
      const r = await fetch(`${base}/event-types`, {
        headers: { Authorization: `Bearer ${trimmed}` },
        cache: "no-store",
      });
      const body = await r.text();
      probe = {
        status: r.status,
        ok: r.ok,
        bodyPreview: body.slice(0, 400),
      };
    } catch (e: any) {
      probe = { error: e?.message || String(e) };
    }
  }

  return NextResponse.json({
    env,
    apiBase: base,
    keyShape,
    probe,
    advice: probe.ok
      ? "Key works. Auth issue must be elsewhere."
      : keyShape.hasInternalWhitespace
        ? "Internal whitespace in key — re-paste it cleanly."
        : !keyShape.looksLikePaddleKey
          ? "Key doesn't start with pdl_ or apikey_ — wrong value."
          : "Auth probe failed. Check the bodyPreview for Paddle's exact error.",
  });
}
