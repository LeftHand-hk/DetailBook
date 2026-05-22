"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The booking-page editor moved to the standalone full-page route
// /booking-page-editor (outside the dashboard chrome, for a faster and
// lighter WYSIWYG). This page just forwards there so old links and the
// browser back-stack keep working.
export default function BookingPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/booking-page-editor");
  }, [router]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
