import { NextRequest, NextResponse } from "next/server";
import { runWelcomeSequenceTick, runWinBackTick } from "@/lib/welcome-emails";

// Backward-compatible daily cron endpoint. The hourly welcome cron is the
// primary scheduler; this route runs the same atomic sequence as a backup.
// Sharing one sender and the same claimed timestamp columns prevents
// duplicate "2 days left" or "ends today" messages.
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const welcomeSequence = await runWelcomeSequenceTick();
    const winBack = await runWinBackTick();
    return NextResponse.json({ welcomeSequence, winBack });
  } catch (error) {
    console.error("[cron/trial-warnings] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
