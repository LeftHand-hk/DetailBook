"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Visual framing the owner picks for a banner / cover photo. These map 1:1
// to the CSS the live page uses, so what they see in the modal is exactly
// what renders: object-fit + object-position (pan) + transform scale (zoom).
export interface FrameValue {
  zoom: number; // 1 = fills the frame (cover baseline), up to 4 = zoomed in
  posX: number; // object-position X, 0–100
  posY: number; // object-position Y, 0–100
  fit: "cover" | "contain"; // contain = show the WHOLE photo (letterboxed)
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export default function ImageFrameModal({
  src,
  aspect,
  title,
  initial,
  onCancel,
  onApply,
}: {
  src: string;
  /** width / height of the on-page frame, so the rectangle matches the site. */
  aspect: number;
  title: string;
  initial: FrameValue;
  onCancel: () => void;
  onApply: (v: FrameValue) => void;
}) {
  const [zoom, setZoom] = useState(initial.zoom);
  const [posX, setPosX] = useState(initial.posX);
  const [posY, setPosY] = useState(initial.posY);
  const [fit, setFit] = useState<"cover" | "contain">(initial.fit);

  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const cover = fit === "cover";

  // ── Drag to pan (mouse + single-finger touch via pointer events) ────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (!cover) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !cover || pinch.current) return;
    const fr = frameRef.current;
    if (!fr) return;
    const rect = fr.getBoundingClientRect();
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    // Dragging right reveals more of the left edge → object-position X drops.
    // Divide by zoom so the photo tracks the finger at any zoom level.
    setPosX((p) => clamp(p - (dx / rect.width) * 100 / zoom, 0, 100));
    setPosY((p) => clamp(p - (dy / rect.height) * 100 / zoom, 0, 100));
  };
  const endPan = () => { drag.current = null; };

  // ── Scroll wheel to zoom ────────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    if (!cover) return;
    setZoom((z) => clamp(z * (1 - e.deltaY * 0.0015), 1, 4));
  };

  // ── Two-finger pinch to zoom ────────────────────────────────────────────
  const touchDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && cover) pinch.current = { dist: touchDist(e.touches), zoom };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current && cover) {
      setZoom(clamp(pinch.current.zoom * (touchDist(e.touches) / pinch.current.dist), 1, 4));
    }
  };
  const onTouchEnd = () => { pinch.current = null; };

  // Esc closes; lock body scroll while open.
  const cancel = useCallback(() => onCancel(), [onCancel]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [cancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={cancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-bold text-stone-900">{title}</h3>
          <button onClick={cancel} aria-label="Close" className="text-stone-400 hover:text-stone-700 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-500">
            {cover
              ? "Drag to move the photo • pinch or scroll to zoom. The blue rectangle is exactly what shows on your page."
              : "The whole photo is shown, with no cropping."}
          </p>

          {/* The frame matches the on-page aspect ratio, so this is WYSIWYG. */}
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className={`relative w-full overflow-hidden rounded-xl bg-stone-900 ring-4 ring-blue-500/70 select-none ${cover ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{ aspectRatio: String(aspect), touchAction: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                objectFit: fit,
                objectPosition: `${posX}% ${posY}%`,
                transform: cover ? `scale(${zoom})` : undefined,
                transformOrigin: "center",
              }}
            />
          </div>

          {cover && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Zoom</span>
              <input
                type="range"
                min={100}
                max={400}
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(clamp(parseInt(e.target.value, 10) / 100, 1, 4))}
                className="flex-1 accent-blue-600 cursor-pointer"
              />
              <button onClick={() => { setZoom(1); setPosX(50); setPosY(50); }} className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap">Reset</button>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!cover}
              onChange={(e) => setFit(e.target.checked ? "contain" : "cover")}
              className="accent-blue-600 w-4 h-4"
            />
            Show the whole photo (no cropping)
          </label>
        </div>

        <div className="px-5 py-3 border-t border-stone-100 flex gap-3 justify-end">
          <button onClick={cancel} className="px-4 py-2 rounded-lg border border-stone-200 font-semibold text-stone-700 hover:bg-stone-50">Cancel</button>
          <button
            onClick={() => onApply({ zoom: cover ? zoom : 1, posX, posY, fit })}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
