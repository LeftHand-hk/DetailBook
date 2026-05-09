import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";

// Self-host Inter at build time so the font ships from our own origin
// (Netlify CDN) instead of Google's CSS endpoint. The previous setup used
// `@import url(fonts.googleapis.com/...)` inside globals.css which is
// render-blocking — on mobile, it left every text section invisible until
// the external request resolved, so users saw white empty sections for
// several seconds. next/font also auto-applies font-display: swap and
// preloads the WOFF2 file alongside the page HTML.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const SITE_URL = "https://detailbookapp.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "DetailBook — Booking & Scheduling Built for Auto Detailers",
  description:
    "Booking tool built for auto detailers. Stop no-shows with required deposits, send SMS reminders, and run shop or mobile jobs from one calendar.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "DetailBook",
    title: "DetailBook — Booking & Scheduling Built for Auto Detailers",
    description:
      "Stop no-shows. Collect deposits, automate SMS reminders, and manage shop + mobile jobs from one calendar.",
  },
  twitter: {
    card: "summary",
    title: "DetailBook — Booking & Scheduling Built for Auto Detailers",
    description:
      "Stop no-shows. Collect deposits, automate SMS reminders, and manage shop + mobile jobs from one calendar.",
  },
  verification: {
    other: {
      "facebook-domain-verification": "z24dohio7eelb6vlmqxobr9ubliiny",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-gray-900 antialiased font-sans">
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
