"use client";

import { useState, useEffect } from "react";
import { getUser, setUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

interface Template {
  id: string;
  label: string;
  description: string;
  proOnly: boolean;
  smsKey: "bookingConfirmation" | "reminder24h" | "followUp";
  emailKey: "bookingConfirmation" | "reminder24h" | "followUp";
  icon: React.ReactNode;
}

const DEFAULT_SMS: Record<string, string> = {
  bookingConfirmation:
    "Hi {customerName}, your {serviceName} appointment is confirmed for {date} at {time}. — {businessName}",
  reminder24h:
    "Reminder: Your {serviceName} appointment is in 2 hours at {time}. See you soon! — {businessName}",
  followUp:
    "Thanks for choosing {businessName}! We hope your vehicle looks amazing. Leave us a review? {reviewLink}",
};

const DEFAULT_EMAIL: Record<string, string> = {
  bookingConfirmation:
    "Dear {customerName},\n\nYour booking for {serviceName} has been confirmed!\n\nDate: {date}\nTime: {time}\n\nWe look forward to seeing you!\n\n— {businessName}",
  reminder24h:
    "Hi {customerName},\n\nJust a friendly reminder that your {serviceName} appointment is in 2 hours at {time}.\n\nPlease make sure your vehicle is accessible and ready.\n\nSee you soon!\n— {businessName}",
  followUp:
    "Hi {customerName},\n\nThank you for choosing {businessName}! We hope your vehicle looks amazing.\n\nWe'd love to hear how we did. Please take a moment to leave us a review.\n\nSee you next time!\n— {businessName}",
};

const TEMPLATES: Template[] = [
  {
    id: "bookingConfirmation",
    label: "Booking Confirmation",
    description: "Sent immediately when a booking is confirmed",
    proOnly: false,
    smsKey: "bookingConfirmation",
    emailKey: "bookingConfirmation",
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "reminder24h",
    label: "2-Hour Reminder",
    description: "Sent 2 hours before the appointment",
    proOnly: true,
    smsKey: "reminder24h",
    emailKey: "reminder24h",
    icon: (
      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "followUp",
    label: "Follow-Up",
    description: "Sent after the job is marked as completed",
    proOnly: true,
    smsKey: "followUp",
    emailKey: "followUp",
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const VARIABLES = [
  { name: "{customerName}", desc: "Customer's full name" },
  { name: "{serviceName}", desc: "Booked service name" },
  { name: "{date}", desc: "Appointment date" },
  { name: "{time}", desc: "Appointment time" },
  { name: "{businessName}", desc: "Your business name" },
];

export default function MessagesPage() {
  const [user, setUserState] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState("bookingConfirmation");
  const [smsTemplates, setSmsTemplates] = useState<Record<string, string>>(DEFAULT_SMS);
  const [emailTemplates, setEmailTemplates] = useState<Record<string, string>>(DEFAULT_EMAIL);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Per-message on/off toggles (map to DB notification fields)
  const [notifToggles, setNotifToggles] = useState({
    emailConfirmations: true,
    smsConfirmations: false,
    smsRemindersEnabled: false,
    emailReminders: true,
  });

  useEffect(() => {
    const local = getUser();
    if (local) setUserState(local);

    fetch("/api/user")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const u: any = data?.user || local;
        if (!u) return;
        setUserState(u);
        setUser(u);
        if (u.smsTemplates) {
          setSmsTemplates({
            bookingConfirmation: u.smsTemplates.bookingConfirmation || DEFAULT_SMS.bookingConfirmation,
            reminder24h: u.smsTemplates.reminder24h || DEFAULT_SMS.reminder24h,
            followUp: u.smsTemplates.followUp || DEFAULT_SMS.followUp,
          });
        }
        if (u.emailTemplates) {
          setEmailTemplates({
            bookingConfirmation: u.emailTemplates.bookingConfirmation || DEFAULT_EMAIL.bookingConfirmation,
            reminder24h: u.emailTemplates.reminder24h || DEFAULT_EMAIL.reminder24h,
            followUp: u.emailTemplates.followUp || DEFAULT_EMAIL.followUp,
          });
        }
        setNotifToggles({
          emailConfirmations: u.emailConfirmations !== false,
          smsConfirmations: u.smsConfirmations === true,
          smsRemindersEnabled: u.smsRemindersEnabled === true,
          emailReminders: u.emailReminders !== false,
        });
      })
      .catch(() => {
        const u = getUser();
        setUserState(u);
      })
      .finally(() => setMounted(true));
  }, []);

  if (!mounted) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-10 w-48 bg-gray-100 rounded-xl shimmer mb-6" />
        <div className="h-96 bg-gray-100 rounded-2xl shimmer" />
      </div>
    );
  }

  const isPro = user?.plan === "pro";

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const updatedUser: User = {
      ...user,
      smsTemplates: {
        bookingConfirmation: smsTemplates.bookingConfirmation,
        reminder24h: smsTemplates.reminder24h,
        followUp: smsTemplates.followUp,
      },
      emailTemplates: {
        bookingConfirmation: emailTemplates.bookingConfirmation,
        reminder24h: emailTemplates.reminder24h,
        followUp: emailTemplates.followUp,
      },
    };

    setUser(updatedUser);
    setUserState(updatedUser);

    try {
      await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smsTemplates: updatedUser.smsTemplates,
          emailTemplates: updatedUser.emailTemplates,
          emailConfirmations: notifToggles.emailConfirmations,
          smsConfirmations: notifToggles.smsConfirmations,
          smsRemindersEnabled: notifToggles.smsRemindersEnabled,
          emailReminders: notifToggles.emailReminders,
        }),
      });
    } catch {}

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const currentTemplate = TEMPLATES.find((t) => t.id === activeTemplate)!;
  const isLocked = currentTemplate.proOnly && !isPro;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fadeInUp">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Messages</h1>
          <p className="text-gray-500 mt-1 text-sm">Customize SMS and email templates for your customers.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || isLocked}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-md ${
            saved
              ? "bg-emerald-500 text-white shadow-emerald-500/30"
              : saving
              ? "bg-gray-100 text-gray-400 cursor-wait shadow-none"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/30"
          }`}
        >
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved!
            </>
          ) : saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Templates
            </>
          )}
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-5">
        {/* Template Selector Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "100ms", opacity: 0 }}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Templates</h3>
            </div>
            <div className="p-2 space-y-1">
              {TEMPLATES.map((template) => {
                const locked = template.proOnly && !isPro;
                const active = activeTemplate === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => !locked && setActiveTemplate(template.id)}
                    disabled={locked}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                      locked
                        ? "opacity-50 cursor-not-allowed"
                        : active
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      active ? "bg-white shadow-sm" : "bg-gray-50"
                    }`}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-semibold truncate ${active ? "text-blue-700" : "text-gray-900"}`}>
                          {template.label}
                        </p>
                        {template.proOnly && !isPro && (
                          <span className="text-[9px] font-bold bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                            Pro
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{template.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enable/Disable per notification */}
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "150ms", opacity: 0 }}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">On / Off</h3>
            </div>
            <div className="p-3 space-y-2">
              {[
                { key: "emailConfirmations", label: "Confirmation Email", pro: false },
                { key: "emailReminders", label: "Owner Alert Email", pro: false },
                { key: "smsConfirmations", label: "Confirmation SMS", pro: true },
                { key: "smsRemindersEnabled", label: "2-Hour Reminder SMS", pro: true },
              ].map(({ key, label, pro }) => {
                const locked = pro && isPro === false;
                const value = notifToggles[key as keyof typeof notifToggles];
                return (
                  <div key={key} className="flex items-center justify-between gap-2 px-1 py-1">
                    <span className={`text-xs font-medium ${locked ? "text-gray-300" : "text-gray-700"}`}>{label}</span>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setNotifToggles((prev) => ({ ...prev, [key]: !value }))}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors flex-shrink-0 ${locked ? "opacity-40 cursor-not-allowed bg-gray-200" : value ? "bg-blue-600" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-400 pt-1">Changes saved with &quot;Save Templates&quot;</p>
            </div>
          </div>

          {/* Variables Reference */}
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "200ms", opacity: 0 }}>
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Variables</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {VARIABLES.map((v) => (
                <div key={v.name} className="flex items-center gap-2 px-2 py-1.5">
                  <code className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-mono font-semibold flex-shrink-0">
                    {v.name}
                  </code>
                  <span className="text-xs text-gray-400 truncate">{v.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-3">
          {isLocked ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "150ms", opacity: 0 }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                  {currentTemplate.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-900">{currentTemplate.label}</h2>
                    <span className="text-[10px] font-bold bg-amber-400/20 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Pro
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{currentTemplate.description}</p>
                </div>
              </div>

              <div className="p-8">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center">
                  <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
                  <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full" />
                  <div className="relative">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-extrabold text-white mb-2">Pro Feature</h3>
                    <p className="text-blue-100 text-sm mb-6 max-w-md mx-auto">
                      Upgrade to Pro to customize {currentTemplate.label.toLowerCase()} templates and automate your customer communications.
                    </p>
                    <a
                      href="/dashboard/billing"
                      className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-black/10"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Upgrade to Pro -- $50/mo
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fadeInUp" style={{ animationDelay: "150ms", opacity: 0 }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                  {currentTemplate.icon}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{currentTemplate.label}</h2>
                  <p className="text-xs text-gray-400">{currentTemplate.description}</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* SMS Template */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <label className="text-sm font-bold text-gray-900">SMS Template</label>
                    <span className="text-xs text-gray-400">({smsTemplates[activeTemplate]?.length || 0} characters)</span>
                  </div>
                  <textarea
                    value={smsTemplates[activeTemplate] || ""}
                    onChange={(e) =>
                      setSmsTemplates((prev) => ({ ...prev, [activeTemplate]: e.target.value }))
                    }
                    rows={4}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 text-gray-900 placeholder-gray-400 transition-all"
                    placeholder="Enter your SMS template..."
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Keep SMS under 160 characters for best delivery rates.</p>
                </div>

                {/* Email Template */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <label className="text-sm font-bold text-gray-900">Email Template</label>
                  </div>
                  <textarea
                    value={emailTemplates[activeTemplate] || ""}
                    onChange={(e) =>
                      setEmailTemplates((prev) => ({ ...prev, [activeTemplate]: e.target.value }))
                    }
                    rows={10}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 text-gray-900 placeholder-gray-400 font-mono transition-all"
                    placeholder="Enter your email template..."
                  />
                </div>

                {/* Preview section */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Live Preview
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* SMS Preview */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">SMS Preview</p>
                      <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-bl-md px-4 py-3 leading-relaxed max-w-xs">
                        {(smsTemplates[activeTemplate] || "")
                          .replace(/\{customerName\}/g, "James Wilson")
                          .replace(/\{serviceName\}/g, "Full Detail")
                          .replace(/\{date\}/g, "Mar 25, 2026")
                          .replace(/\{time\}/g, "10:00 AM")
                          .replace(/\{businessName\}/g, user?.businessName || "Your Business")
                          .replace(/\{reviewLink\}/g, "g.page/review/...")}
                      </div>
                    </div>
                    {/* Email Preview */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Email Preview</p>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                        {(emailTemplates[activeTemplate] || "")
                          .replace(/\{customerName\}/g, "James Wilson")
                          .replace(/\{serviceName\}/g, "Full Detail")
                          .replace(/\{date\}/g, "Mar 25, 2026")
                          .replace(/\{time\}/g, "10:00 AM")
                          .replace(/\{businessName\}/g, user?.businessName || "Your Business")
                          .replace(/\{reviewLink\}/g, "g.page/review/...")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <DashboardHelp page="messages" />
    </div>
  );
}
