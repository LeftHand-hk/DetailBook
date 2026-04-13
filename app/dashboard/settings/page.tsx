"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUser, setUser, logout } from "@/lib/storage";
import type { User, BusinessHours } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

const DEFAULT_HOURS: Record<string, BusinessHours> = {
  monday:    { open: "8:00 AM", close: "6:00 PM", closed: false },
  tuesday:   { open: "8:00 AM", close: "6:00 PM", closed: false },
  wednesday: { open: "8:00 AM", close: "6:00 PM", closed: false },
  thursday:  { open: "8:00 AM", close: "6:00 PM", closed: false },
  friday:    { open: "8:00 AM", close: "5:00 PM", closed: false },
  saturday:  { open: "9:00 AM", close: "4:00 PM", closed: false },
  sunday:    { open: "10:00 AM", close: "2:00 PM", closed: true },
};

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const;

const OPEN_TIMES  = ["6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM"];
const CLOSE_TIMES = ["12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM","9:00 PM"];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${value ? "bg-blue-600" : "bg-gray-200"}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}

function SavedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-semibold">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Saved
    </span>
  );
}

const TABS = [
  {
    id: "hours",
    label: "Business Hours",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "booking",
    label: "Booking",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    id: "account",
    label: "Account",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUserState] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "hours");
  const [saved, setSaved] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Business Hours
  const [hours, setHours] = useState<Record<string, BusinessHours>>(DEFAULT_HOURS);

  // Booking Settings
  const [bookingSettings, setBookingSettings] = useState({
    advanceBookingDays: 30,
    customMessage: "",
    bookingPageTheme: "light" as "light" | "dark" | "auto",
    accentColor: "#3B82F6",
    bookingPageTitle: "",
    bookingPageSubtitle: "Book your appointment online",
    showRating: true,
    showSocialLinks: true,
    showServiceAreas: true,
    showBusinessHours: true,
    showTrustBadges: true,
    thankYouMessage: "",
    termsText: "",
  });

  const [serviceType, setServiceType] = useState<"mobile" | "shop" | "both">("mobile");

  // Notifications
  const [notifications, setNotifications] = useState({
    emailReminders: true,
    emailConfirmations: true,
    smsConfirmations: false,
    smsRemindersEnabled: false,
  });

  useEffect(() => {
    // First load from localStorage for instant render
    const local = getUser();
    if (local) setUserState(local);

    // Then fetch fresh data from DB (has up-to-date plan + notification settings)
    fetch("/api/user")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const u: any = data?.user || local;
        if (!u) return;
        setUserState(u);
        setUser(u);
        setHours(u.businessHours ? { ...DEFAULT_HOURS, ...u.businessHours } : DEFAULT_HOURS);
        setServiceType(u.serviceType || "mobile");
        setBookingSettings({
          advanceBookingDays: u.advanceBookingDays || 30,
          customMessage: u.customMessage || "",
          bookingPageTheme: u.bookingPageTheme || "light",
          accentColor: u.accentColor || "#3B82F6",
          bookingPageTitle: u.bookingPageTitle || "",
          bookingPageSubtitle: u.bookingPageSubtitle || "Book your appointment online",
          showRating: u.showRating !== false,
          showSocialLinks: u.showSocialLinks !== false,
          showServiceAreas: u.showServiceAreas !== false,
          showBusinessHours: u.showBusinessHours !== false,
          showTrustBadges: u.showTrustBadges !== false,
          thankYouMessage: u.thankYouMessage || "",
          termsText: u.termsText || "",
        });
        setNotifications({
          emailReminders: u.emailReminders !== false,
          emailConfirmations: u.emailConfirmations !== false,
          smsConfirmations: u.smsConfirmations === true,
          smsRemindersEnabled: u.smsRemindersEnabled === true,
        });
      })
      .catch(() => {
        // Fallback already set from localStorage above
      });
  }, []);

  const flash = (key: string) => { setSaved(key); setTimeout(() => setSaved(""), 2500); };

  const handleSaveHours = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updated: User = { ...user, businessHours: hours as User["businessHours"] };
    setUser(updated); setUserState(updated); flash("hours");
  };

  const handleSaveBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updated: User = { ...user, ...bookingSettings, serviceType } as any;
    setUser(updated); setUserState(updated); flash("booking");
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    const updated = { ...user, ...notifications } as any;
    setUser(updated); setUserState(updated);
    try {
      await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailReminders: notifications.emailReminders,
          emailConfirmations: notifications.emailConfirmations,
          smsConfirmations: notifications.smsConfirmations,
          smsRemindersEnabled: notifications.smsRemindersEnabled,
        }),
      });
    } catch {}
    flash("notifications");
  };

  const handleDeleteAccount = () => {
    localStorage.clear(); logout(); router.push("/");
  };

  const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-300 bg-white";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your business hours, booking options, and account.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Sidebar ── */}
        <div className="lg:w-48 flex-shrink-0">
          <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 space-y-0.5">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2.5 ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : tab.id === "account"
                    ? "text-gray-600 hover:bg-gray-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}>
                <span className={activeTab === tab.id ? "text-white" : "text-gray-400"}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">

          {/* ── Business Hours ── */}
          {activeTab === "hours" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Business Hours</h2>
                <p className="text-sm text-gray-500 mt-0.5">When are you available? Shown on your booking page.</p>
              </div>
              <form onSubmit={handleSaveHours} className="p-5 space-y-2">
                {DAYS.map((day) => {
                  const h = hours[day];
                  return (
                    <div key={day} className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border transition-all ${h.closed ? "bg-gray-50 border-gray-100 opacity-70" : "bg-blue-50/30 border-blue-100"}`}>
                      <div className="w-[90px] flex-shrink-0">
                        <span className="text-sm font-bold text-gray-700 capitalize">{day}</span>
                      </div>
                      <Toggle value={!h.closed} onChange={(v) => setHours({ ...hours, [day]: { ...h, closed: !v } })} />
                      <span className={`text-xs font-semibold w-10 ${h.closed ? "text-gray-400" : "text-green-600"}`}>
                        {h.closed ? "Closed" : "Open"}
                      </span>
                      {!h.closed && (
                        <>
                          <select value={h.open}
                            onChange={(e) => setHours({ ...hours, [day]: { ...h, open: e.target.value } })}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            {OPEN_TIMES.map((t) => <option key={t}>{t}</option>)}
                          </select>
                          <span className="text-gray-400 text-sm">→</span>
                          <select value={h.close}
                            onChange={(e) => setHours({ ...hours, [day]: { ...h, close: e.target.value } })}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            {CLOSE_TIMES.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 pt-3">
                  <button type="submit" className="bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm">
                    Save Hours
                  </button>
                  {saved === "hours" && <SavedBadge />}
                </div>
              </form>
            </div>
          )}

          {/* ── Booking Settings ── */}
          {activeTab === "booking" && (
            <form onSubmit={handleSaveBooking} className="space-y-4">

              {/* Service Type */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Service Type</h2>
                  <p className="text-sm text-gray-500 mt-0.5">How do you serve customers?</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "mobile", label: "Mobile", desc: "You go to them", icon: "🚗" },
                      { value: "shop",   label: "Shop",   desc: "They come to you", icon: "🏪" },
                      { value: "both",   label: "Both",   desc: "Either option", icon: "↔️" },
                    ].map(({ value, label, desc, icon }) => (
                      <button key={value} type="button" onClick={() => setServiceType(value as any)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${serviceType === value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className="text-xl mb-1">{icon}</div>
                        <p className={`text-sm font-bold ${serviceType === value ? "text-blue-700" : "text-gray-800"}`}>{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Page Options */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-gray-900">Booking Page Options</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Control what appears on your public page.</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Advance Booking (days)</label>
                      <input type="number" min="1" max="365"
                        value={bookingSettings.advanceBookingDays}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, advanceBookingDays: Number(e.target.value) })}
                        className={inputCls} />
                      <p className="text-xs text-gray-400 mt-1">How far ahead customers can book</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Page Title</label>
                      <input type="text" value={bookingSettings.bookingPageTitle}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, bookingPageTitle: e.target.value })}
                        placeholder="e.g. Book a Detail"
                        className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Welcome Message</label>
                    <textarea rows={2} value={bookingSettings.customMessage}
                      onChange={(e) => setBookingSettings({ ...bookingSettings, customMessage: e.target.value })}
                      placeholder="e.g. Book online 24/7 — deposits required to confirm."
                      className={`${inputCls} resize-none`} />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Thank You Message</label>
                    <textarea rows={2} value={bookingSettings.thankYouMessage}
                      onChange={(e) => setBookingSettings({ ...bookingSettings, thankYouMessage: e.target.value })}
                      placeholder="Shown after booking is confirmed."
                      className={`${inputCls} resize-none`} />
                  </div>

                  <div className="pt-1 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Show on Page</p>
                    <div className="space-y-2.5">
                      {[
                        { key: "showRating",        label: "Ratings & Reviews" },
                        { key: "showSocialLinks",    label: "Social Media Links" },
                        { key: "showServiceAreas",   label: "Service Areas" },
                        { key: "showBusinessHours",  label: "Business Hours" },
                        { key: "showTrustBadges",    label: "Trust Badges" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{label}</span>
                          <Toggle
                            value={bookingSettings[key as keyof typeof bookingSettings] as boolean}
                            onChange={(v) => setBookingSettings({ ...bookingSettings, [key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" className="bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm">
                  Save Settings
                </button>
                {saved === "booking" && <SavedBadge />}
              </div>
            </form>
          )}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <a href="/dashboard/messages"
              className="flex items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Notification Settings</p>
                  <p className="text-xs text-gray-500 mt-0.5">Turn email and SMS notifications on/off and customize message templates.</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          )}

          {/* ── Integrations ── */}
          {activeTab === "integrations" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Integrations</h2>
                <p className="text-sm text-gray-500 mt-0.5">Connect third-party tools to your account.</p>
              </div>
              <div className="p-5">
                <a href="/dashboard/calendar"
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <rect width="24" height="24" rx="4" fill="#4285F4" />
                        <path d="M12 6.5C13.93 6.5 15.5 7.57 16.28 9.15L18.2 7.23C16.87 5.56 14.57 4.5 12 4.5C8.24 4.5 5.07 6.78 3.69 10L5.96 11.78C6.63 9.33 9.11 7.5 12 7.5V6.5Z" fill="#EA4335" />
                        <path d="M18.64 12.2C18.64 11.57 18.58 10.97 18.46 10.4H12V13.7H15.73C15.33 14.9 14.39 15.86 13.14 16.38V18.62H15.97C17.66 17.07 18.64 14.83 18.64 12.2Z" fill="#4285F4" />
                        <path d="M12 20.5C14.97 20.5 17.46 19.54 18.97 17.8L16.14 15.56C15.37 16.09 14.29 16.5 12 16.5C9.11 16.5 6.63 14.67 5.96 12.22L3.69 14C5.07 17.22 8.24 19.5 12 19.5V20.5Z" fill="#34A853" />
                        <path d="M3.69 14L5.96 12.22C5.84 11.65 5.78 11.05 5.78 10.4C5.78 9.75 5.84 9.15 5.96 8.58L3.69 10C3.35 10.75 3.14 11.55 3.14 12.4C3.14 13.25 3.35 14.05 3.69 14Z" fill="#FBBC04" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Google Calendar</p>
                      <p className="text-xs text-gray-500 mt-0.5">Manage your Google Calendar connection in the Calendar page.</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {/* ── Account ── */}
          {activeTab === "account" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Account</h2>
                <p className="text-sm text-gray-500 mt-0.5">Manage your account settings.</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Account info */}
                {user && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                        {user.businessName?.charAt(0) || "D"}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{user.businessName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${user.plan === "pro" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                          {user.plan?.toUpperCase() || "STARTER"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Billing link */}
                <a href="/dashboard/billing"
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Billing & Subscription</p>
                      <p className="text-xs text-gray-500">Manage your plan and payments</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>

                {/* Delete account */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50/40">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Delete Account</p>
                      <p className="text-xs text-gray-500 mt-0.5">Permanently deletes all bookings, packages, and settings. Cannot be undone.</p>
                    </div>
                    <button onClick={() => setShowDeleteModal(true)}
                      className="ml-4 flex-shrink-0 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <DashboardHelp page="settings" />

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 text-center mb-2">Delete Account?</h3>
            <p className="text-gray-500 text-sm text-center mb-5">
              All your bookings, packages, and settings will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl hover:bg-red-700 transition-colors text-sm">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleCalendarSection({ userPlan }: { userPlan?: string }) {
  const [status, setStatus] = useState<{ connected: boolean; calendarId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const isPro = userPlan === "pro";

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data); })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => { window.location.href = "/api/google-calendar/connect"; };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (res.ok) setStatus({ connected: false });
    } catch { /* silent */ }
    setDisconnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(data);
      }
    } catch { /* silent */ }
    setSyncing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-0.5">Connect third-party tools to your account.</p>
      </div>
      <div className="p-5">
        {gcalParam === "success" && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Google Calendar connected successfully!
          </div>
        )}
        {gcalParam === "error" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl">
            Failed to connect Google Calendar. Please try again.
          </div>
        )}

        <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="4" fill="#4285F4" />
                <path d="M12 6.5C13.93 6.5 15.5 7.57 16.28 9.15L18.2 7.23C16.87 5.56 14.57 4.5 12 4.5C8.24 4.5 5.07 6.78 3.69 10L5.96 11.78C6.63 9.33 9.11 7.5 12 7.5V6.5Z" fill="#EA4335" />
                <path d="M18.64 12.2C18.64 11.57 18.58 10.97 18.46 10.4H12V13.7H15.73C15.33 14.9 14.39 15.86 13.14 16.38V18.62H15.97C17.66 17.07 18.64 14.83 18.64 12.2Z" fill="#4285F4" />
                <path d="M12 20.5C14.97 20.5 17.46 19.54 18.97 17.8L16.14 15.56C15.37 16.09 14.29 16.5 12 16.5C9.11 16.5 6.63 14.67 5.96 12.22L3.69 14C5.07 17.22 8.24 19.5 12 19.5V20.5Z" fill="#34A853" />
                <path d="M3.69 14L5.96 12.22C5.84 11.65 5.78 11.05 5.78 10.4C5.78 9.75 5.84 9.15 5.96 8.58L3.69 10C3.35 10.75 3.14 11.55 3.14 12.4C3.14 13.25 3.35 14.05 3.69 14Z" fill="#FBBC04" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">Google Calendar</p>
                {!isPro && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Pro</span>
                )}
                {status?.connected && (
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Connected</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {status?.connected
                  ? `Syncing to: ${status.calendarId || "Primary calendar"}`
                  : "Sync your bookings to Google Calendar automatically."}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin flex-shrink-0 mt-1" />
          ) : !isPro ? (
            <a href="/dashboard/billing"
              className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Upgrade
            </a>
          ) : status?.connected ? (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleSync} disabled={syncing}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                {disconnecting ? "..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <button onClick={handleConnect}
              className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Connect
            </button>
          )}
        </div>

        {syncResult && (
          <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            Sync complete: <strong>{syncResult.synced}</strong> bookings synced
            {syncResult.errors > 0 && <span className="text-red-500">, {syncResult.errors} errors</span>}.
          </div>
        )}
      </div>
    </div>
  );
}
