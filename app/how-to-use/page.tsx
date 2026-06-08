import Link from "next/link";

// Visitor-facing walkthrough at /how-to-use. Designed as a single long
// scroll so it can be printed/PDFed straight from the browser. Every step
// has a phone-shaped placeholder card with an instruction for which
// screenshot to drop in — the owner uploads them post-publish.

export const metadata = {
  title: "How to use DetailBook — Step-by-step guide",
  description: "Everything you need to run your detailing business on DetailBook, from sign-up to your first booking and beyond.",
};

function Step({
  n, title, children, screenshot, badge,
}: {
  n: string | number;
  title: string;
  children: React.ReactNode;
  screenshot: string;
  badge?: "Starter" | "Pro";
}) {
  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-6 md:gap-10 items-start mb-12">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center">
            {n}
          </span>
          <h3 className="text-xl font-extrabold text-gray-900">{title}</h3>
          {badge && (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${badge === "Pro" ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-gray-600 leading-relaxed space-y-3">
          {children}
        </div>
      </div>
      <Phone caption={screenshot} />
    </div>
  );
}

function Phone({ caption }: { caption: string }) {
  return (
    <div className="mx-auto md:mx-0 w-full max-w-[260px]">
      <div className="aspect-[9/19] bg-gray-50 border-2 border-dashed border-gray-300 rounded-[2.5rem] flex flex-col items-center justify-center p-5 text-center">
        <span className="text-2xl mb-2">📱</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Screenshot</span>
        <span className="text-xs text-gray-500 leading-snug">{caption}</span>
      </div>
    </div>
  );
}

function SectionHeader({ id, kicker, title, intro }: { id: string; kicker: string; title: string; intro: string }) {
  return (
    <div id={id} className="scroll-mt-24 mt-16 mb-10 pt-10 border-t border-gray-100 first:border-t-0 first:pt-0 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-2">{kicker}</p>
      <h2 className="text-3xl font-extrabold text-gray-900 mb-3">{title}</h2>
      <p className="text-gray-600 leading-relaxed max-w-2xl">{intro}</p>
    </div>
  );
}

const TOC = [
  { id: "first-five", label: "Part 1 — Your first 5 minutes" },
  { id: "make-it-yours", label: "Part 2 — Make it yours" },
  { id: "run-bookings", label: "Part 3 — Run your bookings" },
  { id: "your-page", label: "Part 4 — Your booking page" },
  { id: "payments", label: "Part 5 — Payments & deposits" },
  { id: "pro", label: "Part 6 — Pro features ⭐" },
  { id: "settings", label: "Part 7 — Settings & support" },
];

export default function HowToUsePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold text-gray-900 hover:text-blue-600 transition-colors">
            ← DetailBook
          </Link>
          <Link href="/signup" className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
            Start free trial
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 pt-12 pb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-3">How to use DetailBook</p>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight mb-5">
          From sign-up to your first booking — and everything after.
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
          This is the only guide you need. Every feature in Starter and Pro, in the order you&rsquo;ll actually use them.
          Built for phones — the same place most of your bookings come from.
        </p>

        {/* Legend */}
        <div className="mt-7 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Starter — included for everyone
          </span>
          <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 font-bold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pro — $50/month upgrade
          </span>
        </div>

        {/* TOC */}
        <nav className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">What&rsquo;s in this guide</p>
          <ol className="space-y-1.5">
            {TOC.map((t, i) => (
              <li key={t.id} className="text-sm">
                <a href={`#${t.id}`} className="text-gray-700 hover:text-blue-600 font-semibold transition-colors">
                  {i + 1}. {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </section>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 pb-24">
        {/* ───────────────────────── PART 1 ───────────────────────── */}
        <SectionHeader
          id="first-five"
          kicker="Part 1"
          title="Your first 5 minutes"
          intro="Everything between hitting 'Start free trial' and seeing your live booking link. The 7-day trial starts the moment you save your card, and you won't be charged a cent during it."
        />

        <Step n="1" title="Create your account" badge="Starter" screenshot="The Sign up page filled in (email, business name, password) and the Create account button.">
          <p>
            Open <Link href="/signup" className="text-blue-600 font-semibold underline">detailbookapp.com/signup</Link>. Enter your business name,
            your email, and a password. Hit <strong>Create account</strong>.
          </p>
          <p className="text-sm text-gray-500">You&rsquo;ll land on the onboarding flow right after.</p>
        </Step>

        <Step n="2" title="Add your business details" badge="Starter" screenshot="Step 1 of onboarding — business details form (phone, address, service type).">
          <p>
            Pick your operation type — <strong>Mobile</strong>, <strong>Shop</strong>, or <strong>Both</strong>.
            Fill in your phone, address (or service area for mobile), and city. These show on your public booking page.
          </p>
          <p className="text-sm text-gray-500">Don&rsquo;t worry about getting them perfect — you can edit any field later from Settings.</p>
        </Step>

        <Step n="3" title="Save your card to start the 7-day trial" badge="Starter" screenshot="The Add card step — Paddle checkout overlay with the card form open.">
          <p>
            We ask for a card up front so your subscription kicks in seamlessly on day 8. <strong>No charge happens during the trial.</strong>
            You can cancel any time from Settings → Billing before then.
          </p>
          <p className="text-sm text-gray-500">Only cards are accepted — Apple Pay and Google Pay can&rsquo;t save a payment method for a delayed first charge.</p>
        </Step>

        <Step n="4" title="Add your first service package" badge="Starter" screenshot="The 'One last step' screen with the Create Your First Package button.">
          <p>
            On the final onboarding screen, hit <strong>Create Your First Package</strong>. The form opens
            pre-filled with 3 typical detailing packages — Exterior Wash & Wax, Interior Detail, Full Detail.
            Edit the names and prices to match what you actually sell.
          </p>
          <p className="text-sm text-gray-500">Save at least one — your booking link only goes live after that.</p>
        </Step>

        <Step n="5" title="Share your booking link" badge="Starter" screenshot="The dashboard home with the booking-link card highlighted.">
          <p>
            Top of the dashboard you&rsquo;ll see your unique link, something like <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">detailbookapp.com/book/your-name</code>.
            Tap <strong>Copy</strong> and paste it anywhere — Instagram bio, Facebook, WhatsApp business profile, the &ldquo;Book Now&rdquo; button on your site, or a customer DM.
          </p>
        </Step>

        {/* ───────────────────────── PART 2 ───────────────────────── */}
        <SectionHeader
          id="make-it-yours"
          kicker="Part 2"
          title="Make it yours"
          intro="Polish before you push it out wide. Every minute you put in here makes the page look more professional to first-time customers."
        />

        <Step n="6" title="Customize your booking page" badge="Starter" screenshot="Booking Page picker (Modern vs Classic) — Modern selected.">
          <p>
            Dashboard → <strong>Booking Page</strong>. You can choose between the <strong>Modern</strong> (full website-style page, default) and <strong>Classic</strong> (a focused step-by-step booking flow).
            New accounts ship on Modern.
          </p>
          <p className="text-sm text-gray-500">Click <strong>Edit this page</strong> on whichever you&rsquo;re using to enter the visual editor.</p>
        </Step>

        <Step n="7" title="Edit text and photos inline (Modern)" badge="Starter" screenshot="The booking-page editor — any text or image being edited inline.">
          <p>
            In the Modern editor, click any text to type over it — hero, About, captions, the lot. Click a photo to replace it.
            Pick a brand color from the toolbar; it applies to all the CTA buttons. Hit <strong>Save</strong> when done.
          </p>
          <p className="text-sm text-gray-500">If you don&rsquo;t upload a banner photo, a polished default car visual is shown automatically — you&rsquo;re never empty.</p>
        </Step>

        <Step n="8" title="Add add-ons to packages" badge="Starter" screenshot="A package card with the Add-ons button + the modal opened on the add-on row.">
          <p>
            Dashboard → <strong>Packages</strong>. On any package card, tap <strong>Add-ons</strong>. The editor opens straight on the add-ons section.
            Add things like <em>&ldquo;Pet hair removal +$15&rdquo;</em> or <em>&ldquo;Engine bay clean +$25&rdquo;</em>. Customers can tick them at booking time.
          </p>
        </Step>

        <Step n="9" title="Set your working hours" badge="Starter" screenshot="Settings → Working hours — toggles and time pickers for each weekday.">
          <p>
            Dashboard → <strong>Settings</strong>. Set the days and times you take bookings. Customers can&rsquo;t pick slots outside these hours.
            Easy to mark a day off — toggle the day closed.
          </p>
        </Step>

        {/* ───────────────────────── PART 3 ───────────────────────── */}
        <SectionHeader
          id="run-bookings"
          kicker="Part 3"
          title="Run your bookings"
          intro="The bookings page is the heart of your day. List, calendar, manual entries, photos, and status changes all live here."
        />

        <Step n="10" title="The Bookings page" badge="Starter" screenshot="The Bookings list with filters (All / Upcoming / Pending / Completed) and revenue badges.">
          <p>
            See every booking with filters by status and date range. Top badges show your total earned, deposits collected, and any awaiting deposit.
            Tap any row for the detail drawer — change status, add notes, contact customer, or delete.
          </p>
        </Step>

        <Step n="11" title="Add a booking manually" badge="Starter" screenshot="The Add booking modal — customer, vehicle, service, price, date, time.">
          <p>
            Top right of the Bookings page → <strong>Add booking</strong>. Useful for phone calls, walk-ins, or anything you don&rsquo;t want a customer to book online.
            Fill in name, email, vehicle, service, price, date, and time. Hit <strong>Add booking</strong>.
          </p>
          <p className="text-sm text-gray-500">No emails are sent for manually added bookings — the customer won&rsquo;t get a surprise notification.</p>
        </Step>

        <Step n="12" title="Confirm / complete / cancel" badge="Starter" screenshot="The booking detail drawer with the status buttons (Pending / Confirmed / Completed / Cancelled).">
          <p>
            Tap a booking to open the detail drawer. Use the status buttons at the bottom: <strong>Confirmed</strong>, <strong>Completed</strong>, <strong>Cancelled</strong>.
            Each status change auto-emails the customer (unless you turned that off in Settings).
          </p>
        </Step>

        <Step n="13" title="Upload before/after photos" badge="Starter" screenshot="The booking detail drawer with the photo upload section open.">
          <p>
            Inside the booking detail, scroll to <strong>Before / After photos</strong>. Upload both — they double as proof for the customer and content for your gallery.
            You can later show them on your booking page.
          </p>
        </Step>

        <Step n="14" title="Calendar view" badge="Starter" screenshot="Dashboard → Calendar with week view and bookings on day cells.">
          <p>
            Dashboard → <strong>Calendar</strong>. Visual layout of every confirmed/pending booking. Switch between day / week / month. Tap any booking to jump into the detail drawer.
          </p>
        </Step>

        {/* ───────────────────────── PART 4 ───────────────────────── */}
        <SectionHeader
          id="your-page"
          kicker="Part 4"
          title="Your booking page (customer side)"
          intro="What your customers see when they tap your link. Built to look finished from day one — sections you haven't filled in just stay hidden."
        />

        <Step n="15" title="The Modern page" badge="Starter" screenshot="The public /book/your-name page on a phone — hero + services.">
          <p>
            Big banner photo, your business name + location, &ldquo;Book Now&rdquo; CTA, then your services as tap-to-book cards.
            On mobile each section adapts so the page reads cleanly.
          </p>
          <p className="text-sm text-gray-500">Sections like About / Gallery / Reviews only show if you&rsquo;ve added real data — no empty panels.</p>
        </Step>

        <Step n="16" title="Photo gallery" badge="Starter" screenshot="The Gallery editor in the booking-page editor — adding photos.">
          <p>
            In the editor, scroll down to the <strong>Gallery</strong> section. Add your best before/after shots. Re-order with drag.
            The customer-facing section is hidden until you add at least one photo.
          </p>
        </Step>

        <Step n="17" title="Customer reviews" badge="Starter" screenshot="The Reviews editor with sample review cards being added.">
          <p>
            Same idea — scroll to <strong>Reviews</strong> in the editor. Add customer names, rating (1-5 stars), text, and date.
            The section only shows on your live page once you&rsquo;ve added at least one.
          </p>
        </Step>

        {/* ───────────────────────── PART 5 ───────────────────────── */}
        <SectionHeader
          id="payments"
          kicker="Part 5"
          title="Payments & deposits"
          intro="Money straight to your account. We never take a cut of bookings or deposits — only the standard processor fees apply."
        />

        <Step n="18" title="Turn on deposits" badge="Starter" screenshot="Settings → Payments — the Require deposit toggle and percentage field.">
          <p>
            Settings → <strong>Payments</strong>. Toggle <strong>Require deposit</strong> and pick the percentage of the package price (e.g. 20%).
            Customers see this at booking and pay it before the slot is held.
          </p>
        </Step>

        <Step n="19" title="Connect a payment method" badge="Starter" screenshot="Settings → Payment methods — Stripe / Square / PayPal / Cash App / Bank Transfer cards.">
          <p>
            Supported methods: <strong>Stripe</strong>, <strong>Square</strong>, <strong>PayPal</strong>, <strong>Cash App</strong>, <strong>Bank Transfer</strong>, and <strong>Pay cash on arrival</strong>.
            Turn on whichever you use, paste your processor keys (Stripe / Square) or details. Customers pick from your enabled options at checkout.
          </p>
          <p className="text-sm text-gray-500">Card payments go to your own Stripe/Square account — DetailBook never touches the money.</p>
        </Step>

        <Step n="20" title="Manage your subscription" badge="Starter" screenshot="Settings → Billing showing the active plan, next charge date, and the change/cancel buttons.">
          <p>
            Settings → <strong>Billing</strong>. See your current plan (Starter / Pro), the next billing date, and the card on file. Upgrade to Pro, change the card, or cancel here.
            <strong> Cancel any time</strong> — your data stays.
          </p>
        </Step>

        {/* ───────────────────────── PART 6 — PRO ───────────────────────── */}
        <SectionHeader
          id="pro"
          kicker="Part 6"
          title="Pro features ⭐"
          intro="$50/month upgrade. Everything below requires the Pro plan. Switch any time from Settings → Billing."
        />

        <Step n="21" title="SMS reminders" badge="Pro" screenshot="A customer's phone showing the SMS booking reminder.">
          <p>
            Customers get an SMS confirmation when they book and a reminder the day before their appointment.
            <strong> Cuts no-shows hard.</strong> Pro plan only.
          </p>
        </Step>

        <Step n="22" title="Multiple staff & calendars" badge="Pro" screenshot="Dashboard → Staff page with multiple staff cards.">
          <p>
            Dashboard → <strong>Staff</strong>. Add team members, each with their own login and calendar. Customers can pick which detailer at booking.
            Each staff member sees only their own bookings on their dashboard.
          </p>
        </Step>

        <Step n="23" title="Google Calendar sync" badge="Pro" screenshot="Settings → Integrations with Google Calendar connected.">
          <p>
            Settings → <strong>Integrations</strong>. Connect Google. Every confirmed booking auto-creates a calendar event, with the customer details in the description.
            Cancel a booking → event deleted.
          </p>
        </Step>

        <Step n="24" title="Analytics dashboard" badge="Pro" screenshot="Dashboard home with charts — revenue this month, booking trends, top services.">
          <p>
            Daily / weekly / monthly revenue, booking trends, your most-booked services, and customer repeat rate. Use it to spot which packages to push and which days to staff up.
          </p>
        </Step>

        {/* ───────────────────────── PART 7 ───────────────────────── */}
        <SectionHeader
          id="settings"
          kicker="Part 7"
          title="Settings & support"
          intro="Tweaks and safety nets. Everything you can change later without breaking anything."
        />

        <Step n="25" title="Business profile" badge="Starter" screenshot="Settings → Business Profile showing the editable fields.">
          <p>
            Update phone, address, social links, service areas, years in business, bio — anything that shows on your booking page.
            Settings → <strong>Business Profile</strong>. Changes save instantly.
          </p>
        </Step>

        <Step n="26" title="Email & SMS templates" badge="Starter" screenshot="Settings → Templates with the booking confirmation editable.">
          <p>
            Customize the wording of the confirmation and reminder messages. Variables like <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{customerName}`}</code>, <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{date}`}</code>, <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{`{businessName}`}</code> get filled in automatically.
          </p>
        </Step>

        <Step n="27" title="Need help? Open a support ticket" badge="Starter" screenshot="Dashboard → Support — the New ticket form.">
          <p>
            Dashboard → <strong>Support</strong>. Open a ticket and we&rsquo;ll reply by email — usually within a few hours.
            Pro accounts get priority — answered same-day on weekdays.
          </p>
        </Step>

        {/* ───────────────────────── CTA ───────────────────────── */}
        <div className="mt-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-3xl p-8 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">You&rsquo;re ready.</h2>
          <p className="text-blue-100 mb-6 max-w-md mx-auto leading-relaxed">
            Most detailers go from zero to taking real bookings inside 20 minutes. Start your 7-day free trial — no charge until day 8.
          </p>
          <Link href="/signup" className="inline-block bg-white text-blue-600 hover:bg-blue-50 font-extrabold px-7 py-3 rounded-full transition-colors">
            Start your free trial →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} DetailBook</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-gray-700 transition-colors">Contact</Link>
            <Link href="/dashboard" className="hover:text-gray-700 transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
