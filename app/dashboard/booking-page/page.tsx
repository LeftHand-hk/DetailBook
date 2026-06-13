"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, setUserLocal, syncFromServer } from "@/lib/storage";
import type { User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

// Booking-page DESIGN PICKER.
//
// Businesses choose between two public booking-page designs:
//   • Classic — the original card-based booking flow (default for
//     everyone, so no active client is ever switched without opting in).
//   • Modern  — the v2 editorial / website-style layout, edited inline
//     in the standalone WYSIWYG.
// Picking a card sets user.bookingPageLayout (PUT /api/user); the public
// /book/[slug] page renders whichever is selected. "Edit" opens the
// matching editor.

type Layout = "classic" | "modern";

export default function BookingPageDesignPicker() {
  const router = useRouter();
  const [user, setUserState] = useState<User | null>(null);
  const [layout, setLayout] = useState<Layout>("classic");
  const [saving, setSaving] = useState<Layout | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Once the user picks a design, the in-flight background sync below must
  // not stomp their choice. The sync's GET is issued on mount — BEFORE the
  // pick is saved — so when it resolves it carries the OLD layout. Writing
  // that back was the "I click the other design and it snaps back" bug
  // (most visible switching v2 → classic). After a pick, we trust local
  // state, which the targeted PUT has already persisted server-side.
  const userTouched = useRef(false);

  useEffect(() => {
    const u = getUser();
    if (u) { setUserState(u); if (!userTouched.current) setLayout(((u as any).bookingPageLayout as Layout) || "classic"); setLoaded(true); }
    syncFromServer().then(() => {
      const fresh = getUser();
      if (fresh) { setUserState(fresh); if (!userTouched.current) setLayout(((fresh as any).bookingPageLayout as Layout) || "classic"); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const choose = async (next: Layout) => {
    if (next === layout || saving) { return; }
    userTouched.current = true;
    setSaving(next);
    const prev = layout;
    setLayout(next); // optimistic
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingPageLayout: next }),
      });
      if (!res.ok) { setLayout(prev); userTouched.current = false; return; }
      // Persisted by the PUT above — just keep localStorage in step, without
      // firing another (whole-user) PUT. Read the freshest cached user so we
      // don't write a stale snapshot back over a concurrent sync.
      const base = getUser() || user;
      if (base) setUserLocal({ ...base, bookingPageLayout: next } as any);
    } catch {
      setLayout(prev); userTouched.current = false;
    } finally {
      setSaving(null);
    }
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
      {/* Mockup preview */}
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
              <button onClick={onChoose} disabled={saving} className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                {saving ? "Switching…" : "Use this design"}
              </button>
              <button onClick={onEdit} className="px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">Edit</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Lightweight CSS mockups — give a feel of each design without shipping
// a real screenshot image.
function ClassicPreview() {
  return (
    <div className="w-full max-w-[220px] bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 scale-100">
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
