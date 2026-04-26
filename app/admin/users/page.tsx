"use client";

import { useState, useEffect } from "react";

interface AdminUser {
  id: string;
  email: string;
  businessName: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  slug: string;
  plan: string;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  suspended: boolean;
  createdAt: string;
  updatedAt: string;
  packageCount: number;
  bookingCount: number;
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        value ? "bg-blue-600" : "bg-gray-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function getUserStatus(user: AdminUser): "trial" | "active" | "suspended" | "expired" {
  if (user.suspended) return "suspended";
  if (user.subscriptionStatus === "active") return "active";
  if (user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) return "trial";
  return "expired";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<{ id: string; email: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateUser = async (userId: string, updates: Record<string, unknown>) => {
    setSaving(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data } : u)));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user");
      return false;
    } finally {
      setSaving(null);
    }
  };

  const handlePlanChange = (userId: string, plan: string) => {
    updateUser(userId, { plan });
  };

  const handleStatusChange = async (userId: string, status: string) => {
    if (status === "active") {
      await updateUser(userId, { subscriptionStatus: "active", suspended: false });
    } else if (status === "trial") {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 15);
      await updateUser(userId, {
        subscriptionStatus: "trial",
        trialEndsAt: trialEndsAt.toISOString(),
        suspended: false,
      });
    } else if (status === "expired") {
      await updateUser(userId, {
        subscriptionStatus: "expired",
        trialEndsAt: new Date(Date.now() - 86400000).toISOString(),
      });
    }
  };

  const handleSuspendToggle = (userId: string, current: boolean) => {
    updateUser(userId, { suspended: !current });
  };

  const handleSaveEmail = async () => {
    if (!editingEmail) return;
    const ok = await updateUser(editingEmail.id, { email: editingEmail.email });
    if (ok) setEditingEmail(null);
  };

  const handleImpersonate = async (userId: string) => {
    setSaving(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to start impersonation");
      // Open in a new tab so the admin keeps the original tab on the admin app.
      window.open("/dashboard", "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start impersonation");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSaving(deleteConfirm.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(deleteConfirm.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setSaving(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      (u.businessName || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = users.length;
  const trialCount = users.filter((u) => getUserStatus(u) === "trial").length;
  const starterCount = users.filter((u) => u.plan === "starter").length;
  const proCount = users.filter((u) => u.plan === "pro").length;
  const suspendedCount = users.filter((u) => u.suspended).length;

  if (!loaded) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all registered users</p>
          </div>
          <button
            onClick={load}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Users", value: totalUsers },
            { label: "On Trial", value: trialCount },
            { label: "Starter Plan", value: starterCount },
            { label: "Pro Plan", value: proCount },
            { label: "Suspended", value: suspendedCount },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search by name, email, or business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm">
                {users.length === 0 ? "No users have signed up yet." : "No users match your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Business</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Usage</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const status = getUserStatus(user);
                    const isSaving = saving === user.id;
                    return (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{user.businessName || user.name}</div>
                          <div className="text-xs text-gray-500">/{user.slug}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{user.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={user.plan}
                            disabled={isSaving}
                            onChange={(e) => handlePlanChange(user.id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 disabled:opacity-50"
                          >
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={status === "suspended" ? "trial" : status}
                            disabled={isSaving || status === "suspended"}
                            onChange={(e) => handleStatusChange(user.id, e.target.value)}
                            className={`px-2 py-1 border rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                              status === "active"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : status === "trial"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : status === "suspended"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                          </select>
                          {status === "suspended" && (
                            <div className="text-xs text-red-600 mt-1">Suspended</div>
                          )}
                          {status === "trial" && user.trialEndsAt && (
                            <div className="text-xs text-gray-500 mt-1">
                              Until {new Date(user.trialEndsAt).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div className="text-xs">
                            {user.packageCount} pkgs · {user.bookingCount} bookings
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">Susp.</span>
                              <Toggle
                                value={user.suspended}
                                disabled={isSaving}
                                onChange={() => handleSuspendToggle(user.id, user.suspended)}
                              />
                            </div>
                            <button
                              onClick={() => handleImpersonate(user.id)}
                              disabled={isSaving}
                              title="Open this client's dashboard as if you were them (new tab)"
                              className="px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded-md disabled:opacity-50"
                            >
                              View as
                            </button>
                            <button
                              onClick={() => setEditingEmail({ id: user.id, email: user.email })}
                              disabled={isSaving}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50"
                            >
                              Edit Email
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(user)}
                              disabled={isSaving}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Email Modal */}
      {editingEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Edit Email</h3>
            <p className="text-sm text-gray-500 mb-4">
              Update the email address for this account. The user will need to use the new email to log in.
            </p>
            <input
              type="email"
              value={editingEmail.email}
              onChange={(e) => setEditingEmail({ ...editingEmail, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 mb-4"
              placeholder="new@example.com"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingEmail(null)}
                disabled={saving === editingEmail.id}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmail}
                disabled={saving === editingEmail.id}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving === editingEmail.id ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User</h3>
            <p className="text-sm text-gray-700 mb-2">
              Are you sure you want to delete{" "}
              <strong>{deleteConfirm.businessName || deleteConfirm.name}</strong> ({deleteConfirm.email})?
            </p>
            <p className="text-sm text-red-600 mb-4">
              This will permanently delete their account, packages ({deleteConfirm.packageCount}), bookings (
              {deleteConfirm.bookingCount}), staff, and support tickets. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={saving === deleteConfirm.id}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving === deleteConfirm.id}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving === deleteConfirm.id ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
