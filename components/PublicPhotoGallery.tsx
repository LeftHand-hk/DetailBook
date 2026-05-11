"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PublicPhoto {
  id: string;
  photoType: "single" | "before_after";
  photoUrl: string;
  beforePhotoUrl: string | null;
  caption: string | null;
}

// Public-facing gallery rendered between the booking page hero and the
// service list. Three layouts (grid / carousel / masonry) + a lightbox
// that handles both single photos and a draggable Before/After slider
// for pairs. Renders nothing if photos is empty.

export default function PublicPhotoGallery({
  photos, layout, showTitle, title,
}: {
  photos: PublicPhoto[];
  layout: "grid" | "carousel" | "masonry";
  showTitle: boolean;
  title: string;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  const openLightbox = (i: number) => setLightboxIdx(i);
  const closeLightbox = () => setLightboxIdx(null);

  return (
    <section className="max-w-3xl mx-auto px-4 py-6">
      {showTitle && title && (
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-4 text-center">{title}</h2>
      )}

      {layout === "carousel" ? (
        <CarouselLayout photos={photos} onOpen={openLightbox} />
      ) : layout === "masonry" ? (
        <MasonryLayout photos={photos} onOpen={openLightbox} />
      ) : (
        <GridLayout photos={photos} onOpen={openLightbox} />
      )}

      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          startIdx={lightboxIdx}
          onClose={closeLightbox}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid — equal-square tiles, 2 cols mobile / 3 cols ≥ sm. Before/After
// pairs render as a split-view tile (Before | After) with a thin divider.

function GridLayout({ photos, onOpen }: { photos: PublicPhoto[]; onOpen: (i: number) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      {photos.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onOpen(i)}
          className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 hover:opacity-95 transition-opacity"
        >
          {p.photoType === "before_after" && p.beforePhotoUrl ? (
            <div className="grid grid-cols-2 h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photoUrl} alt="After" className="w-full h-full object-cover border-l-2 border-white" />
              <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">Before / After</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt={p.caption || "Photo"} className="w-full h-full object-cover" />
          )}
          {p.caption && (
            <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[11px] px-2 py-1.5 text-left">
              {p.caption}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel — one slide at a time, swipeable. Before/After slides show
// the interactive draggable slider (the "wow" feature for detailing).

function CarouselLayout({ photos, onOpen }: { photos: PublicPhoto[]; onOpen: (i: number) => void }) {
  const [idx, setIdx] = useState(0);
  const total = photos.length;
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  // Track touch for swipe gestures on mobile.
  const touchStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchStart.current = null;
  };

  const current = photos[idx];

  return (
    <div className="relative">
      <div
        className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-gray-100"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {current.photoType === "before_after" && current.beforePhotoUrl ? (
          <BeforeAfterSlider before={current.beforePhotoUrl} after={current.photoUrl} />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={current.photoUrl}
            alt={current.caption || "Photo"}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => onOpen(idx)}
          />
        )}

        {/* Prev / next */}
        {total > 1 && (
          <>
            <button onClick={prev} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={next} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}
      </div>

      {/* Caption + dots */}
      <div className="mt-3 text-center">
        {current.caption && (
          <p className="text-sm text-gray-600 mb-2">&ldquo;{current.caption}&rdquo;</p>
        )}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-blue-600" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Masonry — Pinterest-style. CSS columns handle natural heights for
// singles. Before/After pairs are forced to 2:1 (side-by-side) so the
// transformation reads at a glance.

function MasonryLayout({ photos, onOpen }: { photos: PublicPhoto[]; onOpen: (i: number) => void }) {
  return (
    <div className="columns-2 sm:columns-3 gap-2 sm:gap-3 [&>*]:mb-2 sm:[&>*]:mb-3">
      {photos.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onOpen(i)}
          className="block w-full overflow-hidden rounded-xl bg-gray-100 break-inside-avoid hover:opacity-95 transition-opacity relative"
        >
          {p.photoType === "before_after" && p.beforePhotoUrl ? (
            <div className="grid grid-cols-2 aspect-[2/1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photoUrl} alt="After" className="w-full h-full object-cover border-l-2 border-white" />
              <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">Before / After</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt={p.caption || "Photo"} className="w-full h-auto block" />
          )}
          {p.caption && (
            <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[11px] px-2 py-1.5 text-left">
              {p.caption}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Before/After slider — vertical divider the visitor drags
// left/right to reveal more of either side. Works with mouse + touch.

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  // Position is a percentage 0..100 of how much of "After" is visible
  // on the right. We start at 50/50 and the user can drag from there.
  const [pos, setPos] = useState(50);
  const [showLabels, setShowLabels] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Briefly show BEFORE/AFTER labels when the slider mounts so first-
  // time visitors understand what's happening, then fade them out.
  useEffect(() => {
    const t = setTimeout(() => setShowLabels(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setPos((x / rect.width) * 100);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (draggingRef.current) updateFromClientX(e.clientX); };
    const onUp = () => { draggingRef.current = false; };
    const onTouchMove = (e: TouchEvent) => {
      if (draggingRef.current) updateFromClientX(e.touches[0].clientX);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateFromClientX]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      onMouseDown={(e) => { draggingRef.current = true; updateFromClientX(e.clientX); }}
      onTouchStart={(e) => { draggingRef.current = true; updateFromClientX(e.touches[0].clientX); }}
    >
      {/* Base: AFTER fills the container */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover" />

      {/* Overlay: BEFORE clipped to the left portion of the container */}
      <div
        className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
        style={{ width: `${pos}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%" }} />
      </div>

      {/* Divider line + knob */}
      <div
        className="absolute inset-y-0 w-0.5 bg-white shadow pointer-events-none"
        style={{ left: `calc(${pos}% - 1px)` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
          </svg>
        </div>
      </div>

      {/* Corner labels — fade out after a beat */}
      <span className={`absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-opacity duration-700 ${showLabels ? "opacity-100" : "opacity-0"}`}>
        Before
      </span>
      <span className={`absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-opacity duration-700 ${showLabels ? "opacity-100" : "opacity-0"}`}>
        After
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox — fullscreen overlay with arrows + caption. Singles show as
// a centered photo; pairs reuse the BeforeAfterSlider so the visitor
// can still drag to compare.

function Lightbox({
  photos, startIdx, onClose,
}: {
  photos: PublicPhoto[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const total = photos.length;
  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  const current = photos[idx];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[70] bg-black/90 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0">
        <span className="text-xs font-semibold tabular-nums">{idx + 1} of {total}</span>
        <button onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div
        className="relative flex-1 flex items-center justify-center px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full max-w-4xl aspect-[16/10] bg-black rounded-xl overflow-hidden">
          {current.photoType === "before_after" && current.beforePhotoUrl ? (
            <BeforeAfterSlider before={current.beforePhotoUrl} after={current.photoUrl} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.photoUrl} alt={current.caption || "Photo"} className="absolute inset-0 w-full h-full object-contain" />
          )}
        </div>

        {/* Prev / Next on the sides */}
        {total > 1 && (
          <>
            <button onClick={prev} aria-label="Previous" className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={next} aria-label="Next" className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}
      </div>

      {current.caption && (
        <div className="px-4 pb-6 text-center text-white/90 text-sm" onClick={(e) => e.stopPropagation()}>
          {current.caption}
        </div>
      )}
    </div>
  );
}
