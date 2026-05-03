"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

// Renders the Meta Pixel base code and tracks PageView once per route.
//
// Why this looks the way it does:
// - Always rendered (no conditional return). Conditionally returning null
//   based on usePathname caused the <Script> to remount on hydration and
//   on /admin → public navigation, which re-ran the inline init+track body
//   and produced the "2 PageView" duplicate seen in Meta Pixel Helper.
// - The inline script guards init + PageView behind a window flag so that
//   even if Next.js re-executes the inline body for any reason (StrictMode,
//   hydration mismatch, fast-refresh) we only ever fire ONE initial PageView.
// - The IIFE itself has `if(f.fbq)return` so fbevents.js is also only loaded
//   once per tab.
// - Route-change PageViews use a useEffect that skips the first render —
//   the initial one is already covered by the inline script — so SPA
//   navigations get exactly one PageView per new route, never two.
// - Admin pages skip both the initial track (URL check inside the inline
//   script) and route-change tracks (pathname check in the effect). The
//   pixel is still loaded in admin tabs but no events fire there.
export default function MetaPixel() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // The first render's PageView is owned by the inline base script.
    // Skipping here is what prevents the duplicate Meta Pixel Helper saw.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (pathname?.startsWith("/admin")) return;
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    window.fbq("track", "PageView");
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        if (!window.__detailbookPixelInitialized) {
          window.__detailbookPixelInitialized = true;
          fbq('init', '${META_PIXEL_ID}');
          if (!window.location.pathname.startsWith('/admin')) {
            fbq('track', 'PageView');
          }
        }`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
