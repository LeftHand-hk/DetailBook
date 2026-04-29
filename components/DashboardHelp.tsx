"use client";

import { useState } from "react";

type PageKey =
  | "bookings"
  | "calendar"
  | "packages"
  | "settings"
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
  steps: Step[];
}

const helpData: Record<PageKey, HelpContent> = {
  bookings: {
    title: "How to Manage Bookings",
    steps: [
      { title: "Filter & Search", desc: "Use the tabs to filter by status (All, Upcoming, Completed, Pending, Cancelled). Use the search bar to find bookings by name, email, or vehicle." },
      { title: "View Details", desc: "Click on any booking to open its full details — customer info, vehicle, service, payment status, and notes." },
      { title: "Change Status", desc: "Inside the booking detail, use the status buttons to Confirm, Complete, set to Pending, or Cancel a booking." },
      { title: "Track Deposits", desc: "See deposit status at a glance. Use 'Mark Paid' or 'Mark Unpaid' to toggle deposit payment status." },
      { title: "Contact Customer", desc: "Click the customer's email or phone number in the detail view to contact them directly." },
    ],
  },
  calendar: {
    title: "How to Use the Calendar",
    steps: [
      { title: "Navigate Months", desc: "Use the arrows to go forward or back. The current day is highlighted in blue." },
      { title: "View Day Details", desc: "Click any date to see all bookings for that day in the right panel." },
      { title: "Color Coding", desc: "Green = Confirmed, Yellow = Pending, Blue = Completed, Red = Cancelled. Each booking shows the customer's first name." },
      { title: "Multiple Bookings", desc: "Dates with multiple bookings show each one. If there are more than fit, you'll see '+X more'." },
    ],
  },
  packages: {
    title: "How to Manage Packages",
    steps: [
      { title: "Add Package", desc: "Click 'Add Package' to create a new service. Set the name, description, price, duration, and deposit amount." },
      { title: "Edit Package", desc: "Click the Edit button on any package card to update its details." },
      { title: "Toggle Active", desc: "Use the toggle switch to enable or disable a package. Inactive packages won't appear on your booking page." },
      { title: "Set Deposits", desc: "Set a deposit amount to require upfront payment when customers book. Leave at 0 for no deposit." },
      { title: "Delete Package", desc: "Click the trash icon to permanently delete a package. This cannot be undone." },
    ],
  },
  settings: {
    title: "How to Use Settings",
    steps: [
      { title: "Business Profile", desc: "Add your logo, business name, contact info, bio, social media links, and service areas. This appears on your public booking page." },
      { title: "Business Hours", desc: "Set your availability for each day. Toggle days open/closed and set open/close times." },
      { title: "Booking Page", desc: "Customize your booking URL slug, welcome message, and how far in advance customers can book." },
      { title: "Subscription", desc: "View your current plan. Upgrade to Pro for unlimited packages, SMS, analytics, and more." },
      { title: "Notifications", desc: "Control email reminders and other notification settings." },
    ],
  },
  customers: {
    title: "Customer Database",
    steps: [
      { title: "Auto-Populated", desc: "Your customer database fills automatically as bookings come in. No manual entry needed." },
      { title: "Search & Filter", desc: "Search customers by name, email, or phone. Filter by repeat customers or new customers." },
      { title: "Customer History", desc: "Click any customer to see their full booking history, total spent, and vehicle details." },
    ],
  },
  analytics: {
    title: "Analytics & Reports",
    steps: [
      { title: "Revenue Trends", desc: "Track daily, weekly, and monthly revenue with visual charts." },
      { title: "Booking Insights", desc: "See your busiest days, most popular services, and booking completion rates." },
      { title: "Customer Metrics", desc: "Monitor new vs returning customers, average spend, and lifetime value." },
    ],
  },
  reviews: {
    title: "Review Management",
    steps: [
      { title: "Monitor Reviews", desc: "Track your average rating and total reviews at a glance." },
      { title: "Recent Feedback", desc: "Newest customer reviews appear in the Recent Reviews list as they come in." },
    ],
  },
  messages: {
    title: "SMS & Email Templates",
    steps: [
      { title: "Choose Template", desc: "Select which template to edit: Booking Confirmation, 2-Hour Reminder, or Follow-Up." },
      { title: "Use Variables", desc: "Insert {customerName}, {serviceName}, {date}, {time}, {businessName} into your templates. They get replaced with real data." },
      { title: "Preview", desc: "See a live preview of how your SMS and email will look with sample data." },
      { title: "Save Templates", desc: "Click Save to persist your changes. Templates are used automatically when events trigger." },
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
