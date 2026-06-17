// Trial phase + countdown helpers.
//
// Our own database is the single source of truth for trial status —
// Paddle has NO trial; it's only the payment processor at conversion.
// These are PURE functions with no server-only imports (no next/headers,
// no jsonwebtoken) so they are safe to use from client components like the
// dashboard layout. The logic mirrors `isTrialExpired` in lib/auth.ts,
// which the public booking API uses to gate a paused page.

export type TrialPhase = "paid" | "trial_active" | "paused";

type TrialUser =
  | {
      subscriptionStatus?: string | null;
      trialEndsAt?: string | null;
      suspended?: boolean;
    }
  | null
  | undefined;

// Whole days left in the trial (rounded up), never negative. Returns null
// when there's no trial end date (e.g. a paid account has it cleared).
export function trialDaysLeft(user: TrialUser): number | null {
  if (!user?.trialEndsAt) return null;
  const diff = new Date(user.trialEndsAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function trialExpired(user: TrialUser): boolean {
  if (!user) return false;
  if (user.subscriptionStatus === "active") return false; // paid
  if (!user.trialEndsAt) return false;
  const ends = new Date(user.trialEndsAt).getTime();
  if (Number.isNaN(ends)) return false;
  return ends < Date.now();
}

// Derived phase. "paid" == subscriptionStatus "active" (set by the Paddle
// webhook on payment). "paused" == trial window has passed without paying.
// Everything else is an active trial.
export function getTrialPhase(user: TrialUser): TrialPhase {
  if (!user) return "trial_active";
  if (user.subscriptionStatus === "active") return "paid";
  if (trialExpired(user)) return "paused";
  return "trial_active";
}
