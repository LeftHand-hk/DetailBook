import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type StepId =
  | "packages"
  | "business_hours"
  | "booking_page"
  | "booking_link"
  | "deposit";

type ProgressJson = Partial<Record<StepId, boolean>>;

const STEP_ORDER: StepId[] = [
  "packages",
  "business_hours",
  "booking_page",
  "booking_link",
  "deposit",
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

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { _count: { select: { packages: true } } },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const progress = readProgress(user.onboardingProgress);

  const hasBusinessHours =
    user.businessHours !== null && user.businessHours !== undefined;
  const bookingPageCustomized =
    Boolean(user.logo) ||
    Boolean(user.bannerImage) ||
    Boolean(user.bookingPageTitle) ||
    Boolean(user.bio);

  // Sticky completion: once a derived step has ever been observed as done,
  // it stays done. Avoids the surprising case where editing a customised
  // booking page (e.g. clearing a field briefly during autosave) flips the
  // step back to "not finished".
  const stepDone = {
    packages: Boolean(progress.packages) || user._count.packages > 0,
    business_hours: Boolean(progress.business_hours) || hasBusinessHours,
    booking_page: Boolean(progress.booking_page) || bookingPageCustomized,
    booking_link: Boolean(progress.booking_link),
    deposit: Boolean(progress.deposit) || user.requireDeposit,
  };

  // Persist newly-observed completions so future GETs don't depend on the
  // derived state staying true. We only flip on; never off.
  const newlyDone: Partial<Record<StepId, boolean>> = {};
  if (!progress.packages && stepDone.packages) newlyDone.packages = true;
  if (!progress.business_hours && stepDone.business_hours) newlyDone.business_hours = true;
  if (!progress.booking_page && stepDone.booking_page) newlyDone.booking_page = true;
  if (!progress.deposit && stepDone.deposit) newlyDone.deposit = true;
  if (Object.keys(newlyDone).length) {
    await prisma.user.update({
      where: { id: session.id },
      data: { onboardingProgress: { ...progress, ...newlyDone } },
    });
  }

  const steps = [
    {
      id: "packages" as const,
      title: "Add your services",
      description: "Create at least one package customers can book.",
      cta: "Add a package",
      href: "/dashboard/packages",
      done: stepDone.packages,
    },
    {
      id: "business_hours" as const,
      title: "Set your business hours",
      description: "Tell customers when they can book appointments with you.",
      cta: "Set hours",
      href: "/dashboard/settings",
      done: stepDone.business_hours,
    },
    {
      id: "booking_page" as const,
      title: "Customize your booking page",
      description: "Add your logo, banner, and a short intro about your business.",
      cta: "Customize page",
      href: "/dashboard/booking-page",
      done: stepDone.booking_page,
    },
    {
      id: "booking_link" as const,
      title: "Share your booking link",
      description: "Copy your unique link and share it on Instagram, Google, or WhatsApp.",
      cta: "Get my link",
      href: "/dashboard/booking-page",
      done: stepDone.booking_link,
    },
    {
      id: "deposit" as const,
      title: "Configure deposits",
      description: "Reduce no-shows by requiring a deposit at the time of booking.",
      cta: "Set up deposits",
      href: "/dashboard/payments",
      done: stepDone.deposit,
    },
  ];

  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / total) * 100);

  // Auto-stamp completion the first time we observe 100%, so the floating
  // button can hide forever (no need for a separate "I'm done" action).
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
