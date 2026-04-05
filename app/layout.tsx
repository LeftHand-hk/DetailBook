import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DetailBook - Scheduling & Booking for Mobile Auto Detailers",
  description: "The #1 booking tool for mobile auto detailers. Stop no-shows, collect deposits, automate reminders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
