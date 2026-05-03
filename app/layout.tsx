import type { Metadata } from "next";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";

const SITE_URL = "https://detailbook.app";

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
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
