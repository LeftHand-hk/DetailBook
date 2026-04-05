"use client";

import { useState, useEffect } from "react";
import { getPlatformSettings, setPlatformSettings, getAllUsers } from "@/lib/admin";
import type { PlatformSettings } from "@/lib/admin";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        value ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AdminDomainsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editSlugValue, setEditSlugValue] = useState("");

  useEffect(() => {
    setSettings(getPlatformSettings());
    setUsers(
      getAllUsers().map((u) => ({
        ...u,
        blocked: u.blocked || false,
      }))
    );
    setLoaded(true);
  }, []);

  const handleCustomDomainsToggle = (val: boolean) => {
    if (!settings) return;
    const updated = { ...settings, customDomainsEnabled: val };
    setPlatformSettings(updated);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBlockToggle = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, blocked: !u.blocked };
          localStorage.setItem("detailbook_user", JSON.stringify(updated));
          return updated;
        }
        return u;
      })
    );
  };

  const handleEditSlug = (userId: string, currentSlug: string) => {
    setEditingSlug(userId);
    setEditSlugValue(currentSlug);
  };

  const handleSaveSlug = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, slug: editSlugValue };
          localStorage.setItem("detailbook_user", JSON.stringify(updated));
          return updated;
        }
        return u;
      })
    );
    setEditingSlug(null);
  };

  if (!loaded || !settings) return <div className="p-8 text-gray-400">Loading...</div>;

  const domain = settings.defaultDomain;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Domains</h1>
          <p className="text-sm text-gray-500 mt-1">Manage user slugs and domain settings</p>
        </div>

        {/* Default Domain */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Default Domain</h2>
          <p className="text-sm text-gray-500 mb-4">All booking pages are served under this domain</p>
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
            <span className="text-sm font-mono text-gray-900">{domain}</span>
          </div>
        </div>

        {/* Custom Domains Toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Custom Domains</h2>
              <p className="text-sm text-gray-500 mt-0.5">Allow Pro users to connect custom domains</p>
            </div>
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
              <Toggle
                value={settings.customDomainsEnabled}
                onChange={handleCustomDomainsToggle}
              />
            </div>
          </div>
        </div>

        {/* User Domains / Slugs */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">User Slugs</h2>
            <p className="text-sm text-gray-500 mt-0.5">All registered user booking page slugs</p>
          </div>
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">No users registered yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Full URL</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {editingSlug === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editSlugValue}
                              onChange={(e) => setEditSlugValue(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 w-40"
                            />
                            <button
                              onClick={() => handleSaveSlug(user.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSlug(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-gray-900">{user.slug}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {domain}/{user.slug}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{user.businessName || user.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded uppercase tracking-wide ${
                            user.plan === "pro"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            user.blocked
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {user.blocked ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {editingSlug !== user.id && (
                            <button
                              onClick={() => handleEditSlug(user.id, user.slug)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleBlockToggle(user.id)}
                            className={`text-xs font-medium ${
                              user.blocked
                                ? "text-green-600 hover:text-green-800"
                                : "text-red-600 hover:text-red-800"
                            }`}
                          >
                            {user.blocked ? "Unblock" : "Block"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
