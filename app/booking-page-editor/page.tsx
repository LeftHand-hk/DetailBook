"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, setUserLocal, isLoggedIn } from "@/lib/storage";
import { fetchBookingPageSettings, saveBookingPageSettings } from "@/lib/booking-page-settings";
import type { User } from "@/types";
import BookingV2Landing, { type V2Package, type V2Review, type V2Photo } from "@/components/BookingV2Landing";
import PhotoGalleryEditor from "@/components/PhotoGalleryEditor";
import ReviewsEditor from "@/components/ReviewsEditor";

// Standalone, full-page WYSIWYG editor for the booking page.
//
// Deliberately NOT under /dashboard — it renders OUTSIDE the dashboard
// layout (no sidebar, no nested dvh scroll container) so the full-bleed
// editorial page is light and scrolls natively. The dashboard nav links
// here; a "Dashboard" button in the editor toolbar goes back.
//
// Fast first paint: we render from the cached user immediately and pull
// fresh data (user/packages/reviews/photos) in the background, filling
// the preview in as it arrives instead of blocking on a spinner.
export default function BookingPageEditorStandalone() {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [packages, setPackages] = useState<V2Package[]>([]);
  const [reviews, setReviews] = useState<V2Review[]>([]);
  const [photos, setPhotos] = useState<V2Photo[]>([]);
  const [ready, setReady] = useState(false);

  const [galleryLayout, setGalleryLayout] = useState<"grid" | "carousel" | "masonry">("grid");
  const [galleryShowTitle, setGalleryShowTitle] = useState(true);
  const [galleryTitle, setGalleryTitle] = useState("Our Work");
  const [reviewsLayout, setReviewsLayout] = useState<"carousel" | "grid" | "list">("carousel");
  const [reviewsShowStars, setReviewsShowStars] = useState(true);
  const [reviewsShowAvatars, setReviewsShowAvatars] = useState(true);
  const [reviewsShowDates, setReviewsShowDates] = useState(true);
  const initialLoad = useRef(false);

  const galleryRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);

  const hydrateOpts = useCallback((u: any) => {
    setGalleryLayout(u.galleryLayout || "grid");
    setGalleryShowTitle(u.galleryShowTitle ?? true);
    setGalleryTitle(u.galleryTitle || "Our Work");
    setReviewsLayout(u.reviewsLayout || "carousel");
    setReviewsShowStars(u.reviewsShowStars ?? true);
    setReviewsShowAvatars(u.reviewsShowAvatars ?? true);
    setReviewsShowDates(u.reviewsShowDates ?? true);
  }, []);

  const loadPhotos = useCallback(() => {
    fetch("/api/photos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      // BusinessPhoto rows use photoUrl/caption; the v2 gallery expects
      // imageUrl/title — map field names so photos actually render.
      .then((data) => { if (Array.isArray(data)) setPhotos(data.map((p: any) => ({ id: p.id, imageUrl: p.photoUrl, title: p.caption }))); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }

    // Paint immediately from cache.
    const cached = getUser();
    if (cached) { setUserState(cached); hydrateOpts(cached); setReady(true); }

    // Pull the authoritative design settings from the single GET. Image
    // columns arrive as small display URLs (real upload URL, or the binary
    // route for legacy base64) so the banner + About image render and can be
    // edited without ever shipping the heavy base64 to the client.
    fetchBookingPageSettings()
      .then((settings) => {
        if (settings) {
          setUserState(settings as unknown as User);
          hydrateOpts(settings);
        }
        setReady(true);
      })
      .catch(() => setReady(true));

    fetch("/api/packages", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then((p) => { if (Array.isArray(p)) setPackages(p.filter((x: any) => x.active)); }).catch(() => {});
    fetch("/api/reviews", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then((rv) => { if (Array.isArray(rv)) setReviews(rv.map((r: any) => ({ id: r.id, customerName: r.customerName, rating: r.rating, reviewText: r.reviewText, reviewDate: r.reviewDate }))); }).catch(() => {});
    loadPhotos();

    setTimeout(() => { initialLoad.current = true; }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave gallery/reviews display options.
  useEffect(() => {
    if (!initialLoad.current || !user) return;
    const t = setTimeout(() => {
      const patch = { galleryLayout, galleryShowTitle, galleryTitle, reviewsLayout, reviewsShowStars, reviewsShowAvatars, reviewsShowDates };
      // Cache-only locally (no whole-user background PUT) + the single design
      // writer, so this autosave can't race or revert other design edits.
      setUserLocal({ ...user, ...patch } as User);
      void saveBookingPageSettings(patch);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryLayout, galleryShowTitle, galleryTitle, reviewsLayout, reviewsShowStars, reviewsShowAvatars, reviewsShowDates]);

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const u = user as any;

  return (
    <div className="bg-stone-50">
      <BookingV2Landing
        profile={{
          businessName: user.businessName || "",
          bio: u.bio,
          city: u.city,
          address: u.address,
          phone: u.phone,
          instagram: u.instagram,
          facebook: u.facebook,
          website: u.website,
          yearsInBusiness: u.yearsInBusiness,
          rating: u.rating,
          reviewCount: u.reviewCount,
          serviceAreas: u.serviceAreas,
          logo: u.logo,
          bannerImage: u.bannerImage,
          coverImage: u.coverImage,
          bookingPageTitle: u.bookingPageTitle,
          bookingPageSubtitle: u.bookingPageSubtitle,
          accentColor: u.accentColor,
          galleryTitle,
          pageContent: u.pageContent ?? null,
        }}
        packages={packages}
        reviews={reviews}
        photos={photos}
        editable
        onBack={() => router.push("/dashboard")}
        onBookNow={() => { /* preview only */ }}
        onSaved={(fields) => {
          // BookingV2Landing already persisted via PATCH /api/booking-page;
          // just mirror the change into state + local cache (no extra PUT).
          const updated = { ...user, ...fields } as User;
          setUserState(updated);
          setUserLocal(updated);
        }}
        onManageGallery={() => galleryRef.current?.scrollIntoView({ behavior: "smooth" })}
        onManageReviews={() => reviewsRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      {/* Photos & reviews management below the live preview. */}
      <div className="bg-stone-100 px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div ref={galleryRef} className="scroll-mt-4">
            <PhotoGalleryEditor
              layout={galleryLayout}
              showTitle={galleryShowTitle}
              title={galleryTitle}
              onLayoutChange={setGalleryLayout}
              onShowTitleChange={setGalleryShowTitle}
              onTitleChange={setGalleryTitle}
            />
            <div className="text-right mt-2">
              <button onClick={loadPhotos} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Refresh preview photos ↑</button>
            </div>
          </div>
          <div ref={reviewsRef} className="scroll-mt-4">
            <ReviewsEditor
              layout={reviewsLayout}
              showStars={reviewsShowStars}
              showAvatars={reviewsShowAvatars}
              showDates={reviewsShowDates}
              onLayoutChange={setReviewsLayout}
              onShowStarsChange={setReviewsShowStars}
              onShowAvatarsChange={setReviewsShowAvatars}
              onShowDatesChange={setReviewsShowDates}
            />
          </div>
          <div className="text-center pt-4">
            <button onClick={() => router.push("/dashboard")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
