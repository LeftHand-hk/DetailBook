"use client";

import { useState } from "react";

type PageKey =
  | "bookings"
  | "calendar"
  | "packages"
  | "settings"
  | "booking-page"
  | "payments"
  | "customers"
  | "analytics"
  | "reviews"
  | "messages";

interface Step {
  title: string;
  desc: string;
}

interface HelpContent {
  title: string;
  intro: string;
  steps: Step[];
}

const helpData: Record<PageKey, HelpContent> = {
  bookings: {
    title: "Bookings",
    intro: "Every appointment your customers book lands here. Use it to confirm, complete, or cancel jobs and to track deposits.",
    steps: [
      { title: "Filter by status", desc: "Use the tabs at the top — All, Upcoming, Completed, Pending, Cancelled — or search by customer name, email or vehicle." },
      { title: "Open a booking", desc: "Click any row to see customer info, vehicle, service, payment status and notes." },
      { title: "Update status", desc: "Inside the booking, tap Confirm, Complete or Cancel. The customer is notified by email automatically." },
      { title: "Track deposits", desc: "If a deposit is due, you'll see whether it was paid online or owed in cash. Use Mark Paid / Mark Unpaid to override." },
      { title: "Contact the customer", desc: "Tap their email or phone in the detail view to reach out directly." },
    ],
  },
  calendar: {
    title: "Calendar",
    intro: "A month view of every booking so you can plan your route and spot gaps in your day.",
    steps: [
      { title: "Move between months", desc: "Use the arrows. Today is highlighted in blue." },
      { title: "See a day's jobs", desc: "Click any date to load that day's bookings in the side panel." },
      { title: "Read the colours", desc: "Green = Confirmed · Yellow = Pending · Blue = Completed · Red = Cancelled." },
      { title: "Busy days", desc: "Days with more bookings than fit show '+X more' — click to see them all." },
    ],
  },
  packages: {
    title: "Service Packages",
    intro: "Packages are the services customers can book. Set a price, how long it takes, and whether you want a deposit.",
    steps: [
      { title: "Add a package", desc: "Tap Add Package. Give it a name (e.g. Full Detail), short description, price and duration." },
      { title: "Vehicle types", desc: "Pick which vehicles the service covers (sedan, SUV, truck, etc.). The booking page only shows packages for the customer's vehicle type." },
      { title: "Require a deposit", desc: "Set a deposit amount to cut down on no-shows. Leave at $0 to skip. The deposit is collected at booking time using whichever payment methods you turned on in Payments." },
      { title: "Edit or hide", desc: "Use Edit to change details. Toggle Active off to temporarily hide a package from your booking page without deleting it." },
      { title: "Delete", desc: "The trash icon removes a package permanently — past bookings keep their data." },
    ],
  },
  "booking-page": {
    title: "Your Booking Page",
    intro: "This is the public page customers see when you share your link. Everything here changes how it looks and what it shows.",
    steps: [
      { title: "Business profile", desc: "Add your logo, business name, owner name, short bio, address, years in business and service areas. This builds trust with new customers." },
      { title: "Booking link", desc: "Pick a short URL slug (e.g. detailbookapp.com/book/your-shop). Share this link in your Instagram bio, Google profile, ads — anywhere customers find you." },
      { title: "Look & feel", desc: "Choose a theme, accent colour, banner image and which sections to show (rating, social links, business hours, etc.)." },
      { title: "Headline & messages", desc: "Write a custom welcome line, a thank-you message after booking, and any terms customers must agree to." },
      { title: "Booking window", desc: "Set how many days ahead a customer can book (default 30)." },
      { title: "Preview", desc: "Open your link in a new tab — what you see is exactly what your customers see." },
    ],
  },
  payments: {
    title: "Accepting Payments",
    intro: "Turn on the payment methods you want to use to collect deposits. You need at least one enabled before customers can book a package that requires a deposit.",
    steps: [
      { title: "Stripe (recommended)", desc: "Cards charged instantly online. Toggle on, paste your Publishable Key and Secret Key from your Stripe dashboard, save. Funds land in your bank in 2 days." },
      { title: "Square", desc: "If you already use Square in person. Toggle on, paste Application ID, Access Token and Location ID. Leave Sandbox OFF for real payments — sandbox is just for testing." },
      { title: "PayPal / Cash App / Bank transfer", desc: "Customer pays through your link or details, then uploads a screenshot as proof. You review it inside the booking before confirming the job." },
      { title: "Cash on arrival", desc: "Customer pays you in person. Add short instructions (e.g. 'Cash or Zelle on arrival') — they appear on the booking confirmation." },
      { title: "Test it", desc: "Open your booking page in a new tab and try booking a service that has a deposit. Confirm the payment shows up in your Stripe / Square dashboard." },
    ],
  },
  settings: {
    title: "Account Settings",
    intro: "Account-level settings: business hours, login email, password, notification preferences. Your booking page design lives in 'Booking Page', payment methods in 'Payments'.",
    steps: [
      { title: "Business hours", desc: "Set the days you work and your open / close times. Customers can only book inside these hours." },
      { title: "Email & password", desc: "Change your login email or password. You'll be signed out of other devices when the password changes." },
      { title: "Notifications", desc: "Choose whether you want an email when a new booking comes in, when a deposit is paid, or when a customer cancels." },
      { title: "Trial & subscription", desc: "See your trial end date and current plan. To change plans or update your card, go to Billing in the sidebar." },
    ],
  },
  customers: {
    title: "Customers",
    intro: "A directory of everyone who's ever booked with you. Built automatically from bookings — there's nothing to import.",
    steps: [
      { title: "Search & filter", desc: "Find a customer by name, email or phone. Filter for repeat customers or first-timers." },
      { title: "Customer detail", desc: "Click a row to see their full booking history, total spent and saved vehicle info." },
    ],
  },
  analytics: {
    title: "Analytics (Pro)",
    intro: "Charts and numbers for spotting what's working — your busiest days, top services and revenue trends.",
    steps: [
      { title: "Revenue", desc: "Daily, weekly and monthly revenue from completed jobs. Use the date range picker to compare periods." },
      { title: "Bookings", desc: "Total bookings, completion rate, cancellation rate and average ticket." },
      { title: "Top services", desc: "Which packages bring in the most money — useful when deciding what to promote." },
    ],
  },
  reviews: {
    title: "Reviews (Pro)",
    intro: "Track your average rating and read fresh customer feedback as it comes in.",
    steps: [
      { title: "Overview", desc: "Average star rating and total review count at the top." },
      { title: "Recent reviews", desc: "Newest customer feedback appears first so you can spot issues fast." },
    ],
  },
  messages: {
    title: "Email & SMS Templates (Pro)",
    intro: "Customise the automatic messages your customers get — booking confirmation, 2-hour reminder and post-job follow-up.",
    steps: [
      { title: "Pick a template", desc: "Choose which message you want to edit from the tabs." },
      { title: "Use placeholders", desc: "Drop in {customerName}, {serviceName}, {date}, {time} or {businessName} and they'll be filled in with the real values when sent." },
      { title: "Preview", desc: "See exactly how your text and email will look with sample data before saving." },
      { title: "Save", desc: "Hit Save and the new template is used for every future booking — no further setup needed." },
    ],
  },
};

export default function DashboardHelp({ page }: { page: PageKey }) {
  const [open, setOpen] = useState(false);
  const content = helpData[page];

  return (
    <>
      {/* ── Floating Help Button ── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white pl-4 pr-5 py-3 rounded-full shadow-xl shadow-blue-600/30 transition-all hover:scale-105"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold">Need Help?</span>
      </button>

      {/* ── Help Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-white">{content.title}</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-blue-100 text-xs mt-1.5 leading-relaxed">{content.intro}</p>
            </div>

            {/* Steps */}
            <div className="p-6 overflow-y-auto flex-1">
              <ol className="space-y-4">
                {content.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{step.title}</p>
                      <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                Got it!
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
