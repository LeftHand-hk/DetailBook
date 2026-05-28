import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

type StepId =
  | "business_info"
  | "working_hours"
  | "services"
  | "customize_page"
  | "share_link";

type ProgressJson = Partial<Record<StepId, boolean>>;

// Activation order — services BEFORE working_hours. The "create your
// first package" step is the one users actually need to see value
// from the product, so we put it second (right after the auto-
// completed business profile). Working hours is administrative and
// can wait. After working hours we nudge to customize the booking
// page (logo, banner, copy) so the link they share looks polished
// before they share it.
const STEP_ORDER: StepId[] = [
  "business_info",
  "services",
  "working_hours",
  "customize_page",
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

  // This endpoint is hit on every dashboard mount AND every window focus
  // (via SetupExperience). The old query selected the base64 logo +
  // bannerImage columns — multi-MB blobs — just to check existence, which
  // made the dashboard feel sluggish on every tab focus. We now pull only
  // cheap columns here and ask the DB for booleans on the heavy ones.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      onboardingProgress: true,
      onboardingCompletedAt: true,
      onboardingDismissed: true,
      businessHours: true,
      bookingPageTitle: true,
      bookingPageLayout: true,
      pageContent: true,
      bio: true,
      _count: { select: { packages: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Existence-only check on the heavy base64 columns. A raw query returns
  // two booleans instead of dragging multiple MB across the wire.
  const flagRows = await prisma.$queryRaw<Array<{ hasLogo: boolean; hasBanner: boolean }>>`
    SELECT (logo IS NOT NULL AND logo <> '') AS "hasLogo",
           ("bannerImage" IS NOT NULL AND "bannerImage" <> '') AS "hasBanner"
    FROM "User" WHERE id = ${session.id}`;
  const flags = flagRows[0] ?? { hasLogo: false, hasBanner: false };

  const progress = readProgress(user.onboardingProgress);

  const hasBusinessHours =
    user.businessHours !== null && user.businessHours !== undefined;

  // "Customize booking page" is satisfied as soon as the owner has
  // changed at least one visual field away from default: a logo or
  // banner upload, a custom page title, an intro/bio, switching the
  // design to "modern" (v2), or any inline edit saved into pageContent.
  // Any of these is a strong signal they've engaged with the editor.
  const hasLogo = flags.hasLogo;
  const hasBanner = flags.hasBanner;
  const hasCustomTitle = typeof user.bookingPageTitle === "string" && user.bookingPageTitle.trim().length > 0;
  const hasBio = typeof user.bio === "string" && user.bio.trim().length > 0;
  // bookingPageLayout defaults to "classic", so only a switch to "modern"
  // counts as an explicit customization.
  const switchedToModern = (user as any).bookingPageLayout === "modern";
  // Any non-empty pageContent object means they saved at least one inline
  // edit in the modern editor.
  const pc = (user as any).pageContent;
  const hasPageContent = pc && typeof pc === "object" && Object.keys(pc).length > 0;
  const hasCustomized = hasLogo || hasBanner || hasCustomTitle || hasBio || switchedToModern || hasPageContent;

  // Sticky completion: once observed done, persist so transient UI states
  // (clearing a field during autosave, etc.) don't flip a step back.
  const stepDone = {
    // Business Info is satisfied at signup — businessName is required by
    // the form. We treat it as auto-completed.
    business_info: true,
    working_hours: Boolean(progress.working_hours) || hasBusinessHours,
    services: Boolean(progress.services) || user._count.packages > 0,
    customize_page: Boolean(progress.customize_page) || hasCustomized,
    share_link: Boolean(progress.share_link),
  };

  // Persist newly-observed completions (only flip on, never off).
  const newlyDone: Partial<Record<StepId, boolean>> = {};
  if (!progress.working_hours && stepDone.working_hours) newlyDone.working_hours = true;
  if (!progress.services && stepDone.services) newlyDone.services = true;
  if (!progress.customize_page && stepDone.customize_page) newlyDone.customize_page = true;
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
      description: "Each package is a service customers can book.",
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
      id: "customize_page" as const,
      title: "Customize your booking page",
      description: "Add your logo, a hero photo, and a short intro so the page you share looks like your business.",
      estimate: "2 min",
      optional: false,
      done: stepDone.customize_page,
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
