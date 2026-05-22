"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getUser, setUser as cacheUser, syncFromServer } from "@/lib/storage";
import type { User } from "@/types";
import BookingV2Landing, { type V2Package, type V2Review, type V2Photo } from "@/components/BookingV2Landing";
import PhotoGalleryEditor from "@/components/PhotoGalleryEditor";
import ReviewsEditor from "@/components/ReviewsEditor";
import DashboardHelp from "@/components/DashboardHelp";

// Booking-page editor — now a WYSIWYG. The owner edits the actual v2
// page inline (click text to change it, click a photo to replace it,
// pick the page colour from the toolbar) instead of filling out a form
// of fields. Photos and reviews are list-based, so they keep their
// dedicated editors in a panel below the live preview.

export default function BookingPageEditor() {
  const [user, setUserState] = useState<User | null>(null);
  const [packages, setPackages] = useState<V2Package[]>([]);
  const [reviews, setReviews] = useState<V2Review[]>([]);
  const [photos, setPhotos] = useState<V2Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // Gallery / reviews display options ride on the user record and
  // autosave independently of the inline WYSIWYG edits.
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

  const loadPhotos = useCallback(() => {
    fetch("/api/photos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setPhotos(data.map((p: any) => ({ id: p.id, imageUrl: p.imageUrl, title: p.title }))); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUserState(u);
      hydrateDisplayOpts(u);
    }
    Promise.all([
      syncFromServer().then(() => getUser()).catch(() => u),
      fetch("/api/packages", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/reviews", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([fresh, pkgs, revs]) => {
      if (fresh) { setUserState(fresh); hydrateDisplayOpts(fresh); }
      if (Array.isArray(pkgs)) setPackages(pkgs.filter((p: any) => p.active));
      if (Array.isArray(revs)) setReviews(revs.map((r: any) => ({ id: r.id, customerName: r.customerName, rating: r.rating, reviewText: r.reviewText, reviewDate: r.reviewDate })));
      setLoading(false);
      setTimeout(() => { initialLoad.current = true; }, 100);
    });
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hydrateDisplayOpts(u: any) {
    setGalleryLayout(u.galleryLayout || "grid");
    setGalleryShowTitle(u.galleryShowTitle ?? true);
    setGalleryTitle(u.galleryTitle || "Our Work");
    setReviewsLayout(u.reviewsLayout || "carousel");
    setReviewsShowStars(u.reviewsShowStars ?? true);
    setReviewsShowAvatars(u.reviewsShowAvatars ?? true);
    setReviewsShowDates(u.reviewsShowDates ?? true);
  }

  // Autosave gallery/reviews display options when they change.
  useEffect(() => {
    if (!initialLoad.current || !user) return;
    const t = setTimeout(() => {
      const patch = {
        galleryLayout, galleryShowTitle, galleryTitle,
        reviewsLayout, reviewsShowStars, reviewsShowAvatars, reviewsShowDates,
      };
      const updated = { ...user, ...patch } as User;
      cacheUser(updated);
      fetch("/api/user", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryLayout, galleryShowTitle, galleryTitle, reviewsLayout, reviewsShowStars, reviewsShowAvatars, reviewsShowDates]);

  if (loading || !user) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading your page…</span>
        </div>
      </div>
    );
  }

  const u = user as any;
  const slug = u.slug || "";

  return (
    <div>
      {/* Header strip */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Your Booking Page</h1>
          <p className="text-xs text-gray-500 mt-0.5">Click any text or photo below to edit it. Don&apos;t forget to Save.</p>
        </div>
        <a
          href={`/book/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          View live
        </a>
      </div>

      {/* WYSIWYG inline editor */}
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
          bookingPageTitle: u.bookingPageTitle,
          bookingPageSubtitle: u.bookingPageSubtitle,
          accentColor: u.accentColor,
          galleryTitle,
        }}
        packages={packages}
        reviews={reviews}
        photos={photos}
        editable
        onBookNow={() => { /* preview only — booking happens on the live page */ }}
        onSaved={(fields) => {
          const updated = { ...user, ...fields } as User;
          setUserState(updated);
          cacheUser(updated);
        }}
        onManageGallery={() => galleryRef.current?.scrollIntoView({ behavior: "smooth" })}
        onManageReviews={() => reviewsRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      {/* Photos & Reviews management (list-based — kept as dedicated editors) */}
      <div className="bg-gray-50 px-4 sm:px-6 py-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div ref={galleryRef} className="scroll-mt-4">
            <PhotoGalleryEditor
              layout={galleryLayout}
              showTitle={galleryShowTitle}
              title={galleryTitle}
              onLayoutChange={(v) => { setGalleryLayout(v); }}
              onShowTitleChange={(v) => { setGalleryShowTitle(v); }}
              onTitleChange={(v) => { setGalleryTitle(v); }}
            />
            {/* Refresh the preview when photos change. */}
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
              onLayoutChange={(v) => { setReviewsLayout(v); }}
              onShowStarsChange={(v) => { setReviewsShowStars(v); }}
              onShowAvatarsChange={(v) => { setReviewsShowAvatars(v); }}
              onShowDatesChange={(v) => { setReviewsShowDates(v); }}
            />
          </div>
        </div>
      </div>

      <DashboardHelp page="booking-page" />
    </div>
  );
}
