import { NextRequest, NextResponse } from "next/server";
import { runWelcomeSequenceTick } from "@/lib/welcome-emails";

// Hourly cron called by cron-job.org. Day 1 is sent after signup, Day 3
// selects the first incomplete setup action, and the final two messages
// are tied to the app-owned trial end (48h and 24h remaining).
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const welcomeSequence = await runWelcomeSequenceTick();
    return NextResponse.json({ welcomeSequence });
  } catch (err) {
    console.error("[cron/welcome-emails] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
