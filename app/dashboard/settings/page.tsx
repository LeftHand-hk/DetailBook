"use client";

import { useState, useEffect, useRef } from "react";
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${value ? "bg-blue-600" : "bg-gray-200"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SavedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-semibold animate-fadeIn">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Saved!
    </span>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUserState] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");
  const [saved, setSaved] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profile, setProfile] = useState({
    businessName: "", name: "", email: "", phone: "",
    address: "", bio: "", instagram: "", facebook: "", website: "",
    yearsInBusiness: "" as string | number,
  });
  const [logo, setLogo] = useState<string | undefined>(undefined);

  // Service areas
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState("");

  // Business hours
  const [hours, setHours] = useState<Record<string, BusinessHours>>(DEFAULT_HOURS);

  // Service type
  const [serviceType, setServiceType] = useState<"mobile" | "shop" | "both">("mobile");

  // Booking settings
  const [bookingSettings, setBookingSettings] = useState({
    slug: "",
    customMessage: "",
    advanceBookingDays: 30,
    bookingPageTheme: "light" as "light" | "dark" | "auto",
    accentColor: "#3B82F6",
    bookingPageTitle: "",
    bookingPageSubtitle: "Book your appointment online",
    showRating: true,
    showSocialLinks: true,
    showServiceAreas: true,
    showBusinessHours: true,
    showTrustBadges: true,
    requireDeposit: false,
    depositPercentage: 20,
    thankYouMessage: "",
    termsText: "",
  });

  // Notifications
  const [notifications, setNotifications] = useState({ emailReminders: true });

  // SMS & Email Templates
  const [smsTemplates, setSmsTemplates] = useState({
    bookingConfirmation: "Hi {{customer_name}}, your {{service_name}} appointment is confirmed for {{date}} at {{time}}. — {{business_name}}",
    reminder24h: "Reminder: Your {{service_name}} appointment is tomorrow at {{time}}. See you then! — {{business_name}}",
    followUp: "Thanks for choosing {{business_name}}! We hope your {{vehicle}} looks amazing. Leave us a review?",
  });
  const [emailTemplates, setEmailTemplates] = useState({
    bookingConfirmation: "Dear {{customer_name}},\n\nYour booking for {{service_name}} has been confirmed!\n\nDate: {{date}}\nTime: {{time}}\nVehicle: {{vehicle}}\nTotal: ${{price}}\nDeposit Paid: ${{deposit}}\n\nWe look forward to seeing you!\n\n— {{business_name}}",
    reminder24h: "Hi {{customer_name}},\n\nJust a friendly reminder that your {{service_name}} appointment is tomorrow at {{time}}.\n\nPlease make sure your vehicle is accessible and ready.\n\nSee you soon!\n— {{business_name}}",
    followUp: "Hi {{customer_name}},\n\nThank you for choosing {{business_name}}! We hope your {{vehicle}} looks amazing.\n\nWe'd love to hear how we did. Please take a moment to leave us a review.\n\nSee you next time!\n— {{business_name}}",
  });

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUserState(u);
      setProfile({
        businessName: u.businessName || "",
        name: u.name || "",
        email: u.email || "",
        phone: u.phone || "",
        address: u.address || "",
        bio: u.bio || "",
        instagram: u.instagram || "",
        facebook: u.facebook || "",
        website: u.website || "",
        yearsInBusiness: u.yearsInBusiness ?? "",
      });
      setLogo(u.logo);
      setServiceAreas(u.serviceAreas || []);
      setHours(u.businessHours ? { ...DEFAULT_HOURS, ...u.businessHours } : DEFAULT_HOURS);
      setBookingSettings({
        slug: u.slug || "",
        customMessage: u.customMessage || "",
        advanceBookingDays: u.advanceBookingDays || 30,
        bookingPageTheme: u.bookingPageTheme || "light",
        accentColor: u.accentColor || "#3B82F6",
        bookingPageTitle: u.bookingPageTitle || "",
        bookingPageSubtitle: u.bookingPageSubtitle || "Book your appointment online",
        showRating: u.showRating !== false,
        showSocialLinks: u.showSocialLinks !== false,
        showServiceAreas: u.showServiceAreas !== false,
        showBusinessHours: u.showBusinessHours !== false,
        showTrustBadges: u.showTrustBadges !== false,
        requireDeposit: u.requireDeposit || false,
        depositPercentage: u.depositPercentage || 20,
        thankYouMessage: u.thankYouMessage || "",
        termsText: u.termsText || "",
      });
      setServiceType((u as any).serviceType || "mobile");
      setNotifications({ emailReminders: u.emailReminders !== false });
      if (u.smsTemplates) setSmsTemplates({ ...smsTemplates, ...u.smsTemplates });
      if (u.emailTemplates) setEmailTemplates({ ...emailTemplates, ...u.emailTemplates });
    }
  }, []);

  const flash = (key: string) => { setSaved(key); setTimeout(() => setSaved(""), 2500); };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updated: User = {
      ...user, ...profile,
      logo,
      serviceAreas,
      yearsInBusiness: profile.yearsInBusiness !== "" ? Number(profile.yearsInBusiness) : undefined,
    };
    setUser(updated); setUserState(updated); flash("profile");
  };

  const handleSaveHours = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updated: User = { ...user, businessHours: hours as User["businessHours"] };
    setUser(updated); setUserState(updated); flash("hours");
  };

  const handleSaveBookingSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const slug = bookingSettings.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const updated: User = {
      ...user,
      slug,
      customMessage: bookingSettings.customMessage,
      advanceBookingDays: bookingSettings.advanceBookingDays,
      bookingPageTheme: bookingSettings.bookingPageTheme,
      accentColor: bookingSettings.accentColor,
      bookingPageTitle: bookingSettings.bookingPageTitle,
      bookingPageSubtitle: bookingSettings.bookingPageSubtitle,
      showRating: bookingSettings.showRating,
      showSocialLinks: bookingSettings.showSocialLinks,
      showServiceAreas: bookingSettings.showServiceAreas,
      showBusinessHours: bookingSettings.showBusinessHours,
      showTrustBadges: bookingSettings.showTrustBadges,
      requireDeposit: bookingSettings.requireDeposit,
      depositPercentage: bookingSettings.depositPercentage,
      thankYouMessage: bookingSettings.thankYouMessage,
      termsText: bookingSettings.termsText,
      serviceType,
    } as any;
    setUser(updated); setUserState(updated); flash("booking");
  };

  const handleSaveNotifications = () => {
    if (!user) return;
    const updated = { ...user, ...notifications };
    setUser(updated); setUserState(updated); flash("notifications");
  };

  const handleSaveTemplates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updated = { ...user, smsTemplates, emailTemplates };
    setUser(updated); setUserState(updated); flash("templates");
  };

  const handleDeleteAccount = () => {
    localStorage.clear(); logout(); router.push("/");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addServiceArea = () => {
    const trimmed = newArea.trim();
    if (trimmed && !serviceAreas.includes(trimmed)) {
      setServiceAreas([...serviceAreas, trimmed]);
      setNewArea("");
    }
  };

  const inputCls = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all placeholder-gray-300";

  const tabs = [
    { id: "profile",      label: "Business Profile", icon: "🏢" },
    { id: "hours",        label: "Business Hours",   icon: "🕐" },
    { id: "booking",      label: "Booking Settings", icon: "📅" },
    { id: "templates",    label: "SMS & Email",      icon: "💬" },
    { id: "integrations", label: "Integrations",     icon: "🔗" },
    { id: "notifications",label: "Notifications",    icon: "🔔" },
    { id: "danger",       label: "Danger Zone",      icon: "⚠️" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6 animate-fadeInUp">
        <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your business profile, hours, and account.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0 animate-slideInLeft">
          <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 space-y-0.5">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 flex items-center gap-2.5 ${
                  activeTab === tab.id ? "bg-blue-600 text-white shadow-sm" :
                  tab.id === "danger" ? "text-red-600 hover:bg-red-50" :
                  "text-gray-600 hover:bg-gray-50"
                }`}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 animate-fadeInUp delay-100">

          {/* ── Business Profile ── */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="font-bold text-gray-900">Business Profile</h2>
                <p className="text-sm text-gray-500">Shown on your public booking page.</p>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Business Logo</label>
                  <div className="flex items-center gap-4">
                    {logo ? (
                      <img src={logo} alt="Logo" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-gray-200 shadow-sm" />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <span className="text-white text-3xl font-extrabold">
                          {profile.businessName.charAt(0) || "D"}
                        </span>
                      </div>
                    )}
                    <div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <button type="button" onClick={() => logoInputRef.current?.click()}
                        className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-blue-300 transition-all">
                        Upload Logo
                      </button>
                      {logo && (
                        <button type="button" onClick={() => setLogo(undefined)}
                          className="ml-2 px-4 py-2 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
                          Remove
                        </button>
                      )}
                      <p className="text-xs text-gray-400 mt-1.5">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { key: "businessName", label: "Business Name", placeholder: "Mike's Mobile Detailing" },
                    { key: "name",         label: "Your Name",     placeholder: "Mike Anderson" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input type="text" required value={profile[key as keyof typeof profile] as string}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={placeholder} className={inputCls} />
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { key: "email", label: "Email",        type: "email", placeholder: "you@example.com" },
                    { key: "phone", label: "Phone Number", type: "tel",   placeholder: "(555) 123-4567" },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input type={type} value={profile[key as keyof typeof profile] as string}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={placeholder} className={inputCls} />
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">City / Address</label>
                    <input type="text" value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      placeholder="Austin, TX 78701" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Years in Business</label>
                    <input type="number" min="0" max="50" value={profile.yearsInBusiness}
                      onChange={(e) => setProfile({ ...profile, yearsInBusiness: e.target.value })}
                      placeholder="8" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Business Bio</label>
                  <textarea rows={3} value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Tell customers about your business, experience, and what makes you special..."
                    className={`${inputCls} resize-none`} />
                </div>

                {/* Social Media */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Social Media & Web</label>
                  <div className="space-y-3">
                    {[
                      { key: "instagram", label: "Instagram", prefix: "@", placeholder: "yourbusiness" },
                      { key: "facebook",  label: "Facebook",  prefix: "fb/", placeholder: "yourbusiness" },
                      { key: "website",   label: "Website",   prefix: "https://", placeholder: "yourbusiness.com" },
                    ].map(({ key, label, prefix, placeholder }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-28 text-xs font-semibold text-gray-500 flex-shrink-0">{label}</span>
                        <div className="flex flex-1 items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                          <span className="px-3 py-3 bg-gray-50 text-gray-400 text-xs border-r border-gray-200 flex-shrink-0">{prefix}</span>
                          <input type="text" value={profile[key as keyof typeof profile] as string}
                            onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                            placeholder={placeholder}
                            className="flex-1 px-3 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service Areas */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Service Areas</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {serviceAreas.map((area) => (
                      <span key={area} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-full">
                        {area}
                        <button type="button" onClick={() => setServiceAreas(serviceAreas.filter((a) => a !== area))}
                          className="text-blue-400 hover:text-blue-700 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newArea} onChange={(e) => setNewArea(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addServiceArea())}
                      placeholder="Add a city (e.g. Round Rock)"
                      className={`${inputCls} flex-1`} />
                    <button type="button" onClick={addServiceArea}
                      className="px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm flex-shrink-0">
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20">
                    Save Profile
                  </button>
                  {saved === "profile" && <SavedBadge />}
                </div>
              </form>
            </div>
          )}

          {/* ── Business Hours ── */}
          {activeTab === "hours" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="font-bold text-gray-900">Business Hours</h2>
                <p className="text-sm text-gray-500">Shown on your public booking page so customers know when you&apos;re available.</p>
              </div>
              <form onSubmit={handleSaveHours} className="p-6 space-y-3">
                {DAYS.map((day) => {
                  const h = hours[day];
                  return (
                    <div key={day} className={`flex flex-wrap items-center gap-3 p-4 rounded-2xl border transition-all ${h.closed ? "bg-gray-50 border-gray-100" : "bg-blue-50/40 border-blue-100"}`}>
                      <div className="w-24 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-700 capitalize">{day}</span>
                      </div>
                      <Toggle value={!h.closed} onChange={(v) => setHours({ ...hours, [day]: { ...h, closed: !v } })} />
                      <span className={`text-xs font-semibold ${h.closed ? "text-gray-400" : "text-green-600"}`}>
                        {h.closed ? "Closed" : "Open"}
                      </span>
                      {!h.closed && (
                        <>
                          <select value={h.open} onChange={(e) => setHours({ ...hours, [day]: { ...h, open: e.target.value } })}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            {["6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM"].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <span className="text-gray-400 text-sm">to</span>
                          <select value={h.close} onChange={(e) => setHours({ ...hours, [day]: { ...h, close: e.target.value } })}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            {["1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM"].map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20">
                    Save Hours
                  </button>
                  {saved === "hours" && <SavedBadge />}
                </div>
              </form>
            </div>
          )}

          {/* ── Booking Settings ── */}
          {activeTab === "booking" && (
            <div className="space-y-5">
              <form onSubmit={handleSaveBookingSettings} className="space-y-5">

                {/* Service Type */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="font-bold text-gray-900">Service Type</h2>
                    <p className="text-sm text-gray-500">How do you serve your customers? This controls what customers see on your booking page.</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        {
                          value: "mobile",
                          label: "Mobile Service",
                          desc: "You go to the customer's location. Customers enter their address when booking.",
                          icon: (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          ),
                        },
                        {
                          value: "shop",
                          label: "Shop / Fixed Location",
                          desc: "Customers come to you. Your shop address is shown on the booking page.",
                          icon: (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          ),
                        },
                        {
                          value: "both",
                          label: "Both Options",
                          desc: "Customers choose: mobile service or come to your shop.",
                          icon: (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          ),
                        },
                      ].map(({ value, label, desc, icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setServiceType(value as "mobile" | "shop" | "both")}
                          className={`text-left p-4 rounded-2xl border-2 transition-all ${
                            serviceType === value
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className={`mb-2 ${serviceType === value ? "text-blue-600" : "text-gray-400"}`}>
                            {icon}
                          </div>
                          <p className={`text-sm font-bold mb-1 ${serviceType === value ? "text-blue-700" : "text-gray-800"}`}>{label}</p>
                          <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                          {serviceType === value && (
                            <div className="mt-2 flex items-center gap-1 text-blue-600 text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Selected
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {serviceType === "shop" && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                        Make sure your shop address is filled in under <strong>Business Profile → City / Address</strong> so customers can see it on your booking page.
                      </div>
                    )}
                  </div>
                </div>

                {/* Deposit Settings */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="font-bold text-gray-900">Deposit Settings</h2>
                    <p className="text-sm text-gray-500">Require a deposit to confirm bookings and reduce no-shows.</p>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Require Deposit</p>
                        <p className="text-xs text-gray-500 mt-0.5">Customers must pay a deposit to confirm their booking</p>
                      </div>
                      <Toggle
                        value={bookingSettings.requireDeposit}
                        onChange={(v) => setBookingSettings({ ...bookingSettings, requireDeposit: v })}
                      />
                    </div>
                    {bookingSettings.requireDeposit && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Deposit Percentage</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range" min="10" max="100" step="5"
                            value={bookingSettings.depositPercentage}
                            onChange={(e) => setBookingSettings({ ...bookingSettings, depositPercentage: Number(e.target.value) })}
                            className="flex-1"
                          />
                          <span className="text-lg font-extrabold text-blue-600 w-14 text-right">{bookingSettings.depositPercentage}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">e.g. for a $200 service, deposit = ${Math.round(200 * bookingSettings.depositPercentage / 100)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Booking Page Options */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="font-bold text-gray-900">Booking Page Options</h2>
                    <p className="text-sm text-gray-500">Control what appears on your public booking page.</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Advance Booking (days)</label>
                      <input
                        type="number" min="1" max="365"
                        value={bookingSettings.advanceBookingDays}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, advanceBookingDays: Number(e.target.value) })}
                        className={inputCls}
                      />
                      <p className="text-xs text-gray-400 mt-1">How far in advance customers can book</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Custom Welcome Message</label>
                      <textarea
                        rows={2}
                        value={bookingSettings.customMessage}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, customMessage: e.target.value })}
                        placeholder="e.g. Book online 24/7 — deposits required to confirm."
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                    {[
                      { key: "showRating",       label: "Show Rating & Reviews" },
                      { key: "showSocialLinks",   label: "Show Social Media Links" },
                      { key: "showServiceAreas",  label: "Show Service Areas" },
                      { key: "showBusinessHours", label: "Show Business Hours" },
                      { key: "showTrustBadges",   label: "Show Trust Badges" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between py-1">
                        <p className="text-sm text-gray-700">{label}</p>
                        <Toggle
                          value={bookingSettings[key as keyof typeof bookingSettings] as boolean}
                          onChange={(v) => setBookingSettings({ ...bookingSettings, [key]: v })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20">
                    Save Booking Settings
                  </button>
                  {saved === "booking" && <SavedBadge />}
                </div>
              </form>
            </div>
          )}

          {/* ── SMS & Email Templates ── */}
          {activeTab === "templates" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="font-bold text-gray-900">SMS & Email Templates</h2>
                <p className="text-sm text-gray-500">Customize the messages sent to your customers. Use placeholders like <code className="bg-gray-100 px-1 rounded text-xs">{"{{customer_name}}"}</code> for dynamic content.</p>
              </div>
              <form onSubmit={handleSaveTemplates} className="p-6 space-y-6">
                {/* Available Variables */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wide">Available Variables</p>
                  <div className="flex flex-wrap gap-2">
                    {["{{customer_name}}", "{{service_name}}", "{{date}}", "{{time}}", "{{vehicle}}", "{{price}}", "{{deposit}}", "{{business_name}}", "{{booking_link}}"].map((v) => (
                      <span key={v} className="bg-white text-blue-600 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border border-blue-200">{v}</span>
                    ))}
                  </div>
                </div>

                {/* SMS Templates */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">SMS Templates</h3>
                    <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Pro</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "bookingConfirmation" as const, label: "Booking Confirmation", desc: "Sent when a booking is confirmed" },
                      { key: "reminder24h" as const, label: "24-Hour Reminder", desc: "Sent 24 hours before the appointment" },
                      { key: "followUp" as const, label: "Follow-Up / Review Request", desc: "Sent after the job is completed" },
                    ].map(({ key, label, desc }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
                        <p className="text-xs text-gray-400 mb-1.5">{desc}</p>
                        <textarea
                          rows={2}
                          value={smsTemplates[key]}
                          onChange={(e) => setSmsTemplates({ ...smsTemplates, [key]: e.target.value })}
                          className={`${inputCls} resize-none font-mono text-xs`}
                        />
                        <p className="text-xs text-gray-400 mt-1">{smsTemplates[key].length}/160 characters</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email Templates */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">Email Templates</h3>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "bookingConfirmation" as const, label: "Booking Confirmation Email", desc: "Sent when a booking is confirmed" },
                      { key: "reminder24h" as const, label: "24-Hour Reminder Email", desc: "Sent 24 hours before the appointment" },
                      { key: "followUp" as const, label: "Follow-Up Email", desc: "Sent after the job is completed" },
                    ].map(({ key, label, desc }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
                        <p className="text-xs text-gray-400 mb-1.5">{desc}</p>
                        <textarea
                          rows={5}
                          value={emailTemplates[key]}
                          onChange={(e) => setEmailTemplates({ ...emailTemplates, [key]: e.target.value })}
                          className={`${inputCls} resize-none font-mono text-xs`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20">
                    Save Templates
                  </button>
                  {saved === "templates" && <SavedBadge />}
                </div>
              </form>
            </div>
          )}

          {/* ── Integrations ── */}
          {activeTab === "integrations" && <GoogleCalendarSection userPlan={user?.plan} />}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="font-bold text-gray-900">Notification Preferences</h2>
                <p className="text-sm text-gray-500">Choose how you and your customers get notified.</p>
              </div>
              <div className="p-6 space-y-4">
                {[
                  {
                    key: "emailReminders", label: "Email Reminders", pro: false,
                    desc: "Send email reminders to customers 24 hours before their appointment.",
                    value: notifications.emailReminders,
                    onChange: (v: boolean) => setNotifications({ ...notifications, emailReminders: v }),
                  },
                  { key: "sms",  label: "SMS Reminders",          pro: true,  desc: "Send SMS text reminders (requires Pro plan + Twilio setup).", value: false, onChange: () => {} },
                  { key: "newb", label: "New Booking Alerts",     pro: false, desc: "Get notified instantly when a new booking comes in.", value: true,  onChange: () => {} },
                  { key: "rev",  label: "Review Request Emails",  pro: true,  desc: "Automatically ask customers for a Google review after job completion.", value: false, onChange: () => {} },
                ].map(({ key, label, desc, pro, value, onChange }) => (
                  <div key={key} className={`flex items-start justify-between gap-4 p-4 rounded-2xl border ${pro ? "bg-gray-50 border-gray-100" : "border-gray-100"}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900">{label}</p>
                        {pro && <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Pro</span>}
                      </div>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                    <Toggle value={value} onChange={pro ? () => {} : onChange} />
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={handleSaveNotifications}
                    className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20">
                    Save Preferences
                  </button>
                  {saved === "notifications" && <SavedBadge />}
                </div>
              </div>
            </div>
          )}

          {/* ── Danger Zone ── */}
          {activeTab === "danger" && (
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-red-100 bg-red-50 rounded-t-2xl">
                <h2 className="font-bold text-red-700">Danger Zone</h2>
                <p className="text-sm text-red-500">Irreversible actions. Be careful.</p>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between p-5 border-2 border-red-100 rounded-2xl bg-red-50/30">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Delete Account</p>
                    <p className="text-xs text-gray-500 mt-0.5">Permanently delete all data including bookings, packages, and settings.</p>
                  </div>
                  <button onClick={() => setShowDeleteModal(true)}
                    className="ml-4 flex-shrink-0 bg-red-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-red-700 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <DashboardHelp page="settings" />

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 animate-scaleIn">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 text-center mb-2">Delete Account?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">
              All your bookings, packages, and settings will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-md shadow-red-600/30">
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

  const handleConnect = () => {
    window.location.href = "/api/google-calendar/connect";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
    if (res.ok) setStatus({ connected: false });
    setDisconnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
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
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="font-bold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500">Connect external services to sync your schedule.</p>
      </div>

      <div className="p-6">
        {/* Google Calendar */}
        <div className="border border-gray-100 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5" />
                <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5" />
                <path d="M8 4V2M16 4V2" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="7" y="12" width="3" height="3" rx="0.5" fill="#EA4335" />
                <rect x="14" y="12" width="3" height="3" rx="0.5" fill="#34A853" />
                <rect x="7" y="17" width="3" height="2" rx="0.5" fill="#FBBC04" />
                <rect x="14" y="17" width="3" height="2" rx="0.5" fill="#4285F4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900">Google Calendar</h3>
                {!isPro && (
                  <span className="text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full">PRO</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Sync your bookings automatically to Google Calendar. New bookings will appear on your calendar.
              </p>

              {!isPro ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-sm text-blue-700 font-medium">
                    Upgrade to Pro to connect Google Calendar and sync your bookings automatically.
                  </p>
                  <a href="/dashboard/billing"
                    className="inline-block mt-2 text-sm font-bold text-blue-600 hover:text-blue-700">
                    Upgrade to Pro &rarr;
                  </a>
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Checking connection...
                </div>
              ) : status?.connected ? (
                <div className="space-y-3">
                  {gcalParam === "success" && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Google Calendar connected successfully!
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                    <span className="text-sm font-semibold text-green-700">Connected</span>
                    {status.calendarId && (
                      <span className="text-xs text-gray-400">({status.calendarId})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleSync} disabled={syncing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
                      {syncing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync Now
                        </>
                      )}
                    </button>
                    <button onClick={handleDisconnect} disabled={disconnecting}
                      className="px-4 py-2 border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                      {disconnecting ? "Disconnecting..." : "Disconnect"}
                    </button>
                  </div>
                  {syncResult && (
                    <div className={`text-sm font-medium mt-2 ${syncResult.errors > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {syncResult.synced} booking{syncResult.synced !== 1 ? "s" : ""} synced to Google Calendar
                      {syncResult.errors > 0 && ` (${syncResult.errors} failed)`}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {gcalParam === "error" && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 font-medium">
                      Failed to connect Google Calendar. Please try again.
                    </div>
                  )}
                  <button onClick={handleConnect}
                    className="flex items-center gap-3 px-5 py-3 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-700">Connect Google Calendar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
