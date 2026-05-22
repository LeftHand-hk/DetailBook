"use client";

import { useEffect, useRef, useState } from "react";

// Editorial / magazine-style booking landing (v2). Rendered as the
// default view of /book/[slug]. When the viewer is the business owner,
// an "Edit page" mode turns each section's text into inline inputs and
// each image into an upload control — WordPress-style, but type-safe:
// a text slot only ever takes text, an image slot only ever takes an
// image. Edits persist to the user record via PUT /api/user (the same
// fields the dashboard booking-page editor writes), so the public page
// and the dashboard stay in sync.

export type V2Package = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
  deposit?: number | null;
};

export type V2Review = {
  id: string;
  customerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string | null;
};

export type V2Photo = {
  id: string;
  imageUrl: string;
  title?: string | null;
};

export type V2Profile = {
  businessName: string;
  bio?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
  yearsInBusiness?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  serviceAreas?: string[] | null;
  logo?: string | null;
  bannerImage?: string | null;
  bookingPageTitle?: string | null;
  bookingPageSubtitle?: string | null;
  accentColor?: string | null;
  galleryTitle?: string | null;
};

const PACKAGE_ICONS: Record<string, string> = {
  "Basic Wash": "💧",
  "Full Detail": "✨",
  "Ceramic Coating": "🛡️",
  "Paint Correction": "🎨",
  "Interior Detail": "🚗",
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// Fields we let the owner edit inline + persist to /api/user. Keep in
// sync with the PUT whitelist in app/api/user/route.ts.
type EditableProfile = Pick<
  V2Profile,
  | "businessName" | "bio" | "city" | "address" | "phone"
  | "instagram" | "facebook" | "website"
  | "bookingPageTitle" | "bookingPageSubtitle"
  | "logo" | "bannerImage" | "galleryTitle"
>;

function readFileAsDataUrl(file: File, maxBytes = 4 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error("Image is too large (max 4MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

export default function BookingV2Landing({
  profile,
  packages,
  reviews,
  photos,
  viewerIsOwner,
  onBookNow,
  onProfileSaved,
  onManagePackages,
  onManageGallery,
  onManageReviews,
}: {
  profile: V2Profile;
  packages: V2Package[];
  reviews: V2Review[];
  photos: V2Photo[];
  viewerIsOwner: boolean;
  onBookNow: () => void;
  onProfileSaved?: (updated: Record<string, unknown>) => void;
  onManagePackages?: () => void;
  onManageGallery?: () => void;
  onManageReviews?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Partial<EditableProfile>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The live value for a field: the in-flight draft wins while editing,
  // otherwise fall back to the saved profile.
  const val = <K extends keyof EditableProfile>(key: K): EditableProfile[K] => {
    return (key in draft ? (draft[key] as EditableProfile[K]) : (profile[key] as EditableProfile[K]));
  };
  const setField = <K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const startEdit = () => { setDraft({}); setEditMode(true); setSaveError(""); };
  const cancelEdit = () => { setDraft({}); setEditMode(false); setSaveError(""); };

  const save = async () => {
    if (Object.keys(draft).length === 0) { setEditMode(false); return; }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Could not save (HTTP ${res.status}).`);
        return;
      }
      onProfileSaved?.(draft as Record<string, unknown>);
      setEditMode(false);
      setDraft({});
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message || "Network error.");
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (key: "bannerImage" | "logo", file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setField(key, dataUrl);
    } catch (err: any) {
      setSaveError(err?.message || "Could not load image.");
    }
  };

  const accent = profile.accentColor || "#0F172A";
  const hasAvg = (profile.rating || 0) > 0 && (profile.reviewCount || 0) > 0;
  const businessName = (val("businessName") as string) || profile.businessName;
  const heroTitle = (val("bookingPageTitle") as string) || businessName;
  const heroSubtitleRaw = (val("bookingPageSubtitle") as string) || "";
  const bio = (val("bio") as string) || "";
  const heroSubtitle = heroSubtitleRaw || (
    bio ? (bio.length > 140 ? bio.slice(0, 140) + "…" : bio)
        : "Professional auto detailing — book online in under a minute."
  );
  const city = (val("city") as string) || "";
  const bannerImage = (val("bannerImage") as string) || "";
  const logo = (val("logo") as string) || "";

  // ── Inline editing primitives ──────────────────────────────────────
  const editInputBase =
    "bg-white/90 text-stone-900 rounded-lg border border-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 py-2";

  const HeroEditField = ({
    fieldKey, value, placeholder, multiline, className,
  }: {
    fieldKey: keyof EditableProfile;
    value: string;
    placeholder: string;
    multiline?: boolean;
    className?: string;
  }) => {
    if (!editMode) return null;
    return multiline ? (
      <textarea
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
        placeholder={placeholder}
        rows={2}
        className={`${editInputBase} w-full ${className || ""}`}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => setField(fieldKey, e.target.value)}
        placeholder={placeholder}
        className={`${editInputBase} w-full ${className || ""}`}
      />
    );
  };

  // Light-section editable text (about / contact).
  const LightEditField = ({
    fieldKey, value, placeholder, multiline, rows,
  }: {
    fieldKey: keyof EditableProfile;
    value: string;
    placeholder: string;
    multiline?: boolean;
    rows?: number;
  }) => {
    const base = "w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
    return multiline ? (
      <textarea value={value} onChange={(e) => setField(fieldKey, e.target.value)} placeholder={placeholder} rows={rows || 3} className={base} />
    ) : (
      <input type="text" value={value} onChange={(e) => setField(fieldKey, e.target.value)} placeholder={placeholder} className={base} />
    );
  };

  const ManageBtn = ({ label, onClick }: { label: string; onClick?: () => void }) =>
    viewerIsOwner && onClick ? (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        {label}
      </button>
    ) : null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Owner toolbar — fixed, only for the business owner. */}
      {viewerIsOwner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-stone-900 text-white rounded-full shadow-2xl px-2 py-2">
          {!editMode ? (
            <>
              <span className="text-xs text-white/60 pl-3">You&apos;re viewing your live page</span>
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 bg-white text-stone-900 text-sm font-bold px-4 py-2 rounded-full hover:bg-stone-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit page
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-white/70 pl-3">Editing — text stays text, photos stay photos</span>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="text-sm font-semibold text-white/80 hover:text-white px-3 py-2 rounded-full transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
        </div>
      )}
      {savedFlash && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg">
          Saved — your live page is updated.
        </div>
      )}
      {saveError && editMode && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg max-w-[90vw] text-center">
          {saveError}
        </div>
      )}

      {/* ── STICKY NAV ──────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="w-9 h-9 rounded-full object-cover bg-stone-200" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center text-sm font-bold">
                  {businessName?.charAt(0) || "?"}
                </div>
              )}
              {editMode && (
                <>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white shadow"
                    title="Replace logo"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16" /></svg>
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("logo", e.target.files?.[0])} />
                </>
              )}
            </div>
            <span className={`text-base sm:text-lg font-bold tracking-tight truncate ${scrolled ? "text-stone-900" : "text-white drop-shadow"}`}>
              {businessName}
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-7 text-sm">
            {["About", "Services", "Gallery", "Reviews", "Contact"].map((label) => (
              <a key={label} href={`#${label.toLowerCase()}`} className={`font-medium transition-colors ${scrolled ? "text-stone-600 hover:text-stone-900" : "text-white/80 hover:text-white drop-shadow"}`}>
                {label}
              </a>
            ))}
            <button onClick={onBookNow} className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors">
              Book Now
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </nav>
          <button onClick={onBookNow} className="sm:hidden bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3 py-2 rounded-full">
            Book Now
          </button>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[640px] flex items-end overflow-hidden">
        {bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />

        {/* Banner replace control */}
        {editMode && (
          <>
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="absolute top-20 right-5 z-20 inline-flex items-center gap-2 bg-white/90 text-stone-900 text-sm font-bold px-4 py-2 rounded-full shadow-lg hover:bg-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Replace banner
            </button>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("bannerImage", e.target.files?.[0])} />
          </>
        )}

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pb-16 sm:pb-24">
          {editMode ? (
            <div className="max-w-2xl space-y-3">
              <HeroEditField fieldKey="city" value={city} placeholder="Location label (e.g. Austin, TX)" className="max-w-xs text-sm" />
              <HeroEditField fieldKey="bookingPageTitle" value={(val("bookingPageTitle") as string) || ""} placeholder="Headline (e.g. Showroom shine, every time)" className="text-2xl font-black" />
              <HeroEditField fieldKey="bookingPageSubtitle" value={heroSubtitleRaw} placeholder="One-line subtitle under the headline" multiline />
            </div>
          ) : (
            <>
              <p className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] mb-4">
                {city || profile.serviceAreas?.[0] || "Auto Detailing"}
              </p>
              <h1 className="text-white text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight max-w-3xl mb-5 sm:mb-7">
                {heroTitle}
              </h1>
              <p className="text-white/85 text-base sm:text-xl leading-relaxed max-w-xl mb-8 sm:mb-10">
                {heroSubtitle}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={onBookNow} className="inline-flex items-center gap-2 bg-white text-stone-900 hover:bg-stone-100 font-bold text-sm sm:text-base px-7 py-3.5 rounded-full transition-colors shadow-lg">
                  Book Your Detail
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
                <a href="#services" className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-full transition-colors">
                  See services
                </a>
              </div>
              {hasAvg && (
                <div className="mt-8 flex items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg key={i} className={`w-4 h-4 ${i <= Math.round(profile.rating || 0) ? "text-amber-400" : "text-white/20"}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-white text-sm font-medium">{(profile.rating || 0).toFixed(1)} · {profile.reviewCount} reviews</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── ABOUT ───────────────────────────────────────────────────── */}
      <section id="about" className="bg-stone-50 py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-20 items-start">
          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">About</p>
            <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight mb-6">
              {businessName} —{" "}
              <span className="text-stone-500">
                {profile.yearsInBusiness ? `${profile.yearsInBusiness}+ years of obsession with finish.` : "obsessive attention to every panel."}
              </span>
            </h2>
            {editMode ? (
              <LightEditField fieldKey="bio" value={bio} placeholder="Tell customers about your business…" multiline rows={5} />
            ) : (
              <p className="text-stone-600 text-lg leading-relaxed max-w-xl mb-8">
                {bio || "From a daily-driver refresh to a multi-stage paint correction, every car gets the same hand-finished attention. Book online and we'll handle the rest."}
              </p>
            )}
            <div className="grid grid-cols-2 gap-6 max-w-md text-sm mt-8">
              {profile.yearsInBusiness ? <Stat label="Years in business" value={`${profile.yearsInBusiness}+`} /> : null}
              {profile.reviewCount ? <Stat label="Reviews" value={`${profile.reviewCount}`} /> : null}
              {profile.serviceAreas && profile.serviceAreas.length > 0 ? <Stat label="Service area" value={profile.serviceAreas[0]} /> : city ? <Stat label="Based in" value={city} /> : null}
              {packages.length > 0 ? <Stat label="Services" value={`${packages.length}`} /> : null}
            </div>
          </div>

          <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-stone-200 shadow-2xl">
            {photos[0]?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[0].imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : bannerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-white/40 text-sm">Add photos in your gallery</div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Recent work</p>
              <p className="text-white text-lg font-bold mt-1">{photos[0]?.title || "Showroom finish, every time."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ────────────────────────────────────────────────── */}
      <section id="services" className="bg-white py-20 sm:py-28 px-5 sm:px-8 border-y border-stone-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-6 mb-12 flex-wrap">
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Services</p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight max-w-xl">Pick the right level of detail for your car.</h2>
            </div>
            <div className="flex items-center gap-3">
              <ManageBtn label="Manage services" onClick={onManagePackages} />
              <button onClick={onBookNow} className="text-sm font-semibold text-stone-900 underline underline-offset-4 hover:no-underline">Book Now →</button>
            </div>
          </div>

          {packages.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-10 text-center text-stone-500">
              No services yet.{viewerIsOwner ? " Add them from your dashboard." : ""}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {packages.map((pkg) => (
                <button key={pkg.id} onClick={onBookNow} className="group bg-white border border-stone-200 hover:border-stone-900 rounded-2xl p-7 transition-all hover:-translate-y-0.5 hover:shadow-xl shadow-stone-200/60 flex flex-col text-left">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-stone-100 group-hover:bg-stone-900 rounded-2xl flex items-center justify-center text-2xl transition-colors">
                      <span className="group-hover:hidden">{PACKAGE_ICONS[pkg.name] ?? "🚗"}</span>
                      <span className="hidden group-hover:inline-block text-white">→</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{formatDuration(pkg.duration)}</span>
                  </div>
                  <h3 className="text-xl font-extrabold leading-snug mb-2">{pkg.name}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">{pkg.description}</p>
                  <div className="flex items-baseline justify-between border-t border-stone-100 pt-5">
                    <div>
                      <p className="text-3xl font-black tracking-tight">${pkg.price}</p>
                      {pkg.deposit && pkg.deposit > 0 && <p className="text-[11px] text-stone-400 mt-0.5">${pkg.deposit} deposit</p>}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-500 group-hover:text-stone-900 transition-colors">Book →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── GALLERY ─────────────────────────────────────────────────── */}
      {(photos.length > 0 || viewerIsOwner) && (
        <section id="gallery" className="bg-stone-100 py-20 sm:py-28 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Gallery</p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">{profile.galleryTitle || "Recent work."}</h2>
              {photos.length === 0 && viewerIsOwner && (
                <div className="mt-4"><ManageBtn label="Add photos" onClick={onManageGallery} /></div>
              )}
            </div>
            {photos.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {photos.slice(0, 12).map((p, i) => (
                    <div key={p.id} className={`relative overflow-hidden rounded-xl bg-stone-200 ${i % 7 === 0 ? "aspect-[4/5] sm:row-span-2 sm:aspect-auto" : "aspect-square"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                    </div>
                  ))}
                </div>
                {viewerIsOwner && <div className="text-center mt-6"><ManageBtn label="Manage gallery" onClick={onManageGallery} /></div>}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── REVIEWS ─────────────────────────────────────────────────── */}
      {(reviews.length > 0 || viewerIsOwner) && (
        <section id="reviews" className="bg-stone-900 py-20 sm:py-28 px-5 sm:px-8 text-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-stone-400 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Reviews</p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">What our customers say.</h2>
              {reviews.length === 0 && viewerIsOwner && (
                <div className="mt-4">
                  <button onClick={onManageReviews} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">Add reviews</button>
                </div>
              )}
            </div>
            {reviews.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {reviews.slice(0, 6).map((r) => (
                  <div key={r.id} className="bg-stone-800/60 border border-white/10 rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} className={`w-4 h-4 ${i <= r.rating ? "text-amber-400" : "text-stone-700"}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-white/90 leading-relaxed text-base flex-1 mb-5">&ldquo;{r.reviewText}&rdquo;</p>
                    <p className="text-white text-sm font-bold">{r.customerName}</p>
                  </div>
                ))}
              </div>
            )}
            {reviews.length > 0 && viewerIsOwner && (
              <div className="text-center mt-8">
                <button onClick={onManageReviews} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">Manage reviews</button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── BIG CTA ─────────────────────────────────────────────────── */}
      <section className="bg-stone-50 py-24 sm:py-32 px-5 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">Ready to book?</h2>
          <p className="text-stone-600 text-lg max-w-xl mx-auto mb-10">Pick a service, pick a slot, and you&apos;re set. Most customers finish in under a minute.</p>
          <button onClick={onBookNow} className="inline-flex items-center gap-2 text-white font-bold text-base px-9 py-4 rounded-full transition-colors shadow-lg" style={{ backgroundColor: accent }}>
            Book Now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
        </div>
      </section>

      {/* ── CONTACT / FOOTER ────────────────────────────────────────── */}
      <footer id="contact" className="bg-stone-100 border-t border-stone-200 px-5 sm:px-8 py-14">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">
          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Contact</p>
            <p className="text-stone-900 font-bold text-lg mb-3">{businessName}</p>
            {editMode ? (
              <div className="space-y-2 max-w-xs">
                <LightEditField fieldKey="phone" value={(val("phone") as string) || ""} placeholder="Phone number" />
                <LightEditField fieldKey="address" value={(val("address") as string) || ""} placeholder="Address or service area" />
              </div>
            ) : (
              <>
                {(val("phone") as string) && <a href={`tel:${val("phone")}`} className="block text-stone-700 hover:text-stone-900 text-sm mb-1">📞 {val("phone") as string}</a>}
                {(val("address") as string) && <p className="text-stone-700 text-sm mb-1">📍 {val("address") as string}</p>}
                {!(val("address") as string) && profile.serviceAreas && profile.serviceAreas.length > 0 && <p className="text-stone-700 text-sm">📍 {profile.serviceAreas.join(", ")}</p>}
              </>
            )}
          </div>

          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Book online</p>
            <button onClick={onBookNow} className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm px-5 py-2.5 rounded-full">Open booking →</button>
            <p className="text-stone-500 text-xs mt-3 leading-relaxed">Online booking 24/7 — no calls, no DMs, no waiting.</p>
          </div>

          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Follow</p>
            {editMode ? (
              <div className="space-y-2 max-w-xs">
                <LightEditField fieldKey="instagram" value={(val("instagram") as string) || ""} placeholder="Instagram handle" />
                <LightEditField fieldKey="facebook" value={(val("facebook") as string) || ""} placeholder="Facebook page" />
                <LightEditField fieldKey="website" value={(val("website") as string) || ""} placeholder="Website URL" />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 text-sm">
                {(val("instagram") as string) && <a href={`https://instagram.com/${(val("instagram") as string).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Instagram → @{(val("instagram") as string).replace(/^@/, "")}</a>}
                {(val("facebook") as string) && <a href={(val("facebook") as string).startsWith("http") ? (val("facebook") as string) : `https://facebook.com/${val("facebook")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Facebook</a>}
                {(val("website") as string) && <a href={(val("website") as string).startsWith("http") ? (val("website") as string) : `https://${val("website")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Website → {val("website") as string}</a>}
                {!(val("instagram") as string) && !(val("facebook") as string) && !(val("website") as string) && <span className="text-stone-400 text-sm">No links yet.</span>}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-10 mt-10 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          <p>Booking powered by <span className="text-stone-900 font-semibold">DetailBook</span></p>
        </div>
        {/* Spacer so the fixed owner toolbar never covers the footer text. */}
        {viewerIsOwner && <div className="h-16" aria-hidden />}
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}
