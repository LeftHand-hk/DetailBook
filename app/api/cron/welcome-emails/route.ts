import { NextRequest, NextResponse } from "next/server";
import { runWelcomeSequenceTick } from "@/lib/welcome-emails";

// Hourly cron — called by cron-job.org. For every user signed up in the
// last 30 days, dispatches the next welcome email if one is due.
// Cadence: email 1 = Day 0, email 2 = Day 5, email 3 = Day 13.
// Skips users who paused (unsubscribed), are suspended/cancelled, or
// (for email 3) have already subscribed to a paid plan.
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWelcomeSequenceTick();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/welcome-emails] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
