export const META_PIXEL_ID = "1295839309192322";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    // Set by components/MetaPixel.tsx the first time the inline base
    // script runs in a tab. Used to guard fbq('init') + initial PageView
    // against re-execution (Next.js Script remount, fast-refresh, etc.)
    // so Meta Pixel Helper sees exactly one PageView per page load.
    __detailbookPixelInitialized?: boolean;
  }
}

export const trackEvent = (eventName: string, parameters?: object) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, parameters);
  }
};
