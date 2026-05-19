"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// V2 booking-page preview — a modern editorial / magazine-style layout
// for the public booking page. This route is an experiment: it reads
// the same data the production /book/[slug] page reads, but rearranges
// it into a long-scroll site that feels like a real business website
// (Squarespace-class, not "form on a card"). The CTA buttons send the
// visitor back to /book/[slug] for the actual booking flow so we don't
// duplicate that logic until we decide to ship v2.

type Pkg = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
  deposit?: number | null;
};

type Review = {
  id: string;
  customerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string | null;
};

type Photo = {
  id: string;
  imageUrl: string;
  title?: string | null;
  beforeImageUrl?: string | null;
};

type Profile = {
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
  packages: Pkg[];
  reviews: Review[];
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

export default function BookingPageV2({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch(`/api/book/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            businessName: data.businessName,
            bio: data.bio,
            city: data.city,
            address: data.address,
            phone: data.phone,
            instagram: data.instagram,
            facebook: data.facebook,
            website: data.website,
            yearsInBusiness: data.yearsInBusiness,
            rating: data.rating,
            reviewCount: data.reviewCount,
            serviceAreas: data.serviceAreas,
            logo: data.logo,
            bannerImage: data.bannerImage,
            bookingPageTitle: data.bookingPageTitle,
            bookingPageSubtitle: data.bookingPageSubtitle,
            accentColor: data.accentColor,
            galleryTitle: data.galleryTitle,
            packages: (data.packages || []).filter((p: Pkg) => p.active),
            reviews: data.reviews || [],
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetch(`/api/book/${slug}/photos`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setPhotos(data);
      })
      .catch(() => { /* gallery just stays empty */ });
  }, [slug]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Business not found</h1>
          <p className="text-stone-500">The link you followed may be broken or the business has moved.</p>
        </div>
      </div>
    );
  }

  const accent = profile.accentColor || "#0F172A"; // editorial = darker than the operational page
  const hasAvg = (profile.rating || 0) > 0 && (profile.reviewCount || 0) > 0;
  const heroTitle = profile.bookingPageTitle || profile.businessName;
  const heroSubtitle = profile.bookingPageSubtitle || (
    profile.bio
      ? profile.bio.length > 140 ? profile.bio.slice(0, 140) + "…" : profile.bio
      : "Professional auto detailing — book online in under a minute."
  );
  const bookHref = `/book/${slug}`;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-[system-ui]">

      {/* ── STICKY NAV ─────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {profile.logo ? (
              // Owner-uploaded logo. <img> is fine here — these are base64 data URLs
              // from the existing storage, not optimisable through next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo} alt="" className="w-9 h-9 rounded-full object-cover bg-stone-200" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center text-sm font-bold">
                {profile.businessName?.charAt(0) || "?"}
              </div>
            )}
            <span className={`text-base sm:text-lg font-bold tracking-tight truncate ${scrolled ? "text-stone-900" : "text-white drop-shadow"}`}>
              {profile.businessName}
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-7 text-sm">
            {["About", "Services", "Gallery", "Reviews", "Contact"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className={`font-medium transition-colors ${
                  scrolled ? "text-stone-600 hover:text-stone-900" : "text-white/80 hover:text-white drop-shadow"
                }`}
              >
                {label}
              </a>
            ))}
            <Link
              href={bookHref}
              className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
            >
              Book Now
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </nav>
          {/* Mobile: just a Book Now pill */}
          <Link
            href={bookHref}
            className="sm:hidden bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3 py-2 rounded-full"
          >
            Book Now
          </Link>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative w-full h-screen min-h-[640px] flex items-end overflow-hidden">
        {profile.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.bannerImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-700" />
        )}
        {/* Dark gradient overlay so the headline is always legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pb-16 sm:pb-24">
          <p className="text-white/70 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] mb-4">
            {profile.city || profile.serviceAreas?.[0] || "Auto Detailing"}
          </p>
          <h1 className="text-white text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight max-w-3xl mb-5 sm:mb-7">
            {heroTitle}
          </h1>
          <p className="text-white/85 text-base sm:text-xl leading-relaxed max-w-xl mb-8 sm:mb-10">
            {heroSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={bookHref}
              className="inline-flex items-center gap-2 bg-white text-stone-900 hover:bg-stone-100 font-bold text-sm sm:text-base px-7 py-3.5 rounded-full transition-colors shadow-lg"
            >
              Book Your Detail
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#services"
              className="inline-flex items-center gap-2 border border-white/40 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-6 py-3.5 rounded-full transition-colors"
            >
              See services
            </a>
          </div>
          {hasAvg && (
            <div className="mt-8 flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i <= Math.round(profile.rating || 0) ? "text-amber-400" : "text-white/20"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-white text-sm font-medium">
                {(profile.rating || 0).toFixed(1)} · {profile.reviewCount} reviews
              </span>
            </div>
          )}
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest hidden sm:flex items-center gap-2 animate-pulse">
          <span>Scroll</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ── ABOUT ──────────────────────────────────────────────────── */}
      <section id="about" className="bg-stone-50 py-20 sm:py-28 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-20 items-start">
          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">About</p>
            <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight mb-6">
              {profile.businessName} —{" "}
              <span className="text-stone-500">
                {profile.yearsInBusiness
                  ? `${profile.yearsInBusiness}+ years of obsession with finish.`
                  : "obsessive attention to every panel."}
              </span>
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed max-w-xl mb-8">
              {profile.bio ||
                "From a daily-driver refresh to a multi-stage paint correction, every car gets the same hand-finished attention. Book online and we'll handle the rest."}
            </p>
            <div className="grid grid-cols-2 gap-6 max-w-md text-sm">
              {profile.yearsInBusiness ? (
                <Stat label="Years in business" value={`${profile.yearsInBusiness}+`} />
              ) : null}
              {profile.reviewCount ? (
                <Stat label="Reviews" value={`${profile.reviewCount}`} />
              ) : null}
              {profile.serviceAreas && profile.serviceAreas.length > 0 ? (
                <Stat label="Service area" value={profile.serviceAreas[0]} />
              ) : profile.city ? (
                <Stat label="Based in" value={profile.city} />
              ) : null}
              {profile.packages.length > 0 ? (
                <Stat label="Services" value={`${profile.packages.length}`} />
              ) : null}
            </div>
          </div>

          {/* Sample-of-our-work tile */}
          <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-stone-200 shadow-2xl">
            {photos[0]?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[0].imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : profile.bannerImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-white/40 text-sm">
                Add photos in your dashboard
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Recent work</p>
              <p className="text-white text-lg font-bold mt-1">
                {photos[0]?.title || "Showroom finish, every time."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ───────────────────────────────────────────────── */}
      <section id="services" className="bg-white py-20 sm:py-28 px-5 sm:px-8 border-y border-stone-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-6 mb-12 flex-wrap">
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Services</p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight max-w-xl">
                Pick the right level of detail for your car.
              </h2>
            </div>
            <Link
              href={bookHref}
              className="text-sm font-semibold text-stone-900 underline underline-offset-4 hover:no-underline"
            >
              Book Now →
            </Link>
          </div>

          {profile.packages.length === 0 ? (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-10 text-center">
              <p className="text-stone-500">
                Services will appear here once the owner adds them.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {profile.packages.map((pkg, i) => (
                <Link
                  key={pkg.id}
                  href={bookHref}
                  className="group bg-white border border-stone-200 hover:border-stone-900 rounded-2xl p-7 transition-all hover:-translate-y-0.5 hover:shadow-xl shadow-stone-200/60 flex flex-col"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-stone-100 group-hover:bg-stone-900 rounded-2xl flex items-center justify-center text-2xl transition-colors">
                      <span className="group-hover:hidden">{PACKAGE_ICONS[pkg.name] ?? "🚗"}</span>
                      <span className="hidden group-hover:inline-block text-white">→</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                      {formatDuration(pkg.duration)}
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold leading-snug mb-2">{pkg.name}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                    {pkg.description}
                  </p>
                  <div className="flex items-baseline justify-between border-t border-stone-100 pt-5">
                    <div>
                      <p className="text-3xl font-black tracking-tight">${pkg.price}</p>
                      {pkg.deposit && pkg.deposit > 0 && (
                        <p className="text-[11px] text-stone-400 mt-0.5">${pkg.deposit} deposit</p>
                      )}
                    </div>
                    <span
                      className="text-xs font-bold uppercase tracking-widest text-stone-500 group-hover:text-stone-900 transition-colors"
                    >
                      Book →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <section id="gallery" className="bg-stone-100 py-20 sm:py-28 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Gallery</p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
                {profile.galleryTitle || "Recent work."}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.slice(0, 12).map((p, i) => (
                <div
                  key={p.id}
                  className={`relative overflow-hidden rounded-xl bg-stone-200 ${
                    i % 7 === 0 ? "aspect-[4/5] sm:row-span-2 sm:aspect-auto" : "aspect-square"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                  {p.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-semibold">{p.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── REVIEWS ────────────────────────────────────────────────── */}
      {profile.reviews.length > 0 && (
        <section id="reviews" className="bg-stone-900 py-20 sm:py-28 px-5 sm:px-8 text-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-stone-400 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Reviews</p>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
                What our customers say.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {profile.reviews.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="bg-stone-800/60 border border-white/10 rounded-2xl p-6 flex flex-col"
                >
                  <div className="flex items-center gap-0.5 mb-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${i <= r.rating ? "text-amber-400" : "text-stone-700"}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-white/90 leading-relaxed text-base flex-1 mb-5">
                    &ldquo;{r.reviewText}&rdquo;
                  </p>
                  <p className="text-white text-sm font-bold">{r.customerName}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BIG CTA ────────────────────────────────────────────────── */}
      <section className="bg-stone-50 py-24 sm:py-32 px-5 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-6">
            Ready to book?
          </h2>
          <p className="text-stone-600 text-lg max-w-xl mx-auto mb-10">
            Pick a service, pick a slot, and you&apos;re set. Most customers finish in under a minute.
          </p>
          <Link
            href={bookHref}
            className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-base px-9 py-4 rounded-full transition-colors shadow-lg"
            style={{ backgroundColor: accent }}
          >
            Book Now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── CONTACT / FOOTER ───────────────────────────────────────── */}
      <footer id="contact" className="bg-stone-100 border-t border-stone-200 px-5 sm:px-8 py-14">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">
          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Contact</p>
            <p className="text-stone-900 font-bold text-lg mb-2">{profile.businessName}</p>
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="block text-stone-700 hover:text-stone-900 text-sm mb-1">
                📞 {profile.phone}
              </a>
            )}
            {profile.address && (
              <p className="text-stone-700 text-sm mb-1">📍 {profile.address}</p>
            )}
            {profile.serviceAreas && profile.serviceAreas.length > 0 && !profile.address && (
              <p className="text-stone-700 text-sm">📍 {profile.serviceAreas.join(", ")}</p>
            )}
          </div>

          {/* Sticky-feeling Book CTA repeat */}
          <div>
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Book online</p>
            <Link
              href={bookHref}
              className="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm px-5 py-2.5 rounded-full"
            >
              Open booking flow →
            </Link>
            <p className="text-stone-500 text-xs mt-3 leading-relaxed">
              Online booking 24/7 — no calls, no DMs, no waiting.
            </p>
          </div>

          {/* Socials */}
          {(profile.instagram || profile.facebook || profile.website) && (
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-[0.3em] mb-4">Follow</p>
              <div className="flex flex-col gap-1.5 text-sm">
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 hover:text-stone-900"
                  >
                    Instagram → @{profile.instagram.replace(/^@/, "")}
                  </a>
                )}
                {profile.facebook && (
                  <a
                    href={profile.facebook.startsWith("http") ? profile.facebook : `https://facebook.com/${profile.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 hover:text-stone-900"
                  >
                    Facebook → {profile.facebook.replace(/^https?:\/\/(www\.)?facebook\.com\//, "")}
                  </a>
                )}
                {profile.website && (
                  <a
                    href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-700 hover:text-stone-900"
                  >
                    Website → {profile.website}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto pt-10 mt-10 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} {profile.businessName}. All rights reserved.</p>
          <p>
            Booking powered by{" "}
            <Link href="/" className="text-stone-900 font-semibold hover:underline">
              DetailBook
            </Link>
          </p>
        </div>
      </footer>

      {/* ── MOBILE STICKY BOOK BAR ─────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-stone-200">
        <Link
          href={bookHref}
          className="block w-full bg-stone-900 hover:bg-stone-800 text-white text-center font-bold py-3 rounded-full"
        >
          Book Now
        </Link>
      </div>
      <div className="sm:hidden h-16" aria-hidden />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-3xl font-black tracking-tight">{value}</p>
      <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mt-1">
        {label}
      </p>
    </div>
  );
}
