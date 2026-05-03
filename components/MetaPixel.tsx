"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

// Renders the Meta Pixel base script and tracks PageView exactly once per
// pathname. Two-source-of-truth bugs caused duplicates before:
// - Inline `fbq('track','PageView')` AND a React effect both firing on
//   initial load.
// - A per-instance ref ("isFirstRender") resetting on StrictMode remount,
//   defeating the skip.
//
// Now: PageView lives only in the effect, deduped against the last tracked
// pathname stored on `window`. The flag survives any React remount, so we
// fire exactly one PageView per real route change.
export default function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.fbq !== "function") return;
    if (pathname?.startsWith("/admin")) return;
    if (window.__detailbookPixelLastPath === pathname) return;

    window.__detailbookPixelLastPath = pathname ?? null;
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
