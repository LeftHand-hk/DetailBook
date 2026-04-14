import SiteLayout from "@/components/SiteLayout";
import Link from "next/link";

type ChangeType = "new" | "improved" | "fixed";

interface Change {
  type: ChangeType;
  text: string;
}

interface Version {
  version: string;
  date: string;
  label: string;
  changes: Change[];
}

const versions: Version[] = [
  {
    version: "v1.3",
    date: "March 2026",
    label: "latest",
    changes: [
      { type: "new", text: "Business hours display on booking page — customers can now see your operating hours before booking" },
      { type: "new", text: "Service area chips on booking page — visually show the neighborhoods and cities you serve" },
      { type: "new", text: "Social media links on booking page — add Instagram, Facebook, and TikTok links to your profile" },
      { type: "improved", text: "Booking page load time reduced by 40% through server-side rendering improvements" },
      { type: "improved", text: "Mobile booking flow redesigned for faster checkout on smartphones" },
      { type: "improved", text: "Dashboard calendar view now supports week and month toggle" },
      { type: "fixed", text: "Fixed an issue where deposits were not being correctly applied to Stripe payouts in some timezones" },
      { type: "fixed", text: "Fixed SMS reminder not sending for appointments booked within 2 hours of reminder time" },
    ],
  },
  {
    version: "v1.2",
    date: "February 2026",
    label: "",
    changes: [
      { type: "new", text: "Before & after photo sharing — attach photos to completed appointments and share with customers" },
      { type: "new", text: "Review request automation — automatically send a Google review request link after each appointment" },
      { type: "new", text: "Route map view — see all your appointments for the day plotted on a map to plan your route" },
      { type: "improved", text: "Customer profile page now shows full appointment history and total spend" },
      { type: "improved", text: "Deposit collection now supports Apple Pay and Google Pay" },
      { type: "improved", text: "Email confirmation templates updated with improved layout and branding" },
      { type: "fixed", text: "Fixed recurring booking not respecting closed dates on the availability calendar" },
      { type: "fixed", text: "Fixed package description text overflowing on mobile booking page" },
      { type: "fixed", text: "Fixed Google Calendar sync occasionally creating duplicate events" },
    ],
  },
  {
    version: "v1.1",
    date: "January 2026",
    label: "",
    changes: [
      { type: "new", text: "Google Calendar sync (Pro) — two-way sync keeps your DetailBook and Google Calendar in perfect alignment" },
      { type: "new", text: "Recurring bookings — allow regular customers to set up weekly or monthly appointments" },
      { type: "new", text: "Basic analytics dashboard — view total bookings, revenue, and no-show rate over time" },
      { type: "improved", text: "Settings page redesigned with improved navigation and section organization" },
      { type: "improved", text: "Availability calendar now supports setting different hours per day of the week" },
      { type: "improved", text: "Stripe Connect onboarding flow simplified — now takes under 5 minutes to complete" },
      { type: "fixed", text: "Fixed edge case where booking confirmation email was sent twice for some time zones" },
      { type: "fixed", text: "Fixed package price not updating when vehicle type was changed on the booking form" },
    ],
  },
  {
    version: "v1.0",
    date: "December 2025",
    label: "initial release",
    changes: [
      { type: "new", text: "Public booking page — your own branded page at detailbook.app/book/[your-handle]" },
      { type: "new", text: "Service package builder — create named packages with descriptions, prices, and duration" },
      { type: "new", text: "Deposit collection — require a deposit at booking with Stripe-powered checkout" },
      { type: "new", text: "Appointment calendar — view and manage all bookings from a clean dashboard" },
      { type: "new", text: "SMS reminders — automated 2-hour appointment reminders to reduce no-shows" },
      { type: "new", text: "Customer management — view customer history and contact details" },
      { type: "new", text: "Availability settings — set your working hours and block off time" },
      { type: "new", text: "30-day free trial — no credit card required to get started" },
    ],
  },
];

const typeConfig: Record<ChangeType, { label: string; color: string; dot: string; icon: string }> = {
  new:      { label: "New",      color: "text-green-400 bg-green-500/10 border-green-500/25", dot: "bg-green-400", icon: "+" },
  improved: { label: "Improved", color: "text-blue-400 bg-blue-500/10 border-blue-500/25",   dot: "bg-blue-400",  icon: "↑" },
  fixed:    { label: "Fixed",    color: "text-red-400 bg-red-500/10 border-red-500/25",       dot: "bg-red-400",   icon: "✓" },
};

export default function ChangelogPage() {
  return (
    <SiteLayout>
      {/* ── Hero ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[#080c18]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-blobFloat" />
          <div className="absolute bottom-[-5%] right-[-10%] w-[40%] h-[40%] bg-indigo-700/15 rounded-full blur-[100px] animate-blobFloat delay-400" />
        </div>
        <div className="absolute inset-0 overflow-hidden opacity-[0.05] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6 animate-fadeInUp">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            CHANGELOG
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight mb-5 animate-fadeInUp delay-100">
            What&apos;s New in{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              DetailBook
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto animate-fadeInUp delay-200">
            We ship improvements every week. Here&apos;s a record of everything we&apos;ve built.
          </p>
        </div>
      </section>

      {/* ── Legend ── */}
      <section className="py-4 bg-slate-900/60 border-y border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
            {(["new", "improved", "fixed"] as ChangeType[]).map((type) => (
              <div key={type} className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${typeConfig[type].color}`}>
                  {typeConfig[type].icon} {typeConfig[type].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-0 sm:left-[120px] top-0 bottom-0 w-px bg-white/10 hidden sm:block" />

            <div className="space-y-12">
              {versions.map((ver, vi) => (
                <div key={ver.version} className="relative sm:flex gap-8 animate-fadeInUp" style={{ animationDelay: `${vi * 0.1}s` }}>
                  {/* Version label */}
                  <div className="sm:w-[120px] shrink-0 sm:text-right mb-4 sm:mb-0 sm:pt-1">
                    <div className="inline-flex sm:flex sm:flex-col sm:items-end gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border ${
                        ver.label === "latest"
                          ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                          : ver.label === "initial release"
                          ? "bg-slate-700/60 text-gray-400 border-white/10"
                          : "bg-slate-800/80 text-white border-white/15"
                      }`}>
                        {ver.version}
                        {ver.label === "latest" && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{ver.date}</span>
                      {ver.label && ver.label !== "latest" && (
                        <span className="text-xs text-gray-600 italic">{ver.label}</span>
                      )}
                    </div>
                  </div>

                  {/* Timeline dot */}
                  <div className="absolute left-[118px] top-2 w-3 h-3 rounded-full bg-slate-900 border-2 border-blue-500/50 hidden sm:block z-10" />

                  {/* Changes */}
                  <div className="flex-1 sm:pl-6">
                    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
                      <ul className="space-y-3">
                        {ver.changes.map((change, ci) => {
                          const cfg = typeConfig[change.type];
                          return (
                            <li key={ci} className="flex items-start gap-3">
                              <span className={`inline-flex items-center shrink-0 text-xs font-bold px-2 py-0.5 rounded-md border mt-0.5 ${cfg.color}`}>
                                {cfg.icon}
                              </span>
                              <span className="text-gray-300 text-sm leading-relaxed">{change.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-black text-white mb-3">Have a feature request?</h2>
          <p className="text-gray-400 mb-6">
            We build DetailBook based on what detailers actually need. Tell us what would make your business run better.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25"
            >
              Send a Feature Request
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold px-7 py-3.5 rounded-xl transition-all duration-200"
            >
              Try DetailBook Free
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
