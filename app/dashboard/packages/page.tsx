"use client";

import { useState, useEffect } from "react";
import { getPackages, setPackages, getUser, generateId } from "@/lib/storage";
import type { Package, User } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

const STARTER_LIMIT = 5;

interface PackageFormData {
  name: string;
  description: string;
  price: string;
  duration: string;
  deposit: string;
}

const EMPTY_FORM: PackageFormData = {
  name: "",
  description: "",
  price: "",
  duration: "",
  deposit: "",
};

export default function PackagesPage() {
  const [packages, setPackagesState] = useState<Package[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState<PackageFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setUser(getUser());

    // Load packages from API (source of truth), fallback to localStorage
    fetch("/api/packages")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Package[]) => setPackagesState(data))
      .catch(() => setPackagesState(getPackages()));
  }, []);

  const isStarter = user?.plan === "starter";
  const atLimit = isStarter && packages.length >= STARTER_LIMIT;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
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
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const depositVal = form.deposit ? parseFloat(form.deposit) : undefined;
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      duration: parseInt(form.duration),
      deposit: depositVal ?? 0,
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
            p.id === editing.id ? { ...p, ...payload, deposit: depositVal } : p
          )
        : [...packages, { id: generateId(), ...payload, active: true, deposit: depositVal }];
      setPackages(updated);
      setPackagesState(updated);
    }

    setSaving(false);
    setShowModal(false);
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
              <a href="/dashboard/billing" className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                Upgrade to Pro
              </a>
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
          <a href="/dashboard/billing" className="flex-shrink-0 bg-white text-blue-600 font-bold px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-sm whitespace-nowrap">
            Upgrade to Pro — $50/mo
          </a>
        </div>
      )}

      {/* Package Grid */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No packages yet</h3>
          <p className="text-gray-500 mb-6">Create your first service package to get started.</p>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Add Your First Package
          </button>
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
                    {pkg.deposit && pkg.deposit > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full mt-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>
                        ${pkg.deposit} deposit required
                      </span>
                    )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (min)</label>
                  <input
                    type="number"
                    required
                    min="30"
                    step="15"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="240"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  />
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
