"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getPackages, setPackages, getUser, generateId } from "@/lib/storage";
import type { Package, PackageAddon, User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";
import SetupHint from "@/components/SetupHint";
import EmptyState, { EmptyIcons } from "@/components/EmptyState";

const QUICK_TEMPLATES = [
  { name: "Basic Wash", description: "Exterior wash, tire shine, and quick interior wipe-down.", price: "45", duration: "30", deposit: "" },
  { name: "Full Detail", description: "Complete interior and exterior detail with premium products.", price: "150", duration: "120", deposit: "" },
  { name: "Ceramic Coating", description: "Long-lasting ceramic protection with paint prep and decontamination.", price: "400", duration: "240", deposit: "" },
  { name: "Paint Correction", description: "Multi-stage polish to remove swirls, scratches, and oxidation.", price: "300", duration: "180", deposit: "" },
];

const STARTER_LIMIT = 5;

// Addon rows in the form keep price as a string so we can render empty
// inputs naturally. It's parsed to a number right before submit.
interface AddonDraft {
  id: string;
  name: string;
  price: string;
}

interface PackageFormData {
  name: string;
  description: string;
  price: string;
  duration: string;
  deposit: string;
  addons: AddonDraft[];
}

const EMPTY_FORM: PackageFormData = {
  name: "",
  description: "",
  price: "",
  duration: "",
  deposit: "",
  addons: [],
};

function newAddonDraft(): AddonDraft {
  return { id: `a_${Math.random().toString(36).slice(2, 10)}`, name: "", price: "" };
}

export default function PackagesPage() {
  const [packages, setPackagesState] = useState<Package[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState<PackageFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Guard against double submission. `saving` state alone isn't enough because
  // React batches state updates — a fast double-click can fire handleSave twice
  // before the disabled prop kicks in, creating duplicate packages on the server.
  const submittingRef = useRef(false);

  useEffect(() => {
    setUser(getUser());

    // Load packages from API (source of truth), fallback to localStorage
    fetch("/api/packages")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Package[]) => setPackagesState(data))
      .catch(() => setPackagesState(getPackages()));

    // Auto-open the "new package" modal only when the Setup Guide's
    // "+ Create custom service" link sent us here — that link uses
    // ?newPackage=1 specifically. The onboarding "Create Your First
    // Package" CTA and the dashboard Setup Progress Card just want to
    // land on the empty packages view, which is why they pass
    // ?setup=services (informational, no auto-open). One-shot read on
    // mount; strip the param so a refresh doesn't reopen the modal.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("newPackage") === "1") {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("newPackage");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    }
  }, []);

  const isStarter = user?.plan === "starter";
  const atLimit = isStarter && packages.length >= STARTER_LIMIT;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openWithTemplate = (t: typeof QUICK_TEMPLATES[number]) => {
    setEditing(null);
    setForm({ ...t, addons: [] });
    setShowModal(true);
  };

  const openEdit = (pkg: Package) => {
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
    });
    setShowModal(true);
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
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      duration: parseInt(form.duration),
      deposit: depositVal ?? 0,
      addons: cleanAddons,
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
          setPackages(newList);
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
          setPackages(newList);
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
    setPackages(updated);
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
    setPackages(updated);
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? "Edit Package" : "New Service Package"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
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

              {/* Add-ons (optional). Shown to customers as ticked extras on
                  the booking page; each adds its price (and optional minutes)
                  to the appointment total. */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-800">Add-ons (optional)</label>
                  <button
                    type="button"
                    onClick={addAddonRow}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add row
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-3">Extras the customer can tick at booking — e.g. &ldquo;Engine bay clean +$25&rdquo;, &ldquo;Pet hair removal +$15&rdquo;.</p>

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
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
            </form>
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
