"use client";

import { useEffect, useRef, useState } from "react";
import { VEHICLE_TYPES, type VehicleTypeId, surchargeForVehicleType, packageSupportsVehicleType } from "@/lib/vehicle-pricing";
import { VehicleIcon } from "@/components/VehicleIcon";
import ImageFrameModal, { type FrameValue } from "@/components/ImageFrameModal";
import { isStorageConfigured, uploadToStorage } from "@/lib/supabase-storage";

// Editorial booking page (v2). Two modes, one component:
//   • Public (editable=false) — pure display on /book/[slug].
//   • Editor (editable=true)  — the standalone WYSIWYG at
//     /booking-page-editor. EVERY visible text is an inline input and
//     every image is an upload. Type-safe: text slots take text, image
//     slots take images. Real DB columns (businessName, bio, title…)
//     persist to their own fields; section headings / eyebrows / CTA
//     copy that have no column live in the `pageContent` JSON. Empty
//     slots always fall back to sensible default copy, so the page is
//     never blank.

export type V2Package = { id: string; name: string; description: string; price: number; duration: number; active: boolean; deposit?: number | null; vehiclePricing?: Array<{ type: string; surcharge: number }> | null };
export type V2Review = { id: string; customerName: string; rating: number; reviewText: string; reviewDate: string | null };
export type V2Photo = { id: string; imageUrl: string; title?: string | null };
export type V2Profile = {
  businessName: string;
  bio?: string | null; city?: string | null; address?: string | null; phone?: string | null;
  instagram?: string | null; facebook?: string | null; website?: string | null;
  yearsInBusiness?: number | null; rating?: number | null; reviewCount?: number | null;
  serviceAreas?: string[] | null; logo?: string | null; bannerImage?: string | null;
  coverImage?: string | null;
  bookingPageTitle?: string | null; bookingPageSubtitle?: string | null;
  accentColor?: string | null; galleryTitle?: string | null;
  pageContent?: Record<string, string> | null;
};

// Real user columns that have inline-editable slots on this page.
const REAL_COLS = new Set([
  "businessName", "bookingPageTitle", "bookingPageSubtitle", "bio",
  "city", "phone", "address", "instagram", "facebook", "website", "galleryTitle",
]);

// Default copy for every content-key slot (no DB column). Dynamic ones
// (heroEyebrow, aboutTagline) are resolved at render — see resolve().
const CONTENT_DEFAULTS: Record<string, string> = {
  heroPrimaryBtn: "Book Your Detail",
  heroSecondaryBtn: "See services",
  aboutEyebrow: "About",
  statYearsLabel: "Years in business",
  statReviewsLabel: "Reviews",
  statAreaLabel: "Service area",
  statServicesLabel: "Services",
  servicesEyebrow: "Services",
  servicesHeading: "Pick the right level of detail for your car.",
  galleryEyebrow: "Gallery",
  reviewsEyebrow: "Reviews",
  reviewsHeading: "What our customers say.",
  ctaHeading: "Ready to book?",
  ctaSubtitle: "Pick a service, pick a slot, and you're set. Most customers finish in under a minute.",
  ctaButton: "Book Now",
  contactEyebrow: "Contact",
  bookEyebrow: "Book online",
  bookNote: "Online booking 24/7 — no calls, no DMs, no waiting.",
  followEyebrow: "Follow",
  aboutImageLabel: "Recent work",
  aboutImageCaption: "Showroom finish, every time.",
};

const PRESET_COLORS = ["#0F172A", "#2563EB", "#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#0EA5E9", "#14B8A6"];

// Default hero photos shown when a business hasn't uploaded its own banner.
// Portrait for mobile, landscape for desktop. Served from /public (CDN
// cached). Owners can still replace them via "Replace banner photo".
const DEFAULT_BANNER_DESKTOP = "/default-banner-desktop.jpg";
const DEFAULT_BANNER_MOBILE = "/default-banner-mobile.jpg";

const PACKAGE_ICONS: Record<string, string> = {
  "Basic Wash": "💧", "Full Detail": "✨", "Ceramic Coating": "🛡️", "Paint Correction": "🎨", "Interior Detail": "🚗",
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

// Downscale + compress an uploaded image to a SMALL base64 string. The hard
// `maxChars` cap is the important part: a save used to time out (HTTP 504)
// when a phone photo — or any PNG, which is lossless and balloons to several
// MB — was sent at full weight. We force photos to JPEG and keep dropping
// quality, then dimensions, until the payload is guaranteed small, so the
// save always uploads well within the serverless timeout no matter how big
// the source file is.
function compressImage(file: File, maxWidth = 1600, quality = 0.82, maxChars = 700_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the image."));
      img.onload = () => {
        // Keep PNG only for small graphics that may need transparency (logos).
        // A PNG of a *photo* stays lossless and huge — that's what timed out.
        const keepPng = file.type === "image/png" && maxWidth <= 600;
        const mime = keepPng ? "image/png" : "image/jpeg";
        const encode = (targetW: number, q: number): string => {
          const scale = Math.min(1, targetW / img.width);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reader.result as string;
          // White matte so a transparent PNG flattened to JPEG isn't black.
          if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL(mime, mime === "image/jpeg" ? q : undefined);
        };
        let targetW = Math.min(maxWidth, img.width);
        let q = quality;
        let out = encode(targetW, q);
        let guard = 0;
        while (out.length > maxChars && guard < 10) {
          guard++;
          if (mime === "image/jpeg" && q > 0.45) q -= 0.12; // shed quality first
          else targetW = Math.round(targetW * 0.85);        // then shrink size
          out = encode(targetW, q);
        }
        resolve(out);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function BookingV2Landing({
  profile, packages, reviews, photos, onBookNow,
  editable = false, onSaved, onManageGallery, onManageReviews, onBack, onSelectPackage,
}: {
  profile: V2Profile;
  packages: V2Package[]; reviews: V2Review[]; photos: V2Photo[];
  onBookNow: () => void;
  editable?: boolean;
  onSaved?: (fields: Record<string, unknown>) => void;
  onManageGallery?: () => void;
  onManageReviews?: () => void;
  onBack?: () => void;
  // Customer clicked a specific service card — jump straight into the
  // booking flow with that package preselected (skip re-choosing it).
  // We also pass the picked vehicle type so the parent can lock in the
  // surcharge without needing a second modal.
  onSelectPackage?: (pkg: V2Package, vehicleType: VehicleTypeId | null) => void;
}) {
  // Customer's chosen vehicle type — lives in the v2 landing so the
  // tier-picker is the FIRST thing they pick, before any services. Lets
  // us filter the services grid and bake the surcharge into the price
  // they see before they tap a card.
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleTypeId | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Fade the banner in once it's fully decoded so a baseline JPEG doesn't
  // visibly paint top-to-bottom ("piece by piece"). The dark backdrop shows
  // until then. Reset when the banner source changes (e.g. editor upload).
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [colDraft, setColDraft] = useState<Record<string, string>>({});
  const [contentDraft, setContentDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const aboutImgInputRef = useRef<HTMLInputElement>(null);
  // Crop/reframe modal: which photo is being framed, and the live aspect
  // ratio of its on-page frame (measured so the modal rectangle matches).
  const heroRef = useRef<HTMLElement>(null);
  const coverBoxRef = useRef<HTMLDivElement>(null);
  const [framing, setFraming] = useState<null | "banner" | "cover">(null);
  const [frameAspect, setFrameAspect] = useState(16 / 9);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pc = (profile.pageContent || {}) as Record<string, string>;

  // Raw stored value of any slot (draft wins).
  const textValue = (key: string): string => {
    if (REAL_COLS.has(key)) {
      if (key in colDraft) return colDraft[key] ?? "";
      const v = (profile as any)[key];
      return v == null ? "" : String(v);
    }
    if (key in contentDraft) return contentDraft[key] ?? "";
    return pc[key] != null ? String(pc[key]) : "";
  };

  // Displayed value: stored value, else the slot's default (some are dynamic).
  const resolve = (key: string): string => {
    const v = textValue(key);
    if (v) return v;
    if (key === "bookingPageTitle") return textValue("businessName") || profile.businessName;
    if (key === "bookingPageSubtitle") {
      const bio = textValue("bio");
      return bio ? (bio.length > 140 ? bio.slice(0, 140) + "…" : bio) : "Professional auto detailing — book online in under a minute.";
    }
    if (key === "heroEyebrow") return textValue("city") || profile.serviceAreas?.[0] || "Auto Detailing";
    if (key === "aboutTagline") return years ? `${years}+ years of obsession with finish.` : "obsessive attention to every panel.";
    if (key === "bio") return "From a daily-driver refresh to a multi-stage paint correction, every car gets the same hand-finished attention. Book online and we'll handle the rest.";
    return CONTENT_DEFAULTS[key] ?? "";
  };

  const setText = (key: string, value: string) => {
    if (REAL_COLS.has(key)) setColDraft((d) => ({ ...d, [key]: value }));
    else setContentDraft((d) => ({ ...d, [key]: value }));
  };

  const dirty = Object.keys(colDraft).length > 0 || Object.keys(contentDraft).length > 0;

  const save = async () => {
    if (!dirty) return;
    setSaving(true); setSaveError("");
    try {
      const payload: Record<string, unknown> = { ...colDraft };
      // yearsInBusiness is an Int column — coerce the draft string.
      if (typeof payload.yearsInBusiness === "string") {
        payload.yearsInBusiness = parseInt(payload.yearsInBusiness, 10) || 0;
      }
      if (Object.keys(contentDraft).length) payload.pageContent = { ...pc, ...contentDraft };
      const res = await fetch("/api/user", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Could not save (HTTP ${res.status}).`); return;
      }
      onSaved?.(payload);
      setColDraft({}); setContentDraft({});
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message || "Network error.");
    } finally { setSaving(false); }
  };

  const pickImage = async (key: "bannerImage" | "logo" | "coverImage", file: File | undefined) => {
    if (!file) return;
    try {
      // Smaller banners save much faster. Phone photos at 1600px@0.82
      // produced ~1 MB+ of base64, which took ~10s to upload + persist.
      // 1366px@0.8 is still crisp for a full-bleed hero but ~35% lighter.
      const maxW = key === "logo" ? 400 : key === "coverImage" ? 1000 : 1366;
      const quality = key === "bannerImage" ? 0.8 : 0.82;
      // Hard cap on the encoded size so the save never times out (HTTP 504),
      // even from a huge phone photo. ~525KB banner / ~410KB cover / ~150KB logo.
      const cap = key === "logo" ? 200_000 : key === "coverImage" ? 550_000 : 700_000;
      const dataUrl = await compressImage(file, maxW, quality, cap);
      // Upload to object storage (Supabase) and persist only the URL, so the
      // save payload stays tiny and can never time out (HTTP 504). If storage
      // isn't configured or the upload fails, fall back to the inline base64
      // image — the save still works, just heavier. Existing base64 images on
      // the platform are left untouched; the img routes already redirect URLs.
      let value = dataUrl;
      if (isStorageConfigured()) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const ext = blob.type === "image/png" ? "png" : "jpg";
          const ns = (profile as any).slug || (profile as any).id || "biz";
          const path = `${ns}/${key}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          value = await uploadToStorage(blob, path);
        } catch (e) {
          console.error("Storage upload failed; using inline image instead:", e);
        }
      }
      setColDraft((d) => ({ ...d, [key]: value }));
    } catch (err: any) {
      // iPhone photos are often HEIC, which most browsers can't decode to a
      // canvas — surface a clear hint instead of a silent failure.
      const heic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
      setSaveError(heic
        ? "That looks like an iPhone HEIC photo. Open it in Photos and share/save as JPEG, then upload again."
        : (err?.message || "Could not load that image. Try a JPEG or PNG."));
    }
  };

  // Clear an image so the page falls back to its default (banner) or the
  // next available source (cover → first gallery photo). Persists on Save.
  const removeImage = (key: "bannerImage" | "logo" | "coverImage") => {
    setSaveError("");
    setColDraft((d) => ({ ...d, [key]: "" }));
  };

  const accent = colDraft["accentColor"] || profile.accentColor || "#0F172A";
  const setAccent = (c: string) => setColDraft((d) => ({ ...d, accentColor: c }));
  const businessName = resolve("businessName") || profile.businessName;
  const bannerImage = colDraft["bannerImage"] || profile.bannerImage || "";
  const logo = colDraft["logo"] || profile.logo || "";
  // About-section image: coverImage, then first gallery photo, then
  // banner — never empty.
  const aboutImage = colDraft["coverImage"] || profile.coverImage || photos[0]?.imageUrl || bannerImage || "";
  const hasAvg = (profile.rating || 0) > 0 && (profile.reviewCount || 0) > 0;
  // Whether a custom About/cover image is set (vs the gallery/banner
  // fallback) — drives the "Remove" control.
  const coverDraftVal = colDraft["coverImage"];
  const hasCustomCover = coverDraftVal !== undefined ? !!coverDraftVal : !!profile.coverImage;
  // Vertical framing (object-position Y, 0–100) for the banner + cover
  // photos, stored as plain content keys so an owner can reposition a photo
  // whose subject isn't dead-centre. 50 = centred.
  const posOf = (key: string, def = 50) => {
    const n = parseInt(textValue(key), 10);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : def;
  };
  // Zoom factor (1–4) stored as a percent string (100–400). 1 = the cover
  // baseline that fills the frame; higher zooms further in.
  const zoomOf = (key: string): number => {
    const n = parseInt(textValue(key), 10);
    return Number.isFinite(n) ? Math.min(400, Math.max(100, n)) / 100 : 1;
  };
  const bannerPos = `${posOf("bannerPosX")}% ${posOf("bannerPosY")}%`;
  const coverPos = `${posOf("coverPosX")}% ${posOf("coverPosY")}%`;
  // Fit mode for the banner + cover photos. "cover" (default) fills the
  // frame and crops the overflow; "contain" shows the WHOLE photo with no
  // crop (letterboxed). Stored as plain content keys so it persists on Save.
  const fitOf = (key: string): "cover" | "contain" =>
    textValue(key) === "contain" ? "contain" : "cover";
  const bannerFit = fitOf("bannerFit");
  const coverFit = fitOf("coverFit");
  const bannerZoom = zoomOf("bannerZoom");
  const coverZoom = zoomOf("coverZoom");

  // Open the crop/reframe modal for a photo, measuring the live frame so the
  // modal's rectangle matches what renders on the page.
  const openFramer = (which: "banner" | "cover") => {
    const el = which === "banner" ? heroRef.current : coverBoxRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setFrameAspect(r.width / r.height);
    } else {
      setFrameAspect(which === "banner" ? 16 / 9 : 4 / 5);
    }
    setFraming(which);
  };

  // Persist the framing the owner picked in the modal.
  const applyFraming = (which: "banner" | "cover", v: FrameValue) => {
    const p = which === "banner" ? "banner" : "cover";
    setText(`${p}PosX`, String(Math.round(v.posX)));
    setText(`${p}PosY`, String(Math.round(v.posY)));
    setText(`${p}Zoom`, String(Math.round(v.zoom * 100)));
    setText(`${p}Fit`, v.fit);
    setFraming(null);
  };
  // Years in business — editable number. Draft (string) wins while
  // editing; coerced to a number on save.
  const years = colDraft["yearsInBusiness"] !== undefined
    ? (parseInt(colDraft["yearsInBusiness"], 10) || 0)
    : (profile.yearsInBusiness || 0);

  // Re-arm the banner fade whenever the source changes.
  useEffect(() => { setBannerLoaded(false); }, [bannerImage]);

  // ── Empty-state visibility flags ─────────────────────────────────────
  // On the public page (editable=false) we hide any section the owner
  // hasn't actually populated, so a brand-new account doesn't look broken
  // with placeholder "0" stats, sample reviews, or stock gallery panels.
  // In the editor (editable=true) we keep everything visible so the
  // owner can fill them in. Demo accounts naturally have real data, so
  // they show all sections without special-casing.
  const realBio = textValue("bio").trim();
  const realYears = (profile.yearsInBusiness ?? 0) > 0 ? (profile.yearsInBusiness ?? 0) : 0;
  const realServiceArea = profile.serviceAreas && profile.serviceAreas[0] ? profile.serviceAreas[0].trim() : "";
  // Services count is auto-derived from packages and is true for every
  // onboarded account, so it doesn't count as "About has real data" on
  // its own — a lonely "3 Services" stat would still look skeletal.
  const aboutHasContent = Boolean(realBio) || realYears > 0 || Boolean(realServiceArea);
  const showAbout = editable || aboutHasContent;
  const showGallery = editable || photos.length > 0;
  const showReviews = editable || reviews.length > 0;

  // Nav only lists sections that actually render. Hero is the page itself
  // (no anchor needed). Services and Contact always render, so they're
  // always present.
  const navItems: string[] = [];
  if (showAbout) navItems.push("About");
  navItems.push("Services");
  if (showGallery) navItems.push("Gallery");
  if (showReviews) navItems.push("Reviews");
  navItems.push("Contact");

  // Inline editable text → input/textarea in editor, plain text in display.
  const Field = ({ k, tag: Tag = "span", className = "", editClassName = "", multiline = false, rows = 2 }: {
    k: string; tag?: any; className?: string; editClassName?: string; multiline?: boolean; rows?: number;
  }) => {
    if (editable) {
      const cls = `bg-white/95 border-2 border-dashed border-blue-300 rounded-lg px-3 py-2 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full ${editClassName}`;
      const common = { value: textValue(k), placeholder: resolve(k), onChange: (e: any) => setText(k, e.target.value), className: cls };
      return multiline ? <textarea {...common} rows={rows} /> : <input type="text" {...common} />;
    }
    const shown = resolve(k);
    if (!shown) return null;
    return <Tag className={className}>{shown}</Tag>;
  };

  const Eyebrow = ({ k, dark }: { k: string; dark?: boolean }) => (
    editable
      ? <input value={textValue(k)} placeholder={resolve(k)} onChange={(e) => setText(k, e.target.value)} className="bg-white/95 border-2 border-dashed border-blue-300 rounded px-2 py-1 text-xs uppercase tracking-[0.2em] mb-4 text-stone-900 w-48" />
      : <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: dark ? "#a8a29e" : accent }}>{resolve(k)}</p>
  );

  // Nav markup — placed differently in editor vs live (see below).
  const navInner = (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="w-9 h-9 rounded-full object-cover bg-stone-200" />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: accent }}>{businessName?.charAt(0) || "?"}</div>
          )}
          {editable && (
            <button onClick={() => logoInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white shadow" title="Replace logo">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16" /></svg>
            </button>
          )}
        </div>
        {editable ? (
          <input value={textValue("businessName")} placeholder={businessName} onChange={(e) => setText("businessName", e.target.value)} className="bg-white/95 border-2 border-dashed border-blue-300 rounded px-2 py-1 text-base font-bold text-stone-900 w-44" />
        ) : (
          <span className={`text-base sm:text-lg font-bold tracking-tight truncate ${scrolled ? "text-stone-900" : "text-white drop-shadow"}`}>{businessName}</span>
        )}
      </div>
      <nav className="hidden sm:flex items-center gap-7 text-sm">
        {navItems.map((label) => (
          <a key={label} href={`#${label.toLowerCase()}`} className={`font-medium transition-colors ${scrolled && !editable ? "text-stone-600 hover:text-stone-900" : "text-white/80 hover:text-white drop-shadow"}`}>{label}</a>
        ))}
        <button onClick={onBookNow} className="inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-90" style={{ backgroundColor: accent }}>Book Now</button>
      </nav>
      <button onClick={onBookNow} className="sm:hidden text-white text-xs font-bold px-3 py-2 rounded-full" style={{ backgroundColor: accent }}>Book Now</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Crop/reframe modal — drag + pinch/zoom a photo into its on-page
          rectangle, or choose to show it whole. */}
      {editable && framing && (
        <ImageFrameModal
          src={framing === "banner" ? bannerImage : aboutImage}
          aspect={frameAspect}
          title={framing === "banner" ? "Frame your banner photo" : "Frame your photo"}
          initial={
            framing === "banner"
              ? { zoom: bannerZoom, posX: posOf("bannerPosX"), posY: posOf("bannerPosY"), fit: bannerFit }
              : { zoom: coverZoom, posX: posOf("coverPosX"), posY: posOf("coverPosY"), fit: coverFit }
          }
          onCancel={() => setFraming(null)}
          onApply={(v) => applyFraming(framing, v)}
        />
      )}
      {/* ── EDITOR TOOLBAR ──────────────────────────────────────────── */}
      {editable && (
        <div className="sticky top-0 z-[60] bg-stone-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
            {onBack && (
              <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Dashboard
              </button>
            )}
            <span className="text-sm font-bold hidden sm:inline">Edit your page</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-white/70 mr-1 hidden sm:inline">Color</span>
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setAccent(c)} title={c} className={`w-5 h-5 rounded-full border-2 transition-transform ${accent.toLowerCase() === c.toLowerCase() ? "border-white scale-110" : "border-transparent hover:scale-110"}`} style={{ backgroundColor: c }} />
              ))}
              <label className="relative w-5 h-5 rounded-full border-2 border-white/30 overflow-hidden cursor-pointer ml-0.5" title="Custom color">
                <span className="absolute inset-0 bg-gradient-to-br from-pink-500 via-yellow-400 to-blue-500" />
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
            <button onClick={save} disabled={!dirty || saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-colors">
              {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save"}
            </button>
          </div>
          {saveError && <div className="bg-red-600 text-white text-xs px-4 py-1.5 text-center">{saveError}</div>}
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("bannerImage", e.target.files?.[0])} />
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("logo", e.target.files?.[0])} />
        </div>
      )}

      {/* Live page: fixed transparent nav over the hero. */}
      {!editable && (
        <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm" : "bg-transparent"}`}>
          {navInner}
        </header>
      )}

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative w-full h-[58vh] min-h-[440px] sm:h-screen sm:min-h-[640px] flex items-end overflow-hidden">
        {/* Dark base is always present so there's no flash and the photo
            can fade in over it (no visible top-down JPEG paint). */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950" />
        {bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerImage}
            alt=""
            // @ts-expect-error fetchPriority is a valid DOM attr
            fetchpriority="high"
            decoding="async"
            // Covers cached images, where onLoad may not fire after mount.
            ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setBannerLoaded(true); }}
            onLoad={() => setBannerLoaded(true)}
            style={{ objectPosition: bannerPos, objectFit: bannerFit, transform: bannerFit === "cover" && bannerZoom > 1 ? `scale(${bannerZoom})` : undefined, transformOrigin: "center" }}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${bannerLoaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          // No custom banner → default detailing photos. <picture> lets the
          // browser download ONLY the portrait (mobile) or landscape
          // (desktop) version, not both.
          // eslint-disable-next-line @next/next/no-img-element
          <picture>
            <source media="(max-width: 639px)" srcSet={DEFAULT_BANNER_MOBILE} />
            <source media="(min-width: 640px)" srcSet={DEFAULT_BANNER_DESKTOP} />
            <img
              src={DEFAULT_BANNER_DESKTOP}
              alt=""
              // @ts-expect-error fetchPriority is a valid DOM attr
              fetchpriority="high"
              decoding="async"
              ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setBannerLoaded(true); }}
              onLoad={() => setBannerLoaded(true)}
              style={{ objectPosition: bannerPos }}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${bannerLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </picture>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/65 to-black/55" />

        {/* Editor: nav sits inside the hero (below the toolbar). */}
        {editable && <div className="absolute top-0 left-0 right-0 z-30">{navInner}</div>}

        {editable && (
          <div className="absolute top-20 right-5 z-30 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => bannerInputRef.current?.click()} className="inline-flex items-center gap-2 bg-white/90 text-stone-900 text-sm font-bold px-4 py-2 rounded-full shadow-lg hover:bg-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {bannerImage ? "Replace banner" : "Add banner photo"}
              </button>
              {bannerImage && (
                <button onClick={() => removeImage("bannerImage")} title="Remove banner photo" className="inline-flex items-center gap-1.5 bg-white/90 text-red-600 text-sm font-bold px-3 py-2 rounded-full shadow-lg hover:bg-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Remove
                </button>
              )}
            </div>
            {/* Adjust = open the crop/reframe modal: drag + pinch/zoom the
                photo into the banner rectangle, or choose to show it whole. */}
            {bannerImage ? (
              <button
                onClick={() => openFramer("banner")}
                title="Drag and zoom to frame the banner exactly how you want"
                className="bg-white/95 rounded-full shadow-lg px-4 py-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-stone-700 hover:bg-white whitespace-nowrap"
              >
                <svg className="w-4 h-4 text-stone-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /></svg>
                Adjust banner
              </button>
            ) : (
              // No custom banner → keep a simple up/down slider for the default.
              <div className="bg-white/95 rounded-full shadow-lg pl-3 pr-3.5 py-2 flex items-center gap-2.5">
                <svg className="w-4 h-4 text-stone-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18m0 0l-4-4m4 4l4-4" /></svg>
                <span className="text-[11px] font-bold uppercase tracking-wide text-stone-600 whitespace-nowrap">Banner position</span>
                <input type="range" min={0} max={100} value={posOf("bannerPosY")} onChange={(e) => setText("bannerPosY", e.target.value)} className="w-28 accent-blue-600 cursor-pointer" title="Drag to move the photo up or down" />
              </div>
            )}
          </div>
        )}

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pb-10 sm:pb-24">
          {editable ? (
            <div className="max-w-2xl space-y-3">
              <Field k="heroEyebrow" editClassName="max-w-xs text-sm uppercase tracking-widest" />
              <Field k="bookingPageTitle" editClassName="text-2xl font-black" />
              <Field k="bookingPageSubtitle" multiline rows={2} />
            </div>
          ) : (
            <>
              <p className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] mb-4">{resolve("heroEyebrow")}</p>
              <h1 className="text-white text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight max-w-3xl mb-5 sm:mb-7">{resolve("bookingPageTitle")}</h1>
              <p className="text-white/85 text-base sm:text-xl leading-relaxed max-w-xl mb-8 sm:mb-10">{resolve("bookingPageSubtitle")}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={onBookNow} className="inline-flex items-center gap-2 text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-full transition-opacity hover:opacity-90 shadow-lg" style={{ backgroundColor: accent }}>
                  {resolve("heroPrimaryBtn")}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
                <a href="#services" className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-full transition-colors">{resolve("heroSecondaryBtn")}</a>
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
      {showAbout && (
      <section id="about" className="bg-stone-50 py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-20 items-start">
          <div>
            <Eyebrow k="aboutEyebrow" />
            <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight mb-6">
              <span>{businessName}</span>
              {/* Tagline reads as a real claim ("5+ years of obsession…")
                  so we only show it when there's a real `years` value to
                  anchor it. Editor always shows the input so the owner
                  can fill it in. */}
              {(editable || realYears > 0) && (
                <>
                  <span>{" — "}</span>
                  {editable
                    ? <span className="block mt-2"><Field k="aboutTagline" editClassName="text-lg" /></span>
                    : <span className="text-stone-500">{resolve("aboutTagline")}</span>}
                </>
              )}
            </h2>
            {editable
              ? <Field k="bio" multiline rows={5} />
              : realBio
                ? <p className="text-stone-600 text-lg leading-relaxed max-w-xl">{realBio}</p>
                : null}

            {/* Years-in-business editor (number). Drives the stat + the
                about tagline default. */}
            {editable && (
              <div className="mt-6 flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-stone-500">Years in business</label>
                <input
                  type="number"
                  min={0}
                  value={colDraft["yearsInBusiness"] !== undefined ? colDraft["yearsInBusiness"] : (profile.yearsInBusiness ?? "")}
                  onChange={(e) => setColDraft((d) => ({ ...d, yearsInBusiness: e.target.value }))}
                  className="w-20 bg-white border-2 border-dashed border-blue-300 rounded px-2 py-1 text-sm text-stone-900"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-6 max-w-md text-sm mt-8">
              {(years > 0 || editable) ? <Stat labelKey="statYearsLabel" value={`${years || 0}+`} resolve={resolve} editable={editable} textValue={textValue} setText={setText} /> : null}
              {profile.serviceAreas && profile.serviceAreas.length > 0 ? <Stat labelKey="statAreaLabel" value={profile.serviceAreas[0]} resolve={resolve} editable={editable} textValue={textValue} setText={setText} /> : null}
              {packages.length > 0 ? <Stat labelKey="statServicesLabel" value={`${packages.length}`} resolve={resolve} editable={editable} textValue={textValue} setText={setText} /> : null}
            </div>
          </div>
          <div ref={coverBoxRef} className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-stone-200 shadow-2xl">
            {aboutImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={aboutImage} alt="" style={{ objectPosition: coverPos, objectFit: coverFit, transform: coverFit === "cover" && coverZoom > 1 ? `scale(${coverZoom})` : undefined, transformOrigin: "center" }} className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-white/40 text-sm">No photo yet</div>
            )}
            {editable && (
              <>
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <button onClick={() => aboutImgInputRef.current?.click()} className="inline-flex items-center gap-2 bg-white/90 text-stone-900 text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {hasCustomCover ? "Replace" : "Add photo"}
                  </button>
                  {hasCustomCover && (
                    <button onClick={() => removeImage("coverImage")} title="Remove photo" className="inline-flex items-center justify-center bg-white/90 text-red-600 w-7 h-7 rounded-full shadow hover:bg-white">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
                {aboutImage && (
                  <div className="absolute bottom-3 left-3 z-10">
                    {/* Adjust = drag + zoom the photo into this frame. */}
                    <button
                      onClick={() => openFramer("cover")}
                      title="Drag and zoom to frame this photo exactly how you want"
                      className="bg-white/90 rounded-full shadow px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-700 hover:bg-white whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5 text-stone-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" /></svg>
                      Adjust photo
                    </button>
                  </div>
                )}
                <input ref={aboutImgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage("coverImage", e.target.files?.[0])} />
              </>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── SERVICES ────────────────────────────────────────────────── */}
      <section id="services" className="bg-white py-20 sm:py-28 px-5 sm:px-8 border-y border-stone-200">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <Eyebrow k="servicesEyebrow" />
            {editable
              ? <Field k="servicesHeading" editClassName="text-2xl font-black" />
              : <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight max-w-xl">{resolve("servicesHeading")}</h2>}
          </div>

          {/* ── Vehicle-type picker (live page only). Whatever the
              customer picks here filters the services grid below and
              gets baked into the price preview, so they never tap a
              card they can't actually book. */}
          {!editable && packages.length > 0 && (() => {
            const tieredExists = packages.some((p) => Array.isArray(p.vehiclePricing) && (p.vehiclePricing as any[]).length > 0);
            if (!tieredExists) return null;
            return (
              <div className="mb-10 bg-stone-50 border border-stone-200 rounded-2xl p-5 sm:p-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-stone-500">Step 1 — Pick your vehicle</p>
                  {selectedVehicleType && (
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleType(null)}
                      className="text-xs font-semibold text-stone-500 hover:text-stone-900 underline"
                    >
                      Show all
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {VEHICLE_TYPES.map((v) => {
                    const active = selectedVehicleType === v.id;
                    const supported = packages.some((p) => packageSupportsVehicleType(p.vehiclePricing ?? null, v.id));
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVehicleType(active ? null : v.id)}
                        disabled={!supported}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                          active
                            ? "bg-stone-900 border-stone-900 text-white"
                            : supported
                              ? "bg-white border-stone-200 text-stone-700 hover:border-stone-400"
                              : "bg-stone-100 border-stone-100 text-stone-300 cursor-not-allowed"
                        }`}
                      >
                        <VehicleIcon type={v.id} className="w-6 h-6" />
                        <span className="text-[11px] font-bold leading-tight">{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {packages.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-10 text-center text-stone-500">No services listed yet.{editable ? " Add them on the Packages page." : ""}</div>
          ) : (() => {
            // Gate the services grid on a vehicle pick whenever the
            // picker is rendered (i.e. at least one package has tiers).
            // The owner asked for "pick first, then see services" — so
            // even flat-priced services stay hidden until the customer
            // tells us what they drive.
            const tieredExists = packages.some((p) => Array.isArray(p.vehiclePricing) && (p.vehiclePricing as any[]).length > 0);
            if (!editable && tieredExists && !selectedVehicleType) {
              return (
                <div className="bg-stone-50 border-2 border-dashed border-stone-300 rounded-2xl p-10 text-center">
                  <p className="text-stone-700 font-bold text-base mb-1">Pick your vehicle type above.</p>
                  <p className="text-stone-500 text-sm">Your services will appear with the price for your vehicle.</p>
                </div>
              );
            }

            // Filter packages by the picked vehicle type (live page only).
            // packageSupportsVehicleType returns true for flat-priced
            // packages too, so they always show up regardless of pick.
            const visible = (!editable && selectedVehicleType)
              ? packages.filter((p) => packageSupportsVehicleType(p.vehiclePricing ?? null, selectedVehicleType))
              : packages;

            if (visible.length === 0) {
              return (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-10 text-center">
                  <p className="text-stone-600 font-semibold mb-1">No services for that vehicle type yet.</p>
                  <button
                    type="button"
                    onClick={() => setSelectedVehicleType(null)}
                    className="text-sm text-stone-900 underline font-semibold"
                  >
                    Show all services
                  </button>
                </div>
              );
            }

            return (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {visible.map((pkg) => {
                  const surcharge = selectedVehicleType
                    ? surchargeForVehicleType(pkg.vehiclePricing ?? null, selectedVehicleType)
                    : 0;
                  const displayPrice = pkg.price + surcharge;
                  const bookThis = () => { if (editable) return; (onSelectPackage ? onSelectPackage(pkg, selectedVehicleType) : onBookNow()); };
                  return (
                  <div
                    key={pkg.id}
                    onClick={bookThis}
                    className={`group bg-white border border-stone-200 rounded-2xl p-5 sm:p-7 flex flex-col text-left transition-all ${editable ? "" : "cursor-pointer hover:border-stone-900 hover:-translate-y-0.5 hover:shadow-xl shadow-stone-200/60"}`}
                  >
                    <div className="flex items-start justify-between mb-4 sm:mb-5">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-xl sm:text-2xl">{PACKAGE_ICONS[pkg.name] ?? "🚗"}</div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{formatDuration(pkg.duration)}</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold leading-snug mb-2">{pkg.name}</h3>
                    {pkg.description
                      ? <p className="text-stone-500 text-sm leading-relaxed mb-4 sm:mb-6 flex-1 line-clamp-3">{pkg.description}</p>
                      : <div className="flex-1 mb-4 sm:mb-6" />}
                    <div className="flex items-baseline justify-between border-t border-stone-100 pt-4 sm:pt-5">
                      <div>
                        <p className="text-2xl sm:text-3xl font-black tracking-tight">${displayPrice}</p>
                        {surcharge > 0 && (
                          <p className="text-[11px] text-stone-400 mt-0.5">${pkg.price} base + ${surcharge}</p>
                        )}
                        {surcharge === 0 && (pkg.deposit ?? 0) > 0 && (
                          <p className="text-[11px] text-stone-400 mt-0.5">${pkg.deposit} deposit</p>
                        )}
                      </div>
                      {!editable && <span className="text-xs font-bold uppercase tracking-widest text-stone-500 group-hover:text-stone-900 transition-colors">Book →</span>}
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })()}
          {editable && <p className="text-center text-xs text-stone-400 mt-6">Services are managed on the Packages page — they appear here automatically.</p>}
        </div>
      </section>

      {/* ── GALLERY ─────────────────────────────────────────────────── */}
      {showGallery && (
        <section id="gallery" className="bg-stone-100 py-20 sm:py-28 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 flex flex-col items-center">
              <Eyebrow k="galleryEyebrow" />
              {editable
                ? <Field k="galleryTitle" editClassName="text-2xl font-black max-w-sm" />
                : <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">{resolve("galleryTitle") || "Recent work."}</h2>}
              {editable && onManageGallery && <div className="mt-4"><button onClick={onManageGallery} className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 border border-stone-300 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors">{photos.length > 0 ? "Manage photos" : "Add photos"}</button></div>}
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
      {showReviews && (
        <section id="reviews" className="bg-stone-900 py-20 sm:py-28 px-5 sm:px-8 text-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14 flex flex-col items-center">
              <Eyebrow k="reviewsEyebrow" dark />
              {editable
                ? <Field k="reviewsHeading" editClassName="text-2xl font-black max-w-md" />
                : <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">{resolve("reviewsHeading")}</h2>}
              {editable && onManageReviews && <div className="mt-4"><button onClick={onManageReviews} className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">{reviews.length > 0 ? "Manage reviews" : "Add reviews"}</button></div>}
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
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          {editable
            ? <Field k="ctaHeading" editClassName="text-3xl font-black text-center max-w-lg mb-4" />
            : <h2 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">{resolve("ctaHeading")}</h2>}
          {editable
            ? <Field k="ctaSubtitle" multiline rows={2} editClassName="text-center max-w-xl mb-6" />
            : <p className="text-stone-600 text-lg max-w-xl mx-auto mb-10">{resolve("ctaSubtitle")}</p>}
          <button onClick={onBookNow} className="inline-flex items-center gap-2 text-white font-bold text-base px-9 py-4 rounded-full transition-opacity hover:opacity-90 shadow-lg" style={{ backgroundColor: accent }}>
            {resolve("ctaButton")}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
        </div>
      </section>

      {/* ── CONTACT / FOOTER ────────────────────────────────────────── */}
      <footer id="contact" className="bg-stone-100 border-t border-stone-200 px-5 sm:px-8 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-7 md:gap-10">
          <div>
            <Eyebrow k="contactEyebrow" />
            <p className="text-stone-900 font-bold text-lg mb-3">{businessName}</p>
            {editable ? (
              <div className="space-y-2 max-w-xs">
                <Field k="phone" editClassName="text-sm" />
                <Field k="address" editClassName="text-sm" />
              </div>
            ) : (
              <>
                {resolve("phone") && <a href={`tel:${resolve("phone")}`} className="block text-stone-700 hover:text-stone-900 text-sm mb-1">📞 {resolve("phone")}</a>}
                {resolve("address") && <p className="text-stone-700 text-sm mb-1">📍 {resolve("address")}</p>}
                {!resolve("address") && profile.serviceAreas && profile.serviceAreas.length > 0 && <p className="text-stone-700 text-sm">📍 {profile.serviceAreas.join(", ")}</p>}
              </>
            )}
          </div>
          <div className="border-t border-stone-200 pt-7 md:border-t-0 md:pt-0">
            <Eyebrow k="bookEyebrow" />
            <button onClick={onBookNow} className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-white font-semibold text-sm px-5 py-3 sm:py-2.5 rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: accent }}>Open booking →</button>
            {editable
              ? <div className="mt-3 max-w-xs"><Field k="bookNote" multiline rows={2} editClassName="text-xs" /></div>
              : <p className="text-stone-500 text-xs mt-3 leading-relaxed">{resolve("bookNote")}</p>}
          </div>
          <div className="border-t border-stone-200 pt-7 md:border-t-0 md:pt-0">
            <Eyebrow k="followEyebrow" />
            {editable ? (
              <div className="space-y-2 max-w-xs">
                <Field k="instagram" editClassName="text-sm" />
                <Field k="facebook" editClassName="text-sm" />
                <Field k="website" editClassName="text-sm" />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 text-sm">
                {resolve("instagram") && <a href={`https://instagram.com/${resolve("instagram").replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Instagram → @{resolve("instagram").replace(/^@/, "")}</a>}
                {resolve("facebook") && <a href={resolve("facebook").startsWith("http") ? resolve("facebook") : `https://facebook.com/${resolve("facebook")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Facebook</a>}
                {resolve("website") && <a href={resolve("website").startsWith("http") ? resolve("website") : `https://${resolve("website")}`} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900">Website → {resolve("website")}</a>}
                {!resolve("instagram") && !resolve("facebook") && !resolve("website") && <span className="text-stone-400 text-sm">No links yet.</span>}
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

function Stat({ labelKey, value, resolve, editable, textValue, setText }: {
  labelKey: string; value: string;
  resolve: (k: string) => string; editable: boolean;
  textValue: (k: string) => string; setText: (k: string, v: string) => void;
}) {
  return (
    <div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      {editable
        ? <input value={textValue(labelKey)} placeholder={resolve(labelKey)} onChange={(e) => setText(labelKey, e.target.value)} className="mt-1 bg-white border-2 border-dashed border-blue-300 rounded px-2 py-1 text-xs uppercase tracking-widest text-stone-700 w-full" />
        : <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mt-1">{resolve(labelKey)}</p>}
    </div>
  );
}
