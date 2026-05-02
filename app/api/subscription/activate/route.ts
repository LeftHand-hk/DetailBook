import { NextResponse } from "next/server";

// Subscription activation is now handled exclusively by the verified
// Paddle webhook at /api/webhooks/paddle (subscription.created /
// subscription.activated events). Client-trusted activation is unsafe
// because it lets a logged-in user flip their own plan to "active"
// without ever paying.
export async function POST() {
  return NextResponse.json(
    { error: "Activation is handled automatically after payment." },
    { status: 410 }
  );
}
