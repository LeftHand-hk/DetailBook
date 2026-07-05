export const GOOGLE_ADS_ID = "AW-18300678638";
export const TRIAL_STARTED_CONVERSION_SEND_TO = `${GOOGLE_ADS_ID}/h7VECN2P_socEO7juJZE`;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackTrialStartedConversion(): boolean {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return false;
  }

  window.gtag("event", "conversion", {
    send_to: TRIAL_STARTED_CONVERSION_SEND_TO,
  });
  return true;
}
