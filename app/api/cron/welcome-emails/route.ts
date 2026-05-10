import { NextRequest, NextResponse } from "next/server";
import { runWelcomeSequenceTick } from "@/lib/welcome-emails";

// Hourly cron — called by cron-job.org. For every user signed up in the
// last 30 days, dispatches the next welcome email if one is due.
// Cadence: Day 0 (welcome), Day 2 (engagement, only if no packages),
// Day 5 (share link), Day 13 (trial ending). Skips users who paused,
// are suspended/cancelled, or (for Day 13) have upgraded to a paid plan.
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
