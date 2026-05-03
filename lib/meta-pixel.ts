export const META_PIXEL_ID = "1295839309192322";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    // Guards fbq('init') against re-execution if the inline Meta Pixel
    // script body runs more than once in a tab (Next.js Script remount,
    // fast-refresh, hydration mismatch, StrictMode).
    __detailbookPixelInitialized?: boolean;
    // Last pathname for which we fired fbq('track','PageView'). Used by
    // components/MetaPixel.tsx to dedupe PageView per route change so
    // Meta Pixel Helper never sees a duplicate.
    __detailbookPixelLastPath?: string | null;
  }
}

export const trackEvent = (eventName: string, parameters?: object) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, parameters);
  }
};
