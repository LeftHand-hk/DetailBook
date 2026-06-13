"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, setUserLocal } from "@/lib/storage";
import { saveBookingPageSettings, type BookingPageLayout } from "@/lib/booking-page-settings";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

// ──────────────────────────────────────────────────────────────────────────
// Booking-page DESIGN PICKER.
//
// Two public designs: "classic" (the original card flow) and "modern" (the v2
// editorial WYSIWYG). Picking one writes user.bookingPageLayout; the public
// /book/[slug] renders whichever is selected. "Edit" opens the matching editor.
//
// Plumbing: the design (and everything the editors save) now flows through the
// single PATCH /api/booking-page writer via saveBookingPageSettings — no more
// split between /api/user/layout and the whole-user sync that used to race and
// silently revert the pick. We read the current design from the local cache on
// mount (the dashboard layout already syncs the user) so the page fires no
// request of its own, and the switch retries transient 504/5xx internally.
// ──────────────────────────────────────────────────────────────────────────

type Layout = BookingPageLayout;

export default function BookingPageDesignPicker() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [layout, setLayout] = useState<Layout>("classic");
  const [saving, setSaving] = useState<Layout | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Read straight from the local cache — no network call from this page.
  useEffect(() => {
    const u = getUser();
    if (u) {
      setUser(u);
      setLayout(((u as any).bookingPageLayout as Layout) || "classic");
    }
    setLoaded(true);
  }, []);

  const choose = async (next: Layout) => {
    if (next === layout || saving) return;
    const prev = layout;
    setSaving(next);
    setSaveError("");
    setLayout(next); // optimistic

    const result = await saveBookingPageSettings({ bookingPageLayout: next });

    if (!result.ok) {
      setLayout(prev);
      setSaveError(result.error || "Couldn't switch design. Please try again.");
      setSaving(null);
      return;
    }

    // Keep the local cache in step so the editors + public page see the new
    // design immediately, without firing a whole-user PUT.
    const base = getUser() || user;
    if (base) {
      const updated = { ...base, bookingPageLayout: next } as User;
      setUser(updated);
      setUserLocal(updated);
    }
    setSaving(null);
  };

  const slug = (user as any)?.slug || "";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Booking Page Design</h1>
        <p className="text-sm text-gray-500 mt-1">
          Choose how your public booking page looks. Switch anytime — it won&apos;t affect your services, bookings, or settings.
        </p>
      </div>

      {saveError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {saveError}
        </div>
      )}

      {!loaded ? (
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="h-80 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-80 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          <DesignCard
            name="Classic"
            tagline="The original card-based booking flow."
            features={["Clean step-by-step booking", "Service cards + calendar", "Familiar and proven"]}
            selected={layout === "classic"}
            saving={saving === "classic"}
            onChoose={() => choose("classic")}
            onEdit={() => router.push("/dashboard/booking-page-classic")}
            preview={<ClassicPreview />}
          />
          <DesignCard
            name="Modern"
            tagline="A full website-style page — edited inline."
            features={["Big hero + brand color", "About, gallery, reviews sections", "WYSIWYG inline editor"]}
            selected={layout === "modern"}
            saving={saving === "modern"}
            onChoose={() => choose("modern")}
            onEdit={() => router.push("/booking-page-editor")}
            preview={<ModernPreview />}
            badge="New"
          />
        </div>
      )}

      {slug && (
        <div className="mt-6 flex items-center gap-3 text-sm">
          <span className="text-gray-500">Your live page:</span>
          <a href={`/book/${slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5">
            /book/{slug}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </div>
      )}

      <DashboardHelp page="booking-page" />
    </div>
  );
}

function DesignCard({
  name, tagline, features, selected, saving, onChoose, onEdit, preview, badge,
}: {
  name: string; tagline: string; features: string[];
  selected: boolean; saving: boolean;
  onChoose: () => void; onEdit: () => void;
  preview: React.ReactNode; badge?: string;
}) {
  return (
    <div className={`relative rounded-2xl border-2 overflow-hidden transition-all bg-white ${selected ? "border-blue-500 ring-2 ring-blue-100 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
      {badge && (
        <span className="absolute top-3 right-3 z-10 text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-1 rounded-full">{badge}</span>
      )}
      {selected && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Current
        </span>
      )}
      <div className="h-44 bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-100 overflow-hidden flex items-center justify-center p-4">
        {preview}
      </div>
      <div className="p-5">
        <h2 className="text-lg font-extrabold text-gray-900">{name}</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-3">{tagline}</p>
        <ul className="space-y-1.5 mb-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              {f}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          {selected ? (
            <button onClick={onEdit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">Edit this page →</button>
          ) : (
            <>
              <button onClick={onChoose} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                {saving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Switching…" : "Use this design"}
              </button>
              <button onClick={onEdit} disabled={saving} className="px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">Edit</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Lightweight CSS mockups — give a feel of each design without shipping a
// real screenshot.
function ClassicPreview() {
  return (
    <div className="w-full max-w-[220px] bg-white rounded-lg shadow-sm border border-gray-200 p-2.5">
      <div className="h-2 w-16 bg-gray-300 rounded mb-2" />
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border border-gray-200 rounded p-1.5">
            <div className="h-1.5 w-10 bg-gray-300 rounded mb-1" />
            <div className="h-3 w-8 bg-blue-500 rounded" />
          </div>
        ))}
      </div>
      <div className="h-5 w-full bg-blue-600 rounded" />
    </div>
  );
}

function ModernPreview() {
  return (
    <div className="w-full max-w-[220px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="h-16 bg-gradient-to-br from-stone-800 to-stone-600 relative flex items-end p-2">
        <div className="h-2.5 w-20 bg-white/90 rounded" />
      </div>
      <div className="p-2.5">
        <div className="h-1.5 w-10 bg-blue-500 rounded mb-1.5" />
        <div className="h-2 w-24 bg-gray-800 rounded mb-1" />
        <div className="h-1.5 w-full bg-gray-200 rounded mb-0.5" />
        <div className="h-1.5 w-2/3 bg-gray-200 rounded mb-2" />
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => <div key={i} className="h-6 bg-stone-100 rounded" />)}
        </div>
      </div>
    </div>
  );
}
