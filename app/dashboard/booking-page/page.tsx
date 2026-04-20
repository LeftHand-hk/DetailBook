"use client";

import { useState, useEffect, useRef } from "react";
import { getUser, setUser } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

const INPUT_CLASS =
  "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all placeholder-gray-300";

const PRESET_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Emerald", value: "#10B981" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Red", value: "#EF4444" },
  { name: "Pink", value: "#EC4899" },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        value ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
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

export default function BookingPagePage() {
  const [user, setUserState] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);

  // Booking page state
  const [slug, setSlug] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [bookingPageTheme, setBookingPageTheme] = useState<"light" | "dark" | "auto">("light");
  const [accentColor, setAccentColor] = useState("#3B82F6");
  const [bookingPageTitle, setBookingPageTitle] = useState("");
  const [bookingPageSubtitle, setBookingPageSubtitle] = useState("Book your appointment online");
  const [showRating, setShowRating] = useState(true);
  const [showSocialLinks, setShowSocialLinks] = useState(true);
  const [showServiceAreas, setShowServiceAreas] = useState(true);
  const [showBusinessHours, setShowBusinessHours] = useState(true);
  const [showTrustBadges, setShowTrustBadges] = useState(true);
  const [thankYouMessage, setThankYouMessage] = useState("");
  const [termsText, setTermsText] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [bannerImage, setBannerImage] = useState<string | undefined>(undefined);
  const [bannerOverlayOpacity, setBannerOverlayOpacity] = useState(60);
  const [serviceLayout, setServiceLayout] = useState<"cards" | "list" | "compact" | "featured" | "minimal">("cards");
  const bannerInputRef = useRef<HTMLInputElement>(null);
  // Business Profile state
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState<number | "">(0);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [serviceAreasText, setServiceAreasText] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUserState(u);
      setSlug(u.slug || "");
      setCustomMessage(u.customMessage || "");
      setAdvanceBookingDays(u.advanceBookingDays || 30);
      setBookingPageTheme(u.bookingPageTheme || "light");
      setAccentColor(u.accentColor || "#3B82F6");
      setBookingPageTitle(u.bookingPageTitle || "");
      setBookingPageSubtitle(u.bookingPageSubtitle || "Book your appointment online");
      setShowRating(u.showRating !== false);
      setShowSocialLinks(u.showSocialLinks !== false);
      setShowServiceAreas(u.showServiceAreas !== false);
      setShowBusinessHours(u.showBusinessHours !== false);
      setShowTrustBadges(u.showTrustBadges !== false);
      setThankYouMessage(u.thankYouMessage || "");
      setTermsText(u.termsText || "");
      setInstagram(u.instagram || "");
      setFacebook(u.facebook || "");
      setWebsite(u.website || "");
      setPhone(u.phone || "");
      setBannerImage(u.bannerImage);
      setBannerOverlayOpacity(u.bannerOverlayOpacity ?? 60);
      setServiceLayout(u.serviceLayout || "cards");
      setBusinessName(u.businessName || "");
      setOwnerName(u.name || "");
      setBio(u.bio || "");
      setAddress(u.address || "");
      setYearsInBusiness(u.yearsInBusiness || 0);
      setLogo(u.logo);
      setServiceAreasText((u.serviceAreas || []).join(", "));
    }
    setTimeout(() => { initialLoadDone.current = true; }, 100);
  }, []);

  // Auto-save on any change after initial load
  useEffect(() => {
    if (!initialLoadDone.current || !user) return;
    setHasChanges(true);
    const timer = setTimeout(() => {
      const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const updated: User = {
        ...user,
        slug: sanitizedSlug,
        customMessage,
        advanceBookingDays,
        bookingPageTheme,
        accentColor,
        bookingPageTitle,
        bookingPageSubtitle,
        showRating,
        showSocialLinks,
        showServiceAreas,
        showBusinessHours,
        showTrustBadges,
        thankYouMessage,
        termsText,
        instagram,
        facebook,
        website,
        phone,
        bannerImage,
        bannerOverlayOpacity,
        serviceLayout,
        businessName,
        name: ownerName,
        bio,
        address,
        yearsInBusiness: yearsInBusiness === "" ? 0 : yearsInBusiness,
        logo,
        serviceAreas: serviceAreasText.split(",").map((s) => s.trim()).filter(Boolean),
      };
      setUser(updated);
      setUserState(updated);
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, customMessage, advanceBookingDays, bookingPageTheme, accentColor, bookingPageTitle, bookingPageSubtitle, showRating, showSocialLinks, showServiceAreas, showBusinessHours, showTrustBadges, thankYouMessage, termsText, instagram, facebook, website, phone, bannerImage, bannerOverlayOpacity, serviceLayout, businessName, ownerName, bio, address, yearsInBusiness, logo, serviceAreasText]);

  const isPro = user?.plan === "pro";

  if (!user) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading booking page settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Booking Page</h1>
          <p className="text-sm text-gray-500 mt-1">Customize your public booking page</p>
        </div>
        <a
          href={`/book/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Preview
        </a>
      </div>

      {/* ── Card: Business Profile ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Business Profile</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Logo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setLogo(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }} />
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Logo
                </button>
                {logo && (
                  <button type="button" onClick={() => setLogo(undefined)}
                    className="px-4 py-2 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors text-left">
                    Remove
                  </button>
                )}
                <p className="text-xs text-gray-400">Recommended: 200×200px. PNG or JPG.</p>
              </div>
            </div>
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Elite Auto Detailing"
              className={INPUT_CLASS}
            />
          </div>

          {/* Owner Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. John Smith"
              className={INPUT_CLASS}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Business Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Los Angeles, CA"
              className={INPUT_CLASS}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">About Your Business</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell customers about your business, your experience, and what makes you different..."
              className={INPUT_CLASS + " resize-none"}
            />
          </div>

          {/* Years in Business */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Years in Business</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                value={yearsInBusiness}
                onChange={(e) => setYearsInBusiness(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                className={INPUT_CLASS + " max-w-[120px]"}
              />
              <span className="text-sm text-gray-500 font-medium">years</span>
            </div>
          </div>

          {/* Service Areas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Service Areas</label>
            <input
              type="text"
              value={serviceAreasText}
              onChange={(e) => setServiceAreasText(e.target.value)}
              placeholder="e.g. Los Angeles, Beverly Hills, Santa Monica"
              className={INPUT_CLASS}
            />
            <p className="text-xs text-gray-400 mt-1.5">Separate multiple areas with commas.</p>
          </div>
        </div>
      </div>

      {/* ── Card 1: URL ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">URL</h2>
        </div>
        <div className="p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Booking Page URL</label>
          <div className="flex items-center gap-0">
            <span className="inline-flex items-center px-4 py-3 bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl text-sm text-gray-500 font-medium whitespace-nowrap">
              detailbook.app/book/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="your-business-name"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all placeholder-gray-300"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">Only lowercase letters, numbers, and hyphens. Other characters will be converted.</p>
        </div>
      </div>

      {/* ── Card: Hero Banner ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Hero Banner</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Banner Preview */}
          <div className="relative rounded-xl overflow-hidden h-48 bg-gray-900">
            {bannerImage ? (
              <img src={bannerImage} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-blue-900" />
            )}
            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0, 0, 0, ${bannerOverlayOpacity / 100})` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white font-bold text-lg">{bannerImage ? "Banner Preview" : "No banner uploaded"}</p>
            </div>
          </div>

          {/* Upload */}
          <div className="flex items-center gap-3">
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => setBannerImage(ev.target?.result as string);
                reader.readAsDataURL(file);
              }} />
            <button type="button" onClick={() => bannerInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Banner
            </button>
            {bannerImage && (
              <button type="button" onClick={() => setBannerImage(undefined)}
                className="px-4 py-2.5 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">Recommended: 1200×400px or wider. JPG or PNG.</p>

          {/* Overlay Opacity Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Overlay Opacity</label>
              <span className="text-sm font-bold text-blue-600">{bannerOverlayOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={bannerOverlayOpacity}
              onChange={(e) => setBannerOverlayOpacity(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0% (no overlay)</span>
              <span>90% (very dark)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card: Service Layout ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Service Layout</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">Choose how your services are displayed to customers.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* Cards Layout */}
            <button
              type="button"
              onClick={() => setServiceLayout("cards")}
              className={`relative rounded-xl border-2 p-4 transition-all duration-200 text-left ${
                serviceLayout === "cards"
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {serviceLayout === "cards" && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              {/* Mini preview */}
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <div className="h-10 bg-gray-200 rounded-md" />
                <div className="h-10 bg-gray-200 rounded-md" />
                <div className="h-10 bg-gray-200 rounded-md" />
                <div className="h-10 bg-gray-200 rounded-md" />
              </div>
              <p className="text-xs font-bold text-gray-900">Cards</p>
              <p className="text-[10px] text-gray-500">2-column grid with icons</p>
            </button>

            {/* List Layout */}
            <button
              type="button"
              onClick={() => setServiceLayout("list")}
              className={`relative rounded-xl border-2 p-4 transition-all duration-200 text-left ${
                serviceLayout === "list"
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {serviceLayout === "list" && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              {/* Mini preview */}
              <div className="space-y-1.5 mb-3">
                <div className="h-6 bg-gray-200 rounded-md" />
                <div className="h-6 bg-gray-200 rounded-md" />
                <div className="h-6 bg-gray-200 rounded-md" />
              </div>
              <p className="text-xs font-bold text-gray-900">List</p>
              <p className="text-[10px] text-gray-500">Full-width rows</p>
            </button>

            {/* Compact Layout (Pro) */}
            <button
              type="button"
              onClick={() => isPro && setServiceLayout("compact")}
              className={`relative rounded-xl border-2 p-4 transition-all duration-200 text-left ${
                !isPro ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" :
                serviceLayout === "compact"
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {serviceLayout === "compact" && isPro && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              {!isPro && (
                <div className="absolute top-2 right-2 text-[8px] font-bold bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</div>
              )}
              <div className="space-y-1 mb-3">
                <div className="flex gap-1"><div className="w-5 h-5 bg-gray-200 rounded" /><div className="flex-1 h-5 bg-gray-200 rounded" /></div>
                <div className="flex gap-1"><div className="w-5 h-5 bg-gray-200 rounded" /><div className="flex-1 h-5 bg-gray-200 rounded" /></div>
                <div className="flex gap-1"><div className="w-5 h-5 bg-gray-200 rounded" /><div className="flex-1 h-5 bg-gray-200 rounded" /></div>
                <div className="flex gap-1"><div className="w-5 h-5 bg-gray-200 rounded" /><div className="flex-1 h-5 bg-gray-200 rounded" /></div>
              </div>
              <p className="text-xs font-bold text-gray-900">Compact</p>
              <p className="text-[10px] text-gray-500">Minimal rows</p>
            </button>

            {/* Featured Layout (Pro) */}
            <button
              type="button"
              onClick={() => isPro && setServiceLayout("featured")}
              className={`relative rounded-xl border-2 p-3 transition-all duration-200 text-left ${
                !isPro ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" :
                serviceLayout === "featured"
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {serviceLayout === "featured" && isPro && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              {!isPro && (
                <div className="absolute top-2 right-2 text-[8px] font-bold bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</div>
              )}
              <div className="mb-3">
                <div className="h-12 bg-gray-200 rounded-md mb-1.5" />
                <div className="grid grid-cols-2 gap-1">
                  <div className="h-7 bg-gray-200 rounded-md" />
                  <div className="h-7 bg-gray-200 rounded-md" />
                </div>
              </div>
              <p className="text-xs font-bold text-gray-900">Featured</p>
              <p className="text-[10px] text-gray-500">Hero + grid</p>
            </button>

            {/* Minimal Layout (Pro) */}
            <button
              type="button"
              onClick={() => isPro && setServiceLayout("minimal")}
              className={`relative rounded-xl border-2 p-3 transition-all duration-200 text-left ${
                !isPro ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" :
                serviceLayout === "minimal"
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {serviceLayout === "minimal" && isPro && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              {!isPro && (
                <div className="absolute top-2 right-2 text-[8px] font-bold bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</div>
              )}
              <div className="space-y-1.5 mb-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-1 bg-gray-100 rounded" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-1 bg-gray-100 rounded" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
              <p className="text-xs font-bold text-gray-900">Minimal</p>
              <p className="text-[10px] text-gray-500">Text only, clean</p>
            </button>
          </div>
        </div>
      </div>

      {/* ── Card 2: Appearance ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Appearance</h2>
        </div>
        <div className="p-6 space-y-6">
          {/* Theme */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Theme</label>
            <div className="flex gap-2">
              {(["light", "dark", "auto"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setBookingPageTheme(theme)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    bookingPageTheme === theme
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {theme === "light" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                  {theme === "dark" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  {theme === "auto" && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Accent Color</label>
            <div className="flex items-center gap-3 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  title={color.name}
                  onClick={() => setAccentColor(color.value)}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${
                    accentColor === color.value
                      ? "border-gray-900 scale-110 shadow-md"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
              <div className="relative">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 w-9 h-9 opacity-0 cursor-pointer"
                />
                <div
                  className={`w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors cursor-pointer ${
                    !PRESET_COLORS.some((c) => c.value === accentColor) ? "ring-2 ring-gray-900 ring-offset-2" : ""
                  }`}
                  style={{
                    backgroundColor: !PRESET_COLORS.some((c) => c.value === accentColor) ? accentColor : "transparent",
                  }}
                >
                  {PRESET_COLORS.some((c) => c.value === accentColor) && (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Page Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Page Title</label>
            <input
              type="text"
              value={bookingPageTitle}
              onChange={(e) => setBookingPageTitle(e.target.value)}
              placeholder="e.g. Book Your Detail"
              className={INPUT_CLASS}
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Subtitle</label>
            <input
              type="text"
              value={bookingPageSubtitle}
              onChange={(e) => setBookingPageSubtitle(e.target.value)}
              placeholder="e.g. Book your appointment online"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      {/* ── Card 3: Content Visibility ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Content Visibility</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: "Show Star Rating", value: showRating, setter: setShowRating },
            { label: "Show Social Links", value: showSocialLinks, setter: setShowSocialLinks },
            { label: "Show Service Areas", value: showServiceAreas, setter: setShowServiceAreas },
            { label: "Show Business Hours", value: showBusinessHours, setter: setShowBusinessHours },
            { label: "Show Trust Badges", value: showTrustBadges, setter: setShowTrustBadges },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <Toggle value={item.value} onChange={item.setter} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Card: Social & Contact Links ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Social & Contact Links</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: "Phone", value: phone, setter: setPhone, prefix: "", placeholder: "(555) 123-4567", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /> },
            { label: "Instagram", value: instagram, setter: setInstagram, prefix: "@", placeholder: "yourbusiness", icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />, fill: true },
            { label: "Facebook", value: facebook, setter: setFacebook, prefix: "fb.com/", placeholder: "yourbusiness", icon: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />, fill: true },
            { label: "Website", value: website, setter: setWebsite, prefix: "https://", placeholder: "yourbusiness.com", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /> },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill={item.fill ? "currentColor" : "none"} stroke={item.fill ? "none" : "currentColor"} viewBox="0 0 24 24">{item.icon}</svg>
              </div>
              <div className="flex-1 flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                {item.prefix && (
                  <span className="px-3 py-3 bg-gray-50 text-gray-400 text-xs border-r border-gray-200 flex-shrink-0">{item.prefix}</span>
                )}
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  placeholder={item.placeholder}
                  className="flex-1 px-3 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300"
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">These links appear on your public booking page header.</p>
        </div>
      </div>

      {/* ── Card 4: Booking Rules ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Booking Rules</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Advance Booking Window */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Advance Booking Window</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={365}
                value={advanceBookingDays}
                onChange={(e) => setAdvanceBookingDays(Math.max(1, Number(e.target.value)))}
                className={INPUT_CLASS + " max-w-[120px]"}
              />
              <span className="text-sm text-gray-500 font-medium">days in advance</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 5: Messages ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-base">Messages</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Welcome Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Welcome Message</label>
            <textarea
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="A welcome message shown at the top of your booking page..."
              className={INPUT_CLASS + " resize-none"}
            />
          </div>

          {/* Thank You Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Thank You Message</label>
            <textarea
              rows={3}
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder="Shown after a customer completes a booking..."
              className={INPUT_CLASS + " resize-none"}
            />
          </div>

          {/* Terms & Conditions */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</label>
            <textarea
              rows={4}
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              placeholder="Optional terms and conditions shown on the booking page..."
              className={INPUT_CLASS + " resize-none"}
            />
          </div>
        </div>
      </div>

      {/* Spacer for sticky bar */}
      <div className="h-16" />

      {/* ── Sticky Auto-Save Status Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:left-[260px]">
        <div className={`border-t transition-all duration-300 ${
          hasChanges ? "bg-amber-50 border-amber-200" : saved ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
        }`}>
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {hasChanges ? (
                <>
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-amber-700">Saving changes...</span>
                </>
              ) : saved ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-700">All changes saved</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-500">Auto-saves as you edit</span>
                </>
              )}
            </div>
            <a href={`/book/${slug}`} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5">
              Preview page
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        </div>
      </div>

      {/* ── Help ── */}
      <DashboardHelp page="settings" />
    </div>
  );
}
