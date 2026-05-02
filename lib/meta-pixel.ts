export const META_PIXEL_ID = "1295839309192322";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

export const trackEvent = (eventName: string, parameters?: object) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, parameters);
  }
};
