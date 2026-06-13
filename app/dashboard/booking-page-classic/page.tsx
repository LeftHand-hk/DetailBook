"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUser, setUserLocal } from "@/lib/storage";
import { compressAndUploadImage } from "@/lib/image-upload";
import DashboardHelp from "@/components/DashboardHelp";
import PhotoGalleryEditor from "@/components/PhotoGalleryEditor";
import ReviewsEditor from "@/components/ReviewsEditor";

// ──────────────────────────────────────────────────────────────────────────
// Classic booking-page editor.
//
// Clean save model (this file was rewritten to kill the recurring HTTP 504s):
//   • All editable fields live in ONE `form` object, mutated through update().
//   • Saving sends a SMALL targeted PATCH to PUT /api/user — never the whole
//     user, never the bookings array, and never a base64 image unless the
//     owner just changed it. Re-sending the loaded base64 logo/banner on every
//     keystroke is exactly what blew past the serverless timeout before.
//   • One save can be in flight at a time (savingRef). Edits made while a save
//     runs are coalesced and flushed once it returns — so fast typing can
//     never fan out into a pile of concurrent PUTs that exhaust the DB pool.
//   • No storage.setUser() whole-user background PUT, no syncFromServer race.
//     The dashboard layout already syncs; we just update the local cache.
// ──────────────────────────────────────────────────────────────────────────

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

type EditorTab = "profile" | "branding" | "services" | "media" | "messages";

const EDITOR_TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: "profile",  label: "Profile",  icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  { id: "branding", label: "Branding", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg> },
  { id: "services", label: "Layout",   icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
  { id: "media",    label: "Media",    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  { id: "messages", label: "Messages", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
];

type ServiceLayout = "cards" | "list" | "compact" | "featured" | "minimal";
type Theme = "light" | "dark" | "auto";
type GalleryLayout = "grid" | "carousel" | "masonry";
type ReviewsLayoutT = "carousel" | "grid" | "list";

interface Form {
  slug: string;
  businessName: string;
  name: string;
  bio: string;
  address: string;
  yearsInBusiness: number | "";
  serviceAreas: string; // comma-separated text in the form; split on save
  logo?: string;
  bannerImage?: string;
  bannerOverlayOpacity: number;
  serviceLayout: ServiceLayout;
  bookingPageTheme: Theme;
  accentColor: string;
  bookingPageTitle: string;
  bookingPageSubtitle: string;
  showRating: boolean;
  showSocialLinks: boolean;
  showServiceAreas: boolean;
  showBusinessHours: boolean;
  showTrustBadges: boolean;
  phone: string;
  instagram: string;
  facebook: string;
  website: string;
  customMessage: string;
  thankYouMessage: string;
  termsText: string;
  advanceBookingDays: number;
  galleryLayout: GalleryLayout;
  galleryShowTitle: boolean;
  galleryTitle: string;
  reviewsLayout: ReviewsLayoutT;
  reviewsShowStars: boolean;
  reviewsShowAvatars: boolean;
  reviewsShowDates: boolean;
}

const EMPTY_FORM: Form = {
  slug: "", businessName: "", name: "", bio: "", address: "", yearsInBusiness: 0,
  serviceAreas: "", logo: undefined, bannerImage: undefined, bannerOverlayOpacity: 60,
  serviceLayout: "cards", bookingPageTheme: "light", accentColor: "#3B82F6",
  bookingPageTitle: "", bookingPageSubtitle: "Book your appointment online",
  showRating: true, showSocialLinks: true, showServiceAreas: true, showBusinessHours: true, showTrustBadges: true,
  phone: "", instagram: "", facebook: "", website: "",
  customMessage: "", thankYouMessage: "", termsText: "", advanceBookingDays: 30,
  galleryLayout: "grid", galleryShowTitle: true, galleryTitle: "Our Work",
  reviewsLayout: "carousel", reviewsShowStars: true, reviewsShowAvatars: true, reviewsShowDates: true,
};

function formFromUser(u: any): Form {
  return {
    slug: u.slug || "",
    businessName: u.businessName || "",
    name: u.name || "",
    bio: u.bio || "",
    address: u.address || "",
    yearsInBusiness: u.yearsInBusiness || 0,
    serviceAreas: Array.isArray(u.serviceAreas) ? u.serviceAreas.join(", ") : "",
    logo: u.logo || undefined,
    bannerImage: u.bannerImage || undefined,
    bannerOverlayOpacity: u.bannerOverlayOpacity ?? 60,
    serviceLayout: u.serviceLayout || "cards",
    bookingPageTheme: u.bookingPageTheme || "light",
    accentColor: u.accentColor || "#3B82F6",
    bookingPageTitle: u.bookingPageTitle || "",
    bookingPageSubtitle: u.bookingPageSubtitle || "Book your appointment online",
    showRating: u.showRating !== false,
    showSocialLinks: u.showSocialLinks !== false,
    showServiceAreas: u.showServiceAreas !== false,
    showBusinessHours: u.showBusinessHours !== false,
    showTrustBadges: u.showTrustBadges !== false,
    phone: u.phone || "",
    instagram: u.instagram || "",
    facebook: u.facebook || "",
    website: u.website || "",
    customMessage: u.customMessage || "",
    thankYouMessage: u.thankYouMessage || "",
    termsText: u.termsText || "",
    advanceBookingDays: u.advanceBookingDays || 30,
    galleryLayout: u.galleryLayout || "grid",
    galleryShowTitle: u.galleryShowTitle ?? true,
    galleryTitle: u.galleryTitle || "Our Work",
    reviewsLayout: u.reviewsLayout || "carousel",
    reviewsShowStars: u.reviewsShowStars ?? true,
    reviewsShowAvatars: u.reviewsShowAvatars ?? true,
    reviewsShowDates: u.reviewsShowDates ?? true,
  };
}

// The non-image part of the save payload. Image fields are added separately,
// and only when the owner actually changed them (see save()).
function basePayload(f: Form): Record<string, unknown> {
  return {
    slug: f.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    businessName: f.businessName,
    name: f.name,
    bio: f.bio,
    address: f.address,
    yearsInBusiness: f.yearsInBusiness === "" ? 0 : f.yearsInBusiness,
    serviceAreas: f.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean),
    bannerOverlayOpacity: f.bannerOverlayOpacity,
    serviceLayout: f.serviceLayout,
    bookingPageTheme: f.bookingPageTheme,
    accentColor: f.accentColor,
    bookingPageTitle: f.bookingPageTitle,
    bookingPageSubtitle: f.bookingPageSubtitle,
    showRating: f.showRating,
    showSocialLinks: f.showSocialLinks,
    showServiceAreas: f.showServiceAreas,
    showBusinessHours: f.showBusinessHours,
    showTrustBadges: f.showTrustBadges,
    phone: f.phone,
    instagram: f.instagram,
    facebook: f.facebook,
    website: f.website,
    customMessage: f.customMessage,
    thankYouMessage: f.thankYouMessage,
    termsText: f.termsText,
    advanceBookingDays: f.advanceBookingDays,
    galleryLayout: f.galleryLayout,
    galleryShowTitle: f.galleryShowTitle,
    galleryTitle: f.galleryTitle,
    reviewsLayout: f.reviewsLayout,
    reviewsShowStars: f.reviewsShowStars,
    reviewsShowAvatars: f.reviewsShowAvatars,
    reviewsShowDates: f.reviewsShowDates,
  };
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${value ? "bg-blue-600" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export default function BookingPageClassicEditor() {
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [meta, setMeta] = useState<{ id: string; plan: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("profile");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [uploadError, setUploadError] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Mirrors of `form` + change tracking that the save fn reads without being
  // re-created on every keystroke.
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const hasEdited = useRef(false);          // gates autosave until the first real edit
  const savingRef = useRef(false);          // only one PUT in flight at a time
  const pendingRef = useRef(false);         // an edit landed mid-save → flush after
  const logoTouched = useRef(false);        // include logo in payload only if changed
  const bannerTouched = useRef(false);      // include bannerImage only if changed

  const update = useCallback((patch: Partial<Form>) => {
    hasEdited.current = true;
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  // ── Load: instant paint from cache, then authoritative ?full=1 (which
  // carries the real banner/logo base64 so they render and can be edited). ──
  useEffect(() => {
    const cached = getUser();
    if (cached) { setForm(formFromUser(cached)); setMeta({ id: (cached as any).id, plan: (cached as any).plan }); }

    let alive = true;
    fetch("/api/user?full=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.user) return;
        // Don't stomp edits the owner started typing while this was in flight.
        if (!hasEdited.current) setForm(formFromUser(data.user));
        setMeta({ id: data.user.id, plan: data.user.plan });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  // ── The single save path. Builds a small patch and PUTs it once. ──
  const save = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; }
    savingRef.current = true;
    setStatus("saving");
    setSaveError("");
    try {
      const f = formRef.current;
      const payload = basePayload(f);
      // Only ship image fields the owner actually changed this session. A
      // freshly uploaded image is a tiny storage URL (or capped base64); an
      // untouched one stays out of the payload so we never re-send a multi-MB
      // blob loaded from the DB — that was the HTTP 504.
      if (logoTouched.current) payload.logo = f.logo ?? null;
      if (bannerTouched.current) payload.bannerImage = f.bannerImage ?? null;

      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await res.json().catch(() => null as any);
      if (!res.ok) {
        setStatus("error");
        setSaveError(data?.error || `Couldn't save (HTTP ${res.status}). Please try again.`);
        return;
      }
      // Keep the local cache in step without a second whole-user PUT.
      const cached = getUser();
      if (cached) setUserLocal({ ...cached, ...payload } as any);
      logoTouched.current = false;
      bannerTouched.current = false;
      setStatus("saved");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("detailbook:setup-changed"));
      }
    } catch {
      setStatus("error");
      setSaveError("Network error — couldn't save. Check your connection and try again.");
    } finally {
      savingRef.current = false;
      // An edit arrived while we were saving — persist it now.
      if (pendingRef.current) { pendingRef.current = false; void save(); }
    }
  }, []);

  // ── Debounced autosave: fires 1s after the last edit, never on load. ──
  useEffect(() => {
    if (!loaded || !hasEdited.current) return;
    setStatus("unsaved");
    const t = setTimeout(() => { void save(); }, 1000);
    return () => clearTimeout(t);
  }, [form, loaded, save]);

  const isPro = meta?.plan === "pro";
  const ns = meta?.id || form.slug || "biz";

  const handleImage = async (file: File, key: "logo" | "bannerImage") => {
    setUploadError("");
    try {
      const url = await compressAndUploadImage(file, key, ns);
      if (key === "logo") { logoTouched.current = true; update({ logo: url }); }
      else { bannerTouched.current = true; update({ bannerImage: url }); }
    } catch (err: any) {
      const heic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
      setUploadError(heic
        ? "That looks like an iPhone HEIC photo. Open it in Photos and share/save as JPEG, then upload again."
        : (err?.message || "Could not load that image. Try a JPEG or PNG."));
    }
  };

  if (!loaded && !meta) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center min-h-[50vh]">
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
        <a href={`/book/${form.slug}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Preview
        </a>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="sticky top-0 z-10 -mx-6 px-6 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin py-2 -mb-px">
          {EDITOR_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                  active ? "bg-white border-blue-500 text-blue-700 shadow-sm" : "bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white/80"
                }`}>
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════ PROFILE ════════════════════════ */}
      {activeTab === "profile" && (<>
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
                  {form.logo ? (
                    <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImage(file, "logo"); }} />
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Logo
                  </button>
                  {form.logo && (
                    <button type="button" onClick={() => { logoTouched.current = true; update({ logo: undefined }); }}
                      className="px-4 py-2 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors text-left">
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-gray-400">Recommended: 200×200px. PNG or JPG.</p>
                  {uploadError && <p className="text-xs text-red-600 font-medium">{uploadError}</p>}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Business Name</label>
              <input type="text" value={form.businessName} onChange={(e) => update({ businessName: e.target.value })} placeholder="e.g. Elite Auto Detailing" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name</label>
              <input type="text" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. John Smith" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Business Address</label>
              <input type="text" value={form.address} onChange={(e) => update({ address: e.target.value })} placeholder="e.g. 123 Main St, Los Angeles, CA" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">About Your Business</label>
              <textarea rows={3} value={form.bio} onChange={(e) => update({ bio: e.target.value })} placeholder="Tell customers about your business, your experience, and what makes you different..." className={INPUT_CLASS + " resize-none"} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Years in Business</label>
              <div className="flex items-center gap-3">
                <input type="number" min={0} max={100} value={form.yearsInBusiness}
                  onChange={(e) => update({ yearsInBusiness: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
                  className={INPUT_CLASS + " max-w-[120px]"} />
                <span className="text-sm text-gray-500 font-medium">years</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Service Areas</label>
              <input type="text" value={form.serviceAreas} onChange={(e) => update({ serviceAreas: e.target.value })} placeholder="e.g. Los Angeles, Beverly Hills, Santa Monica" className={INPUT_CLASS} />
              <p className="text-xs text-gray-400 mt-1.5">Separate multiple areas with commas.</p>
            </div>
          </div>
        </div>

        {/* URL */}
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
              <input type="text" value={form.slug} onChange={(e) => update({ slug: e.target.value })} placeholder="your-business-name"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all placeholder-gray-300" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Only lowercase letters, numbers, and hyphens. Other characters will be converted.</p>
          </div>
        </div>

        {/* Social & Contact */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Social & Contact Links</h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { key: "phone" as const,     label: "Phone",     prefix: "",          placeholder: "(555) 123-4567",  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />, fill: false },
              { key: "instagram" as const, label: "Instagram", prefix: "@",         placeholder: "yourbusiness",    icon: <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />, fill: true },
              { key: "facebook" as const,  label: "Facebook",  prefix: "fb.com/",   placeholder: "yourbusiness",    icon: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />, fill: true },
              { key: "website" as const,   label: "Website",   prefix: "https://",  placeholder: "yourbusiness.com", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />, fill: false },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill={item.fill ? "currentColor" : "none"} stroke={item.fill ? "none" : "currentColor"} viewBox="0 0 24 24">{item.icon}</svg>
                </div>
                <div className="flex-1 flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  {item.prefix && <span className="px-3 py-3 bg-gray-50 text-gray-400 text-xs border-r border-gray-200 flex-shrink-0">{item.prefix}</span>}
                  <input type="text" value={form[item.key]} onChange={(e) => update({ [item.key]: e.target.value } as Partial<Form>)} placeholder={item.placeholder}
                    className="flex-1 px-3 py-3 text-sm text-gray-900 focus:outline-none placeholder-gray-300" />
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400">These links appear on your public booking page header.</p>
          </div>
        </div>
      </>)}

      {/* ════════════════════════ BRANDING ════════════════════════ */}
      {activeTab === "branding" && (<>
        {/* Hero Banner */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Hero Banner</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="relative rounded-xl overflow-hidden h-48 bg-gray-900">
              {form.bannerImage ? (
                <img src={form.bannerImage} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-blue-900" />
              )}
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0, 0, 0, ${form.bannerOverlayOpacity / 100})` }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white font-bold text-lg">{form.bannerImage ? "Banner Preview" : "No banner uploaded"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImage(file, "bannerImage"); }} />
              <button type="button" onClick={() => bannerInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload Banner
              </button>
              {form.bannerImage && (
                <button type="button" onClick={() => { bannerTouched.current = true; update({ bannerImage: undefined }); }}
                  className="px-4 py-2.5 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">Recommended: 1200×400px or wider. JPG or PNG.</p>
            {uploadError && <p className="text-xs text-red-600 font-medium">{uploadError}</p>}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Overlay Opacity</label>
                <span className="text-sm font-bold text-blue-600">{form.bannerOverlayOpacity}%</span>
              </div>
              <input type="range" min="0" max="90" step="5" value={form.bannerOverlayOpacity}
                onChange={(e) => update({ bannerOverlayOpacity: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0% (no overlay)</span>
                <span>90% (very dark)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Appearance</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Theme</label>
              <div className="flex gap-2">
                {(["light", "dark", "auto"] as const).map((theme) => (
                  <button key={theme} type="button" onClick={() => update({ bookingPageTheme: theme })}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                      form.bookingPageTheme === theme ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}>
                    {theme === "light" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                    {theme === "dark" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
                    {theme === "auto" && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Accent Color</label>
              <div className="flex items-center gap-3 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button key={color.value} type="button" title={color.name} onClick={() => update({ accentColor: color.value })}
                    className={`w-9 h-9 rounded-full border-2 transition-all ${form.accentColor === color.value ? "border-gray-900 scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: color.value }} />
                ))}
                <div className="relative">
                  <input type="color" value={form.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="absolute inset-0 w-9 h-9 opacity-0 cursor-pointer" />
                  <div className={`w-9 h-9 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors cursor-pointer ${!PRESET_COLORS.some((c) => c.value === form.accentColor) ? "ring-2 ring-gray-900 ring-offset-2" : ""}`}
                    style={{ backgroundColor: !PRESET_COLORS.some((c) => c.value === form.accentColor) ? form.accentColor : "transparent" }}>
                    {PRESET_COLORS.some((c) => c.value === form.accentColor) && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Page Title</label>
              <input type="text" value={form.bookingPageTitle} onChange={(e) => update({ bookingPageTitle: e.target.value })} placeholder="e.g. Book Your Detail" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Subtitle</label>
              <input type="text" value={form.bookingPageSubtitle} onChange={(e) => update({ bookingPageSubtitle: e.target.value })} placeholder="e.g. Book your appointment online" className={INPUT_CLASS} />
            </div>
          </div>
        </div>
      </>)}

      {/* ════════════════════════ LAYOUT (services) ════════════════════════ */}
      {activeTab === "services" && (<>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Service Layout</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-4">Choose how your services are displayed to customers.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {([
                { id: "cards" as const,    pro: false, title: "Cards",    sub: "2-column grid with icons", preview: <div className="grid grid-cols-2 gap-1.5 mb-3"><div className="h-10 bg-gray-200 rounded-md" /><div className="h-10 bg-gray-200 rounded-md" /><div className="h-10 bg-gray-200 rounded-md" /><div className="h-10 bg-gray-200 rounded-md" /></div> },
                { id: "list" as const,     pro: false, title: "List",     sub: "Full-width rows",         preview: <div className="space-y-1.5 mb-3"><div className="h-6 bg-gray-200 rounded-md" /><div className="h-6 bg-gray-200 rounded-md" /><div className="h-6 bg-gray-200 rounded-md" /></div> },
                { id: "compact" as const,  pro: true,  title: "Compact",  sub: "Minimal rows",            preview: <div className="space-y-1 mb-3">{[0,1,2,3].map((i) => <div key={i} className="flex gap-1"><div className="w-5 h-5 bg-gray-200 rounded" /><div className="flex-1 h-5 bg-gray-200 rounded" /></div>)}</div> },
                { id: "featured" as const, pro: true,  title: "Featured", sub: "Hero + grid",             preview: <div className="mb-3"><div className="h-12 bg-gray-200 rounded-md mb-1.5" /><div className="grid grid-cols-2 gap-1"><div className="h-7 bg-gray-200 rounded-md" /><div className="h-7 bg-gray-200 rounded-md" /></div></div> },
                { id: "minimal" as const,  pro: true,  title: "Minimal",  sub: "Text only, clean",        preview: <div className="space-y-1.5 mb-3"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-1 bg-gray-100 rounded" /><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-1 bg-gray-100 rounded" /><div className="h-4 bg-gray-200 rounded w-3/4" /></div> },
              ]).map((opt) => {
                const locked = opt.pro && !isPro;
                const selected = form.serviceLayout === opt.id;
                return (
                  <button key={opt.id} type="button" onClick={() => { if (!locked) update({ serviceLayout: opt.id }); }}
                    className={`relative rounded-xl border-2 p-4 transition-all duration-200 text-left ${
                      locked ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" :
                      selected ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}>
                    {selected && !locked && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                    {locked && <div className="absolute top-2 right-2 text-[8px] font-bold bg-amber-400/20 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</div>}
                    {opt.preview}
                    <p className="text-xs font-bold text-gray-900">{opt.title}</p>
                    <p className="text-[10px] text-gray-500">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Visibility */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Content Visibility</h2>
          </div>
          <div className="p-6 space-y-4">
            {([
              { label: "Show Star Rating",    key: "showRating" as const },
              { label: "Show Social Links",   key: "showSocialLinks" as const },
              { label: "Show Service Areas",  key: "showServiceAreas" as const },
              { label: "Show Business Hours", key: "showBusinessHours" as const },
              { label: "Show Trust Badges",   key: "showTrustBadges" as const },
            ]).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <Toggle value={form[item.key]} onChange={(v) => update({ [item.key]: v } as Partial<Form>)} />
              </div>
            ))}
          </div>
        </div>

        {/* Booking Rules */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Booking Rules</h2>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Advance Booking Window</label>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={365} value={form.advanceBookingDays}
                  onChange={(e) => update({ advanceBookingDays: Math.max(1, Number(e.target.value)) })}
                  className={INPUT_CLASS + " max-w-[120px]"} />
                <span className="text-sm text-gray-500 font-medium">days in advance</span>
              </div>
            </div>
          </div>
        </div>
      </>)}

      {/* ════════════════════════ MEDIA ════════════════════════ */}
      {activeTab === "media" && (<>
        <PhotoGalleryEditor
          layout={form.galleryLayout}
          showTitle={form.galleryShowTitle}
          title={form.galleryTitle}
          onLayoutChange={(v) => update({ galleryLayout: v })}
          onShowTitleChange={(v) => update({ galleryShowTitle: v })}
          onTitleChange={(v) => update({ galleryTitle: v })}
        />
        <ReviewsEditor
          layout={form.reviewsLayout}
          showStars={form.reviewsShowStars}
          showAvatars={form.reviewsShowAvatars}
          showDates={form.reviewsShowDates}
          onLayoutChange={(v) => update({ reviewsLayout: v })}
          onShowStarsChange={(v) => update({ reviewsShowStars: v })}
          onShowAvatarsChange={(v) => update({ reviewsShowAvatars: v })}
          onShowDatesChange={(v) => update({ reviewsShowDates: v })}
        />
      </>)}

      {/* ════════════════════════ MESSAGES ════════════════════════ */}
      {activeTab === "messages" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h2 className="text-white font-bold text-base">Messages</h2>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Welcome Message</label>
              <textarea rows={3} value={form.customMessage} onChange={(e) => update({ customMessage: e.target.value })} placeholder="A welcome message shown at the top of your booking page..." className={INPUT_CLASS + " resize-none"} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Thank You Message</label>
              <textarea rows={3} value={form.thankYouMessage} onChange={(e) => update({ thankYouMessage: e.target.value })} placeholder="Shown after a customer completes a booking..." className={INPUT_CLASS + " resize-none"} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</label>
              <textarea rows={4} value={form.termsText} onChange={(e) => update({ termsText: e.target.value })} placeholder="Optional terms and conditions shown on the booking page..." className={INPUT_CLASS + " resize-none"} />
            </div>
          </div>
        </div>
      )}

      {/* Spacer for the sticky save bar */}
      <div className="h-16" />

      {/* ── Sticky Save Status Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:left-[260px]">
        <div className={`border-t transition-all duration-300 ${
          status === "error" ? "bg-red-50 border-red-200"
          : status === "saving" || status === "unsaved" ? "bg-amber-50 border-amber-200"
          : status === "saved" ? "bg-green-50 border-green-200"
          : "bg-white border-gray-200"
        }`}>
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              {status === "saving" ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <span className="text-sm font-medium text-amber-700">Saving…</span>
                </>
              ) : status === "unsaved" ? (
                <>
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span className="text-sm font-medium text-amber-700">Unsaved changes</span>
                </>
              ) : status === "saved" ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm font-medium text-green-700">All changes saved</span>
                </>
              ) : status === "error" ? (
                <span className="text-sm font-medium text-red-700 truncate">{saveError || "Couldn't save. Try again."}</span>
              ) : (
                <span className="text-sm text-gray-500">Auto-saves as you edit</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {(status === "unsaved" || status === "error") && (
                <button type="button" onClick={() => void save()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
                  {status === "error" ? "Retry" : "Save now"}
                </button>
              )}
              <a href={`/book/${form.slug}`} target="_blank" rel="noopener noreferrer"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 whitespace-nowrap">
                Preview page
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <DashboardHelp page="booking-page" />
    </div>
  );
}
