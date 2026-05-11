"use client";

import { useEffect, useRef, useState } from "react";

export interface PublicReview {
  id: string;
  customerName: string;
  rating: number;
  reviewText: string;
  reviewDate: string | null;
  serviceId: string | null;
}

// Public reviews block, rendered on /book/<slug> between the services
// list and the trust-badges strip. Returns null if there are no
// reviews so unfinished pages skip the section silently.

export default function PublicReviews({
  reviews,
  layout,
  showStars,
  showAvatars,
  showDates,
}: {
  reviews: PublicReview[];
  layout: "carousel" | "grid" | "list";
  showStars: boolean;
  showAvatars: boolean;
  showDates: boolean;
}) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-4 text-center">
        What Our Customers Say
      </h2>
      {layout === "carousel" ? (
        <CarouselReviews reviews={reviews} showStars={showStars} showAvatars={showAvatars} showDates={showDates} />
      ) : layout === "grid" ? (
        <GridReviews reviews={reviews} showStars={showStars} showAvatars={showAvatars} showDates={showDates} />
      ) : (
        <ListReviews reviews={reviews} showStars={showStars} showAvatars={showAvatars} showDates={showDates} />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-4 h-4 ${n <= rating ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// Deterministic avatar colour from the first character of the name —
// same input always picks the same tile, so two "Sarah" reviews look
// like the same person even though we don't track customer identity.
const AVATAR_PALETTE = [
  "bg-blue-500",   "bg-indigo-500", "bg-violet-500", "bg-purple-500",
  "bg-pink-500",   "bg-rose-500",   "bg-red-500",    "bg-orange-500",
  "bg-amber-500",  "bg-emerald-500","bg-teal-500",   "bg-cyan-500",
];
function avatarColour(name: string): string {
  const seed = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return AVATAR_PALETTE[seed % AVATAR_PALETTE.length];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const px = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  return (
    <span className={`flex-shrink-0 ${px} ${avatarColour(name)} rounded-full text-white font-bold flex items-center justify-center`}>
      {initial}
    </span>
  );
}

function ReviewAttribution({
  review, showAvatars, showDates,
}: { review: PublicReview; showAvatars: boolean; showDates: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {showAvatars && <Avatar name={review.customerName} size="sm" />}
      <span className="font-semibold text-gray-700">{review.customerName}</span>
      {showDates && review.reviewDate && (
        <>
          <span className="text-gray-300">·</span>
          <span>
            {new Date(review.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel — one review at a time, auto-rotates every 6s. Paused while
// the user hovers (desktop) or touches (mobile) so they can read.

function CarouselReviews({
  reviews, showStars, showAvatars, showDates,
}: { reviews: PublicReview[]; showStars: boolean; showAvatars: boolean; showDates: boolean }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = reviews.length;
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  useEffect(() => {
    if (paused || total <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 6000);
    return () => clearInterval(t);
  }, [paused, total]);

  const touchStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { setPaused(true); touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchStart.current = null;
    // Resume auto-rotation a moment after the swipe lands.
    setTimeout(() => setPaused(false), 800);
  };

  const current = reviews[idx];

  return (
    <div
      className="relative max-w-2xl mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-6 py-6 sm:py-8 text-center min-h-[180px] flex flex-col items-center justify-center">
        {showStars && <div className="mb-3"><Stars rating={current.rating} /></div>}
        <p className="text-base sm:text-lg text-gray-800 leading-relaxed italic mb-4 whitespace-pre-wrap break-words">
          &ldquo;{current.reviewText}&rdquo;
        </p>
        <ReviewAttribution review={current} showAvatars={showAvatars} showDates={showDates} />
      </div>

      {total > 1 && (
        <>
          <button onClick={prev} aria-label="Previous review" className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-full shadow-sm items-center justify-center text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={next} aria-label="Next review" className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-full shadow-sm items-center justify-center text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Review ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-blue-600" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid — 2 cols on sm+, 1 col on mobile. All reviews visible.

function GridReviews({
  reviews, showStars, showAvatars, showDates,
}: { reviews: PublicReview[]; showStars: boolean; showAvatars: boolean; showDates: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-col">
          {showStars && <div className="mb-2"><Stars rating={r.rating} /></div>}
          <p className="text-sm text-gray-700 leading-relaxed mb-3 flex-1 whitespace-pre-wrap break-words">
            &ldquo;{r.reviewText}&rdquo;
          </p>
          <ReviewAttribution review={r} showAvatars={showAvatars} showDates={showDates} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List — vertical stack of full-width cards.

function ListReviews({
  reviews, showStars, showAvatars, showDates,
}: { reviews: PublicReview[]; showStars: boolean; showAvatars: boolean; showDates: boolean }) {
  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          {showStars && <div className="mb-2"><Stars rating={r.rating} /></div>}
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap break-words">
            &ldquo;{r.reviewText}&rdquo;
          </p>
          <ReviewAttribution review={r} showAvatars={showAvatars} showDates={showDates} />
        </div>
      ))}
    </div>
  );
}
