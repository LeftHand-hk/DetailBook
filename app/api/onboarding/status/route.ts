import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type StepId =
  | "business_info"
  | "working_hours"
  | "services"
  | "deposits"
  | "share_link";

type ProgressJson = Partial<Record<StepId, boolean>>;

// Activation order — services BEFORE working_hours. The "create your
// first package" step is the one users actually need to see value
// from the product, so we put it second (right after the auto-
// completed business profile). Working hours is administrative and
// can wait — burying it earlier in the flow was contributing to
// drop-off before users reached the package step.
const STEP_ORDER: StepId[] = [
  "business_info",
  "services",
  "working_hours",
  "deposits",
  "share_link",
];

function readProgress(raw: unknown): ProgressJson {
  if (!raw || typeof raw !== "object") return {};
  return raw as ProgressJson;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Onboarding only needs a few flags + package count. Skip the base64
  // image columns (logo/coverImage/bannerImage) entirely.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      onboardingProgress: true,
      onboardingCompletedAt: true,
      onboardingDismissed: true,
      businessHours: true,
      requireDeposit: true,
      _count: { select: { packages: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const progress = readProgress(user.onboardingProgress);

  const hasBusinessHours =
    user.businessHours !== null && user.businessHours !== undefined;

  // Sticky completion: once observed done, persist so transient UI states
  // (clearing a field during autosave, etc.) don't flip a step back.
  const stepDone = {
    // Business Info is satisfied at signup — businessName is required by
    // the form. We treat it as auto-completed.
    business_info: true,
    working_hours: Boolean(progress.working_hours) || hasBusinessHours,
    services: Boolean(progress.services) || user._count.packages > 0,
    // Deposits is optional: counts as done if the user explicitly
    // configured (toggled on or off via the panel) OR enabled it.
    deposits: Boolean(progress.deposits) || user.requireDeposit,
    share_link: Boolean(progress.share_link),
  };

  // Persist newly-observed completions (only flip on, never off).
  const newlyDone: Partial<Record<StepId, boolean>> = {};
  if (!progress.working_hours && stepDone.working_hours) newlyDone.working_hours = true;
  if (!progress.services && stepDone.services) newlyDone.services = true;
  if (!progress.deposits && stepDone.deposits) newlyDone.deposits = true;
  if (Object.keys(newlyDone).length) {
    await prisma.user.update({
      where: { id: session.id },
      data: { onboardingProgress: { ...progress, ...newlyDone } },
    });
  }

  const steps = [
    {
      id: "business_info" as const,
      title: "Your business profile",
      description: "Saved at signup — your name, email and contact info show on your booking page.",
      estimate: null,
      optional: false,
      done: stepDone.business_info,
    },
    {
      id: "services" as const,
      title: "Add your first service package",
      description: "Each package is a service customers can book — name, price, how long it takes. You need at least one before your link is usable.",
      estimate: "2 min",
      optional: false,
      done: stepDone.services,
    },
    {
      id: "working_hours" as const,
      title: "Set your working hours",
      description: "The days and time slots customers can book. Bookings outside these hours are blocked automatically.",
      estimate: "1 min",
      optional: false,
      done: stepDone.working_hours,
    },
    {
      id: "deposits" as const,
      title: "Turn on deposits (recommended)",
      description: "Require customers to pay part of the price upfront when they book. Cuts no-shows in half.",
      estimate: "1 min",
      optional: true,
      done: stepDone.deposits,
    },
    {
      id: "share_link" as const,
      title: "Share your booking link",
      description: "Copy your unique link and post it on Instagram, Google, or wherever you get customers.",
      estimate: "1 min",
      optional: false,
      done: stepDone.share_link,
    },
  ];

  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / total) * 100);
  const remainingMin = steps
    .filter((s) => !s.done && s.estimate)
    .reduce((acc, s) => acc + parseInt(s.estimate || "0", 10), 0);

  // Auto-stamp completion the first time we observe 100%.
  let completedAt = user.onboardingCompletedAt;
  if (percent === 100 && !completedAt) {
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { onboardingCompletedAt: new Date() },
      select: { onboardingCompletedAt: true },
    });
    completedAt = updated.onboardingCompletedAt;
  }

  return NextResponse.json({
    steps,
    completed,
    total,
    percent,
    remainingMin,
    dismissed: user.onboardingDismissed,
    completedAt,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dismissed?: boolean;
    markStep?: StepId;
    unmarkStep?: StepId;
    reset?: boolean;
  };

  const data: Record<string, unknown> = {};

  if (typeof body.dismissed === "boolean") {
    data.onboardingDismissed = body.dismissed;
  }

  if (body.markStep || body.unmarkStep) {
    const current = await prisma.user.findUnique({
      where: { id: session.id },
      select: { onboardingProgress: true },
    });
    const progress = readProgress(current?.onboardingProgress);
    if (body.markStep && STEP_ORDER.includes(body.markStep)) {
      progress[body.markStep] = true;
    }
    if (body.unmarkStep && STEP_ORDER.includes(body.unmarkStep)) {
      progress[body.unmarkStep] = false;
    }
    data.onboardingProgress = progress;
  }

  if (body.reset) {
    data.onboardingDismissed = false;
    data.onboardingCompletedAt = null;
  }

  await prisma.user.update({ where: { id: session.id }, data });

  return NextResponse.json({ ok: true });
}
