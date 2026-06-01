"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPackages, setPackages, setPackagesLocal, getUser, generateId } from "@/lib/storage";
import type { Package, PackageAddon, User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";
import SetupHint from "@/components/SetupHint";
import EmptyState, { EmptyIcons } from "@/components/EmptyState";
import { VEHICLE_TYPES, type VehicleTypeId } from "@/lib/vehicle-pricing";

const QUICK_TEMPLATES = [
  { name: "Basic Wash", description: "Exterior wash, tire shine, and quick interior wipe-down.", price: "45", duration: "30", deposit: "" },
  { name: "Full Detail", description: "Complete interior and exterior detail with premium products.", price: "150", duration: "120", deposit: "" },
  { name: "Ceramic Coating", description: "Long-lasting ceramic protection with paint prep and decontamination.", price: "400", duration: "240", deposit: "" },
  { name: "Paint Correction", description: "Multi-stage polish to remove swirls, scratches, and oxidation.", price: "300", duration: "180", deposit: "" },
];

const STARTER_LIMIT = 5;

// First-time setup rows shown when /dashboard/packages?setup=services
// lands an owner with 0 packages. They're pre-filled, fully editable, and
// the user can delete or add more. The dashboard is gated behind having at
// least one package, so this screen is the activation funnel — a blank
// form here was the biggest drop-off in onboarding.
type SetupRow = { id: string; name: string; price: string; duration: string; description: string };
const DEFAULT_SETUP_ROWS: SetupRow[] = [
  { id: "s1", name: "Exterior Wash & Wax",                description: "Hand wash, tire shine, and a protective spray wax — exterior detail.",      price: "49",  duration: "60" },
  { id: "s2", name: "Interior Detail",                    description: "Deep vacuum, leather and plastic cleaning, glass, and odor removal.",       price: "89",  duration: "90" },
  { id: "s3", name: "Full Detail (Interior + Exterior)",  description: "Complete interior + exterior detail with premium products and finish.",     price: "149", duration: "180" },
];

function newSetupRow(): SetupRow {
  return { id: `s_${Math.random().toString(36).slice(2, 10)}`, name: "", description: "", price: "", duration: "" };
}

// Addon rows in the form keep price as a string so we can render empty
// inputs naturally. It's parsed to a number right before submit.
interface AddonDraft {
  id: string;
  name: string;
  price: string;
}

// Vehicle pricing rows mirror the addon pattern: surcharge stays as a
// string in form state so the input can be naturally empty, and is
// parsed right before submit.
interface VehicleSurchargeDraft {
  type: VehicleTypeId;
  surcharge: string;
}

interface PackageFormData {
  name: string;
  description: string;
  price: string;
  duration: string;
  deposit: string;
  addons: AddonDraft[];
  // When `vehiclePricingEnabled` is false, the package is flat-priced
  // and available to all vehicle types — vehiclePricing is ignored on
  // save. When true, only listed vehicle types can book the package.
  vehiclePricingEnabled: boolean;
  vehiclePricing: VehicleSurchargeDraft[];
}

const EMPTY_FORM: PackageFormData = {
  name: "",
  description: "",
  price: "",
  duration: "",
  deposit: "",
  addons: [],
  vehiclePricingEnabled: false,
  vehiclePricing: [],
};

function newAddonDraft(): AddonDraft {
  return { id: `a_${Math.random().toString(36).slice(2, 10)}`, name: "", price: "" };
}

// Default "Different prices per vehicle" list: every vehicle type
// included, all surcharges blank. Owner can edit surcharges or remove
// rows that don't apply to this package.
function defaultVehiclePricingRows(): VehicleSurchargeDraft[] {
  return VEHICLE_TYPES.map((v) => ({ type: v.id, surcharge: "" }));
}

export default function PackagesPage() {
  const router = useRouter();
  const [packages, setPackagesState] = useState<Package[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  // First-time setup ("?setup=services") state: a separate, simpler form
  // shown only when the user has 0 packages and arrived via the
  // onboarding CTA. Rendered before the normal page returns.
  const [setupMode, setSetupMode] = useState(false);
  const [setupRows, setSetupRows] = useState<SetupRow[]>(DEFAULT_SETUP_ROWS);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState<PackageFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // The optional sections (add-ons + per-vehicle pricing) start collapsed
  // so the default modal stays a short 5-field form. When editing an
  // existing package that already uses one of them, we auto-expand the
  // matching section so the owner sees their existing data.
  const [showAddons, setShowAddons] = useState(false);
  const [showVehiclePricing, setShowVehiclePricing] = useState(false);
  // Guard against double submission. `saving` state alone isn't enough because
  // React batches state updates — a fast double-click can fire handleSave twice
  // before the disabled prop kicks in, creating duplicate packages on the server.
  const submittingRef = useRef(false);

  useEffect(() => {
    setUser(getUser());

    // Read query params up front so we can react to setup=services after
    // packages load. The newPackage=1 modal-auto-open is still one-shot
    // (we strip the param so a refresh doesn't reopen it).
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const wantsSetup = params?.get("setup") === "services";

    // Load packages from API (source of truth), fallback to localStorage.
    fetch("/api/packages")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Package[]) => {
        setPackagesState(data);
        // First-time setup view: arrived from the onboarding CTA AND has
        // no packages yet. If they already have packages, fall through to
        // the normal page.
        if (wantsSetup && data.length === 0) setSetupMode(true);
      })
      .catch(() => setPackagesState(getPackages()));

    if (params?.get("newPackage") === "1") {
      setEditing(null);
      setForm(EMPTY_FORM);
      setShowModal(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("newPackage");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, []);

  // ── First-time setup helpers ─────────────────────────────────────────
  const updateSetupRow = (idx: number, field: keyof SetupRow, value: string) => {
    setSetupRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const removeSetupRow = (idx: number) => {
    setSetupRows((rows) => rows.filter((_, i) => i !== idx));
  };
  const addSetupRow = () => {
    setSetupRows((rows) => [...rows, newSetupRow()]);
  };
  const handleSetupSave = async () => {
    setSetupError("");
    const valid = setupRows
      .map((r) => ({
        name: r.name.trim(),
        description: r.description.trim(),
        price: parseFloat(r.price),
        duration: parseInt(r.duration, 10),
      }))
      .filter((r) => r.name && Number.isFinite(r.price) && r.price >= 0 && Number.isFinite(r.duration) && r.duration > 0);
    if (valid.length === 0) {
      setSetupError("Add at least one service with a name, price, and duration.");
      return;
    }
    setSetupSaving(true);
    try {
      for (const r of valid) {
        const res = await fetch("/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: r.name,
            description: r.description || r.name,
            price: r.price,
            duration: r.duration,
            active: true,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Couldn't save "${r.name}"`);
        }
      }
      router.push("/dashboard");
    } catch (err: any) {
      setSetupError(err?.message || "Something went wrong. Please try again.");
      setSetupSaving(false);
    }
  };

  const isStarter = user?.plan === "starter";
  const atLimit = isStarter && packages.length >= STARTER_LIMIT;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowAddons(false);
    setShowVehiclePricing(false);
    setShowModal(true);
  };

  const openWithTemplate = (t: typeof QUICK_TEMPLATES[number]) => {
    setEditing(null);
    setForm({ ...t, addons: [], vehiclePricingEnabled: false, vehiclePricing: [] });
    setShowAddons(false);
    setShowVehiclePricing(false);
    setShowModal(true);
  };

  // Opens the package editor straight on the add-ons section with at
  // least one blank row, so an owner clicking the "Add-ons" button on a
  // package card can start typing immediately instead of hunting for
  // the section.
  const openAddons = (pkg: Package) => {
    const existingPricing = ((pkg as any).vehiclePricing as Array<{ type: VehicleTypeId; surcharge: number }> | null | undefined) || [];
    const hasPricing = existingPricing.length > 0;
    const existingAddons = (pkg.addons || []).map((a) => ({ id: a.id, name: a.name, price: String(a.price) }));
    setEditing(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description,
      price: String(pkg.price),
      duration: String(pkg.duration),
      deposit: pkg.deposit ? String(pkg.deposit) : "",
      addons: existingAddons.length > 0 ? existingAddons : [newAddonDraft()],
      vehiclePricingEnabled: hasPricing,
      vehiclePricing: hasPricing
        ? existingPricing.map((p) => ({ type: p.type, surcharge: p.surcharge ? String(p.surcharge) : "" }))
        : [],
    });
    setShowAddons(true);
    setShowVehiclePricing(hasPricing);
    setShowModal(true);
  };

  const openEdit = (pkg: Package) => {
    const existingPricing = ((pkg as any).vehiclePricing as Array<{ type: VehicleTypeId; surcharge: number }> | null | undefined) || [];
    const hasPricing = existingPricing.length > 0;
    const hasAddons = (pkg.addons || []).length > 0;
    setEditing(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description,
      price: String(pkg.price),
      duration: String(pkg.duration),
      deposit: pkg.deposit ? String(pkg.deposit) : "",
      addons: (pkg.addons || []).map((a) => ({
        id: a.id,
        name: a.name,
        price: String(a.price),
      })),
      vehiclePricingEnabled: hasPricing,
      vehiclePricing: hasPricing
        ? existingPricing.map((p) => ({ type: p.type, surcharge: p.surcharge ? String(p.surcharge) : "" }))
        : [],
    });
    setShowAddons(hasAddons);
    setShowVehiclePricing(hasPricing);
    setShowModal(true);
  };

  const toggleVehiclePricing = () => {
    setForm((f) => ({
      ...f,
      vehiclePricingEnabled: !f.vehiclePricingEnabled,
      vehiclePricing: !f.vehiclePricingEnabled && f.vehiclePricing.length === 0
        ? defaultVehiclePricingRows()
        : f.vehiclePricing,
    }));
  };
  const updateVehicleSurcharge = (type: VehicleTypeId, surcharge: string) => {
    setForm((f) => ({
      ...f,
      vehiclePricing: f.vehiclePricing.map((row) =>
        row.type === type ? { ...row, surcharge } : row,
      ),
    }));
  };
  const removeVehicleType = (type: VehicleTypeId) => {
    setForm((f) => ({
      ...f,
      vehiclePricing: f.vehiclePricing.filter((row) => row.type !== type),
    }));
  };
  const addVehicleType = (type: VehicleTypeId) => {
    setForm((f) =>
      f.vehiclePricing.some((row) => row.type === type)
        ? f
        : { ...f, vehiclePricing: [...f.vehiclePricing, { type, surcharge: "" }] },
    );
  };

  const updateAddon = (id: string, patch: Partial<AddonDraft>) => {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };
  const removeAddon = (id: string) => {
    setForm((f) => ({ ...f, addons: f.addons.filter((a) => a.id !== id) }));
  };
  const addAddonRow = () => {
    setForm((f) => ({ ...f, addons: [...f.addons, newAddonDraft()] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);

    const depositVal = form.deposit ? parseFloat(form.deposit) : undefined;
    // Drop blank addon rows (name empty or invalid price) so a half-typed
    // entry can't end up persisted with a $0 / NaN price.
    const cleanAddons: PackageAddon[] = form.addons
      .map((a): PackageAddon | null => {
        const name = a.name.trim();
        const price = parseFloat(a.price);
        if (!name || !Number.isFinite(price) || price < 0) return null;
        return { id: a.id, name, price };
      })
      .filter((a): a is PackageAddon => a !== null);
    // Vehicle pricing: only serialise when the owner explicitly enabled
    // it. Empty surcharge inputs are treated as $0 (= included at base
    // price). Rows the owner removed don't get serialised, so the
    // package will be unbookable for those vehicle types.
    const cleanVehiclePricing = form.vehiclePricingEnabled
      ? form.vehiclePricing.map((row) => ({
          type: row.type,
          surcharge: Math.max(0, parseFloat(row.surcharge) || 0),
        }))
      : [];

    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      duration: parseInt(form.duration),
      deposit: depositVal ?? 0,
      addons: cleanAddons,
      vehiclePricing: cleanVehiclePricing,
    };

    try {
      if (editing) {
        // Update existing package via API
        const res = await fetch(`/api/packages/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          const newList = packages.map((p) => (p.id === editing.id ? updated : p));
          setPackagesState(newList);
          // Cache-only write — we already PUT the change; setPackages
          // would diff and re-PUT the same row, harmless but wasteful.
          setPackagesLocal(newList);
        }
      } else {
        // Create new package via API
        const res = await fetch("/api/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, active: true }),
        });
        if (res.ok) {
          const created = await res.json();
          const newList = [...packages, created];
          setPackagesState(newList);
          // Cache-only — using the full setPackages here caused the
          // "duplicate package" bug: its diff saw the just-created
          // row as new (not yet in prev) and POSTed it a second time.
          setPackagesLocal(newList);
        }
      }
    } catch {
      // Fallback to localStorage
      const updated: Package[] = editing
        ? packages.map((p) =>
            p.id === editing.id ? { ...p, ...payload, deposit: depositVal, addons: cleanAddons } : p
          )
        : [...packages, { id: generateId(), ...payload, active: true, deposit: depositVal, addons: cleanAddons }];
      setPackages(updated);
      setPackagesState(updated);
    }

    setSaving(false);
    submittingRef.current = false;
    setShowModal(false);

    // Tell the SetupExperience banner to refetch its status so the
    // "Add your first service package" step flips to ✅ immediately,
    // instead of waiting for the next window focus or route change.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("detailbook:setup-changed"));
    }
  };

  const handleToggle = async (id: string) => {
    const pkg = packages.find((p) => p.id === id);
    if (!pkg) return;
    const updated = packages.map((p) => (p.id === id ? { ...p, active: !p.active } : p));
    setPackagesState(updated);
    setPackagesLocal(updated);
    try {
      await fetch(`/api/packages/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pkg.active }),
      });
    } catch { /* optimistic update already applied */ }
  };

  const handleDelete = async (id: string) => {
    const updated = packages.filter((p) => p.id !== id);
    setPackagesState(updated);
    setPackagesLocal(updated);
    setDeleteConfirm(null);
    try {
      await fetch(`/api/packages/${id}`, { method: "DELETE" });
    } catch { /* optimistic update already applied */ }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // First-time setup view — replaces the whole page so the owner doesn't
  // see the regular list/modal until they've created their first packages.
  if (setupMode) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Your first services</h1>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            We pre-filled three common detailing packages — edit the prices and details to match what you charge, delete anything you don&apos;t offer, and add your own. You can always change these later from your dashboard.
          </p>
        </div>

        <div className="space-y-4">
          {setupRows.map((r, i) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <label className="sm:col-span-12 block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Service name</span>
                    <input type="text" value={r.name} onChange={(e) => updateSetupRow(i, "name", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Exterior Wash" />
                  </label>
                  <label className="sm:col-span-6 block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Price ($)</span>
                    <input type="number" min="0" step="1" value={r.price} onChange={(e) => updateSetupRow(i, "price", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </label>
                  <label className="sm:col-span-6 block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Duration (min)</span>
                    <input type="number" min="0" step="5" value={r.duration} onChange={(e) => updateSetupRow(i, "duration", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </label>
                  <label className="sm:col-span-12 block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Description</span>
                    <textarea value={r.description} onChange={(e) => updateSetupRow(i, "description", e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </label>
                </div>
                <button type="button" onClick={() => removeSetupRow(i)} title="Remove this service" aria-label="Remove this service" className="flex-shrink-0 w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addSetupRow} className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-500 font-semibold py-3 rounded-xl text-sm transition-colors">
            + Add another service
          </button>
        </div>

        {setupError && (
          <p className="text-sm text-red-600 mt-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{setupError}</p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
            Saving makes your booking link live immediately — customers can book the services you list here.
          </p>
          <button
            type="button"
            onClick={handleSetupSave}
            disabled={setupSaving || setupRows.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-blue-200 inline-flex items-center justify-center gap-2"
          >
            {setupSaving ? "Saving…" : (
              <>
                Save &amp; Continue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <SetupHint step="services" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Service Packages</h1>
          <p className="text-gray-500">
            {packages.length} package{packages.length !== 1 ? "s" : ""}
            {isStarter && ` · ${STARTER_LIMIT - packages.length} remaining on Starter plan`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit ? (
            <div className="flex items-center gap-2">
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-3 py-2 rounded-xl font-medium">
                5/5 limit reached
              </div>
              <Link
                href="/dashboard/billing"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Upgrade to Pro
              </Link>
            </div>
          ) : (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Package
            </button>
          )}
        </div>
      </div>

      {/* Upgrade prompt if starter at limit */}
      {atLimit && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 mb-6 text-white flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-bold mb-1">You&apos;ve reached the Starter plan limit (5 packages)</p>
            <p className="text-blue-100 text-sm">Upgrade to Pro for unlimited service packages, SMS reminders, and more.</p>
          </div>
          <Link
            href="/dashboard/billing"
            className="flex-shrink-0 bg-white text-blue-700 hover:bg-blue-50 font-bold px-5 py-2.5 rounded-xl text-sm whitespace-nowrap transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {/* Package Grid */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <EmptyState
            icon={EmptyIcons.Package}
            title="Add your first service"
            description="Create the services you offer so customers can book them. Most detailers add 3–5 packages to start."
            action={
              <button
                onClick={openAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Add Service
              </button>
            }
          >
            <div className="max-w-2xl mx-auto">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-left">
                Quick start templates
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => openWithTemplate(t)}
                    className="text-left bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-lg p-3 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ${t.price} · {parseInt(t.duration, 10) >= 60 ? `${parseInt(t.duration, 10) / 60} hour${parseInt(t.duration, 10) >= 120 ? "s" : ""}` : `${t.duration} min`}
                      </p>
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </EmptyState>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all ${
                pkg.active ? "border-gray-100" : "border-gray-100 opacity-60"
              }`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-gray-50">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{pkg.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-blue-600">${pkg.price}</span>
                      <span className="text-sm text-gray-500">· {formatDuration(pkg.duration)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {pkg.deposit && pkg.deposit > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>
                          ${pkg.deposit} deposit
                        </span>
                      )}
                      {pkg.addons && pkg.addons.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                          {pkg.addons.length} add-on{pkg.addons.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {Array.isArray((pkg as any).vehiclePricing) && (pkg as any).vehiclePricing.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title="This package has per-vehicle-type pricing">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 13l2-2m0 0l7-7 7 7M5 11v8a2 2 0 002 2h2m6 0h2a2 2 0 002-2v-8m-9 0h4" /></svg>
                          {(pkg as any).vehiclePricing.length} vehicle type{(pkg as any).vehiclePricing.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(pkg.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        pkg.active ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          pkg.active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
                {!pkg.active && (
                  <span className="inline-block text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                )}
              </div>

              {/* Description */}
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 leading-relaxed">{pkg.description}</p>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => openEdit(pkg)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => openAddons(pkg)}
                  title="Add-ons for this package"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-purple-100 text-purple-700 text-sm font-semibold rounded-xl hover:bg-purple-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  Add-ons
                </button>
                <button
                  onClick={() => setDeleteConfirm(pkg.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-100 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        // Backdrop click closes the modal. Body itself becomes the scroll
        // container — using items-start instead of items-center lets a
        // tall form scroll the page naturally on every device, fixing
        // the "can't reach the close button" bug.
        <div
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center p-0 sm:p-4">
            <div
              className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col sm:max-h-[calc(100vh-2rem)] min-h-screen sm:min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sm:rounded-t-2xl sticky top-0 z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? "Edit Package" : "New Service Package"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="p-2 -mr-2 rounded-xl hover:bg-gray-100"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form id="package-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Full Detail"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What's included in this service..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Price ($)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="199"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
                  <select
                    required
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="" disabled>Select duration</option>
                    {[30, 60, 90, 120, 150, 180, 210, 240, 300, 360, 480].map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ""}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Deposit ($)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.deposit}
                    onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Amount required upfront to secure the booking. Leave empty or 0 for no deposit.</p>
                </div>
              </div>

              {/* Vehicle-type pricing — collapsed by default so the
                  modal feels short. Click the header to expand; the
                  toggle inside controls the underlying form state. */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVehiclePricing((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 py-1 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className="text-base">🚗</span>
                    Vehicle-type pricing
                    <span className="text-xs font-medium text-gray-400">— optional</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {form.vehiclePricingEnabled && form.vehiclePricing.length > 0 && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{form.vehiclePricing.length}</span>
                    )}
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showVehiclePricing ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {showVehiclePricing && (<>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    Charge extra for bigger vehicles. Sedan is your base — add a surcharge for larger types.
                  </p>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={form.vehiclePricingEnabled}
                      onChange={toggleVehiclePricing}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-checked:bg-blue-600 rounded-full peer-focus:ring-2 peer-focus:ring-blue-200 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                  </label>
                </div>

                {form.vehiclePricingEnabled && (
                  <div className="mt-3 bg-blue-50/40 border border-blue-100 rounded-xl p-3 space-y-2">
                    {form.vehiclePricing.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-2">
                        No vehicle types selected. Add types below to make this package bookable.
                      </p>
                    ) : (
                      form.vehiclePricing.map((row) => {
                        const meta = VEHICLE_TYPES.find((v) => v.id === row.type);
                        if (!meta) return null;
                        return (
                          <div key={row.type} className="grid grid-cols-[1fr_120px_auto] gap-2 items-center">
                            <div className="flex items-center gap-2 text-sm text-gray-800">
                              <span className="text-lg">{meta.emoji}</span>
                              <span className="font-medium">{meta.label}</span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">+$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={row.surcharge}
                                onChange={(e) => updateVehicleSurcharge(row.type, e.target.value)}
                                placeholder="0"
                                className="w-full pl-8 pr-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 bg-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVehicleType(row.type)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Don't offer this package for this vehicle type"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })
                    )}

                    {/* Quick re-add buttons for vehicle types that were removed. */}
                    {(() => {
                      const present = new Set(form.vehiclePricing.map((r) => r.type));
                      const missing = VEHICLE_TYPES.filter((v) => !present.has(v.id));
                      if (missing.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-blue-100">
                          <span className="text-xs text-gray-500 self-center mr-1">Add:</span>
                          {missing.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => addVehicleType(v.id)}
                              className="text-xs px-2 py-1 rounded-md bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 transition-colors inline-flex items-center gap-1"
                            >
                              <span>{v.emoji}</span>
                              {v.label}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                </>)}
              </div>

              {/* Add-ons — collapsed by default. Header click expands. */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddons((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 py-1 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className="text-base">➕</span>
                    Add-ons
                    <span className="text-xs font-medium text-gray-400">— optional</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {form.addons.length > 0 && (
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">{form.addons.length}</span>
                    )}
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showAddons ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {showAddons && (<>
                <p className="text-xs text-gray-500 mt-2 mb-3">Extras the customer can tick at booking — e.g. &ldquo;Engine bay clean +$25&rdquo;, &ldquo;Pet hair removal +$15&rdquo;.</p>

                {form.addons.length === 0 ? (
                  <button
                    type="button"
                    onClick={addAddonRow}
                    className="w-full py-3 border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-xl text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors"
                  >
                    + Add your first add-on
                  </button>
                ) : (
                  <div className="space-y-2">
                    {form.addons.map((addon) => (
                      <div key={addon.id} className="grid grid-cols-[1fr_110px_auto] gap-2 items-start">
                        <input
                          type="text"
                          value={addon.name}
                          onChange={(e) => updateAddon(addon.id, { name: e.target.value })}
                          placeholder="Add-on name"
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={addon.price}
                            onChange={(e) => updateAddon(addon.id, { price: e.target.value })}
                            placeholder="0"
                            className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAddon(addon.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAddonRow}
                      className="w-full py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 rounded-lg transition-colors"
                    >
                      + Add another
                    </button>
                  </div>
                )}
                </>)}
              </div>
            </form>

            {/* Sticky footer — always visible at the bottom of the modal
                so the save button is reachable no matter how long the
                form gets. The cancel button doubles as a close button. */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white sm:rounded-b-2xl flex gap-3 sticky bottom-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="package-form"
                disabled={saving}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {editing ? "Save Changes" : "Create Package"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Package?</h3>
            <p className="text-gray-500 text-sm mb-6">This action cannot be undone. The package will be permanently deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <DashboardHelp page="packages" />
    </div>
  );
}
