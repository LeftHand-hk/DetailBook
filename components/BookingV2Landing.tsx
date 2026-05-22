"use client";

import { useEffect, useRef, useState } from "react";

// Editorial / magazine-style booking page (v2).
//
// Two modes, one component:
//   • Public  (editable=false) — pure display on /book/[slug].
//   • Editor  (editable=true)  — the WYSIWYG used inside
//     /dashboard/booking-page. Text slots become inputs, the banner
//     and logo become uploads, and a floating toolbar carries the
//     page-colour picker + Save. A text slot only ever takes text and
//     an image slot only ever takes an image — no mixing.
//
// All edits persist to the user record via PUT /api/user (the same
// columns the public page reads), so editor and live page stay in sync.

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

type EditableKey =
  | "businessName" | "bio" | "city" | "address" | "phone"
  | "instagram" | "facebook" | "website"
  | "bookingPageTitle" | "bookingPageSubtitle"
  | "logo" | "bannerImage" | "galleryTitle" | "accentColor";

const PRESET_COLORS = ["#0F172A", "#2563EB", "#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#0EA5E9", "#14B8A6"];

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

// Compress + downscale an uploaded image to a sane size before storing
// it as base64 on the user record. Banners/logos uploaded raw can be
// several MB, which then ships inline in every booking-page load and
// makes the public page crawl. Downscaling to ~1600px wide at JPEG 0.82
// typically lands a banner under ~250KB with no visible quality loss.
function compressImage(file: File, maxWidth = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the image."));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(reader.result as string); return; } // fallback: original
        ctx.drawImage(img, 0, 0, w, h);
        // PNGs with transparency (logos) keep PNG; photos go JPEG.
        const isPng = file.type === "image/png";
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function BookingV2Landing({
  profile,
  packages,
  reviews,
  photos,
  onBookNow,
  editable = false,
  onSaved,
  onManageGallery,
  onManageReviews,
  onBack,
}: {
  profile: V2Profile;
  packages: V2Package[];
  reviews: V2Review[];
  photos: V2Photo[];
  onBookNow: () => void;
  editable?: boolean;
  onSaved?: (fields: Record<string, unknown>) => void;
  onManageGallery?: () => void;
  onManageReviews?: () => void;
  onBack?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<EditableKey, string>>>({});
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

  const val = (key: EditableKey): string => {
    if (key in draft) return draft[key] ?? "";
    const v = (profile as any)[key];
    return v == null ? "" : String(v);
  };
  const setField = (key: EditableKey, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = Object.keys(draft).length > 0;

  const save = async () => {
    if (!dirty) return;
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
      onSaved?.(draft as Record<string, unknown>);
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
      // Logos are small (downscale to 400px); banners stay large.
      const dataUrl = await compressImage(file, key === "logo" ? 400 : 1600);
      setField(key, dataUrl);
    } catch (err: any) {
      setSaveError(err?.message || "Could not load image.");
    }
  };

  const accent = val("accentColor") || profile.accentColor || "#0F172A";
  const businessName = val("businessName") || profile.businessName;
  const heroTitle = val("bookingPageTitle") || businessName;
  const bioVal = val("bio");
  const subtitleVal = val("bookingPageSubtitle");
  const heroSubtitle = subtitleVal || (bioVal ? (bioVal.length > 140 ? bioVal.slice(0, 140) + "…" : bioVal)
    : "Professional auto detailing — book online in under a minute.");
  const city = val("city");
  const bannerImage = val("bannerImage") || profile.bannerImage || "";
  const logo = val("logo") || profile.logo || "";
  const hasAvg = (profile.rating || 0) > 0 && (profile.reviewCount || 0) > 0;

  const Eyebrow = ({ children, dark }: { children: React.ReactNode; dark?: boolean }) => (
    <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: dark ? "#a8a29e" : accent }}>{children}</p>
  );

  // Inline text control on light sections.
  const TextEdit = ({ k, placeholder, multiline, rows, className }: { k: EditableKey; placeholder: string; multiline?: boolean; rows?: number; className?: string }) => {
    const base = `w-full bg-white/95 border-2 border-dashed border-blue-300 rounded-lg px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className || ""}`;
    return multiline
      ? <textarea value={val(k)} onChange={(e) => setField(k, e.target.value)} placeholder={placeholder} rows={rows || 3} className={base} />
      : <input type="text" value={val(k)} onChange={(e) => setField(k, e.target.value)} placeholder={placeholder} className={base} />;
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ── EDITOR TOOLBAR (editable mode only) ─────────────────────── */}
      {editable && (
        <div className="sticky top-0 z-50 bg-stone-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Dashboard
              </button>
            )}
            <span className="text-sm font-bold">Edit your page</span>
            <span className="text-xs text-white/50 hidden md:inline">Click any text or photo below to change it.</span>

            {/* Page color picker */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-white/70 mr-1">Page color</span>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField("accentColor", c)}
                  title={c}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${accent.toLowerCase() === c.toLowerCase() ? "border-white scale-110" : "border-transparent hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="relative w-5 h-5 rounded-full border-2 border-white/30 overflow-hidden cursor-pointer ml-0.5" title="Custom color">
                <span className="absolute inset-0 bg-gradient-to-br from-pink-500 via-yellow-400 to-blue-500" />
                <input type="color" value={accent} onChange={(e) => setField("accentColor", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>

            <button
              onClick={save}
              disabled={!dirty || saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
            </button>
          </div>
          {saveError && <div className="bg-red-600 text-white text-xs px-4 py-1.5 text-center">{saveError}</div>}
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("bannerImage", e.target.files?.[0])} />
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("logo", e.target.files?.[0])} />
        </div>
      )}

      {/* ── STICKY NAV ──────────────────────────────────────────────── */}
      <header className={`${editable ? "absolute" : "fixed"} top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled && !editable ? "bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm" : "bg-transparent"
      }`} style={editable ? { top: undefined } : undefined}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="w-9 h-9 rounded-full object-cover bg-stone-200" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: accent }}>
                  {businessName?.charAt(0) || "?"}
                </div>
              )}
              {editable && (
                <button onClick={() => logoInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white shadow" title="Replace logo">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16" /></svg>
                </button>
              )}
            </div>
            <span className={`text-base sm:text-lg font-bold tracking-tight truncate ${scrolled && !editable ? "text-stone-900" : "text-white drop-shadow"}`}>{businessName}</span>
          </div>
          <nav className="hidden sm:flex items-center gap-7 text-sm">
            {["About", "Services", "Gallery", "Reviews", "Contact"].map((label) => (
              <a key={label} href={`#${label.toLowerCase()}`} className={`font-medium transition-colors ${scrolled && !editable ? "text-stone-600 hover:text-stone-900" : "text-white/80 hover:text-white drop-shadow"}`}>{label}</a>
            ))}
            <button onClick={onBookNow} className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>
              Book Now
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </nav>
          <button onClick={onBookNow} className="sm:hidden text-white text-xs font-bold px-3 py-2 rounded-full" style={{ backgroundColor: accent }}>Book Now</button>
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

        {editable && (
          <button onClick={() => bannerInputRef.current?.click()} className="absolute top-20 right-5 z-20 inline-flex items-center gap-2 bg-white/90 text-stone-900 text-sm font-bold px-4 py-2 rounded-full shadow-lg hover:bg-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Replace banner photo
          </button>
        )}

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pb-16 sm:pb-24">
          {editable ? (
            <div className="max-w-2xl space-y-3">
              <TextEdit k="city" placeholder="Location label (e.g. Austin, TX)" className="max-w-xs text-sm" />
              <TextEdit k="bookingPageTitle" placeholder="Big headline (e.g. Showroom shine, every time)" className="text-2xl font-black" />
              <TextEdit k="bookingPageSubtitle" placeholder="One line under the headline" multiline rows={2} />
            </div>
          ) : (
            <>
              <p className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] mb-4">{city || profile.serviceAreas?.[0] || "Auto Detailing"}</p>
              <h1 className="text-white text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight max-w-3xl mb-5 sm:mb-7">{heroTitle}</h1>
              <p className="text-white/85 text-base sm:text-xl leading-relaxed max-w-xl mb-8 sm:mb-10">{heroSubtitle}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={onBookNow} className="inline-flex items-center gap-2 text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-full transition-opacity hover:opacity-90 shadow-lg" style={{ backgroundColor: accent }}>
                  Book Your Detail
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
                <a href="#services" className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-full transition-colors">See services</a>
              </div>
              {hasAvg && (
                <div className="mt-8 flex items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg key={i} className={`w-4 h-4 ${i <= Math.round(profile.rating || 0) ? "text-amber-400" : "text-white/20"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
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
            <Eyebrow>About</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight mb-6">
              {businessName} —{" "}
              <span className="text-stone-500">{profile.yearsInBusiness ? `${profile.yearsInBusiness}+ years of obsession with finish.` : "obsessive attention to every panel."}</span>
            </h2>
            {editable ? (
              <TextEdit k="bio" placeholder="Tell customers about your business…" multiline rows={5} />
            ) : (
              <p className="text-stone-600 text-lg leading-relaxed max-w-xl">{bioVal || "From a daily-driver refresh to a multi-stage paint correction, every car gets the same hand-finished attention. Book online and we'll handle the rest."}</p>
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
              <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-white/40 text-sm">No photos yet</div>
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
              <Eyebrow>Services</Eyebrow>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight max-w-xl">Pick the right level of detail for your car.</h2>
            </div>
            {!editable && <button onClick={onBookNow} className="text-sm font-semibold underline underline-offset-4 hover:no-underline" style={{ color: accent }}>Book Now →</button>}
          </div>
          {packages.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-10 text-center text-stone-500">
              No services listed yet.{editable ? " Add them from the Packages page." : ""}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {packages.map((pkg) => (
                <div key={pkg.id} className="group bg-white border border-stone-200 rounded-2xl p-7 flex flex-col text-left">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-2xl">{PACKAGE_ICONS[pkg.name] ?? "🚗"}</div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{formatDuration(pkg.duration)}</span>
                  </div>
                  <h3 className="text-xl font-extrabold leading-snug mb-2">{pkg.name}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">{pkg.description}</p>
                  <div className="flex items-baseline justify-between border-t border-stone-100 pt-5">
                    <div>
                      <p className="text-3xl font-black tracking-tight">${pkg.price}</p>
                      {pkg.deposit && pkg.deposit > 0 && <p className="text-[11px] text-stone-400 mt-0.5">${pkg.deposit} deposit</p>}
                    </div>
                    {!editable && <button onClick={onBookNow} className="text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors">Book →</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {editable && (
            <p className="text-center text-xs text-stone-400 mt-6">Services are managed on the Packages page — they appear here automatically.</p>
          )}
        </div>
      </section>

      {/* ── GALLERY ─────────────────────────────────────────────────── */}
      {(photos.length > 0 || editable) && (
        <section id="gallery" className="bg-stone-100 py-20 sm:py-28 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Eyebrow>Gallery</Eyebrow>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">{val("galleryTitle") || profile.galleryTitle || "Recent work."}</h2>
              {editable && onManageGallery && (
                <div className="mt-4"><button onClick={onManageGallery} className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 border border-stone-300 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors">{photos.length > 0 ? "Manage photos" : "Add photos"}</button></div>
              )}
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.slice(0, 12).map((p, i) => (
                  <div key={p.id} className={`relative overflow-hidden rounded-xl bg-stone-200 ${i % 7 === 0 ? "aspect-[4/5] sm:row-span-2 sm:aspect-auto" : "aspect-square"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── REVIEWS ─────────────────────────────────────────────────── */}
      {(reviews.length > 0 || editable) && (
        <section id="reviews" className="bg-stone-900 py-20 sm:py-28 px-5 sm:px-8 text-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <Eyebrow dark>Reviews</Eyebrow>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">What our customers say.</h2>
              {editable && onManageReviews && (
                <div className="mt-4"><button onClick={onManageReviews} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">{reviews.length > 0 ? "Manage reviews" : "Add reviews"}</button></div>
              )}
            </div>
            {reviews.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {reviews.slice(0, 6).map((r) => (
                  <div key={r.id} className="bg-stone-800/60 border border-white/10 rounded-2xl p-6 flex flex-col">
                    <div className="flex items-center gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} className={`w-4 h-4 ${i <= r.rating ? "text-amber-400" : "text-stone-700"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      ))}
                    </div>
                    <p className="text-white/90 leading-relaxed text-base flex-1 mb-5">&ldquo;{r.reviewText}&rdquo;</p>
                    <p className="text-white text-sm font-bold">{r.customerName}</p>
                  </div>
                ))}
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
          <button onClick={onBookNow} className="inline-flex items-center gap-2 text-white font-bold text-base px-9 py-4 rounded-full transition-opacity hover:opacity-90 shadow-lg" style={{ backgroundColor: accent }}>
            Book Now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
        </div>
      </section>

      {/* ── CONTACT / FOOTER ────────────────────────────────────────── */}
      <footer id="contact" className="bg-stone-100 border-t border-stone-200 px-5 sm:px-8 py-14">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">
          <div>
            <Eyebrow>Contact</Eyebrow>
            <p className="text-stone-900 font-bold text-lg mb-3">{businessName}</p>
            {editable ? (
              <div className="space-y-2 max-w-xs">
                <TextEdit k="phone" placeholder="Phone number" />
                <TextEdit k="address" placeholder="Address or service area" />
              </div>
            ) : (
              <>
                {val("phone") && <a href={`tel:${val("phone")}`} className="block text-stone-700 hover:text-stone-900 text-sm mb-1">📞 {val("phone")}</a>}
                {val("address") && <p className="text-stone-700 text-sm mb-1">📍 {val("address")}</p>}
                {!val("address") && profile.serviceAreas && profile.serviceAreas.length > 0 && <p className="text-stone-700 text-sm">📍 {profile.serviceAreas.join(", ")}</p>}
              </>
            )}
          </div>

          <div>
            <Eyebrow>Book online</Eyebrow>
            <button onClick={onBookNow} className="inline-flex items-center gap-2 text-white font-semibold text-sm px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: accent }}>Open booking →</button>
            <p className="text-stone-500 text-xs mt-3 leading-relaxed">Online booking 24/7 — no calls, no DMs, no waiting.</p>
          </div>

          <div>
            <Eyebrow>Follow</Eyebrow>
            {editable ? (
              <div className="space-y-2 max-w-xs">
                <TextEdit k="instagram" placeholder="Instagram handle" />
                <TextEdit k="facebook" placeholder="Facebook page" />
                <TextEdit k="website" placeholder="Website URL" />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 text-sm">
                {val("instagram") && <a href={`https://instagram.com/${val("instagram").replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Instagram → @{val("instagram").replace(/^@/, "")}</a>}
                {val("facebook") && <a href={val("facebook").startsWith("http") ? val("facebook") : `https://facebook.com/${val("facebook")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Facebook</a>}
                {val("website") && <a href={val("website").startsWith("http") ? val("website") : `https://${val("website")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Website → {val("website")}</a>}
                {!val("instagram") && !val("facebook") && !val("website") && <span className="text-stone-400 text-sm">No links yet.</span>}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-10 mt-10 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          <p>Booking powered by <span className="text-stone-900 font-semibold">DetailBook</span></p>
        </div>
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
