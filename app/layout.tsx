import type { Metadata } from "next";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";

export const metadata: Metadata = {
  title: "DetailBook - Scheduling & Booking for Mobile Auto Detailers",
  description: "The #1 booking tool for mobile auto detailers. Stop no-shows, collect deposits, automate reminders.",
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
