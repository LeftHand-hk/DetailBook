"use client";

import { useState, useEffect } from "react";
import { getAllUsers } from "@/lib/admin";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const allUsers = getAllUsers().map((u) => ({
      ...u,
      suspended: u.suspended || false,
      createdAt: u.createdAt || u.trialEndsAt || new Date().toISOString(),
    }));
    setUsers(allUsers);
    setLoaded(true);
  }, []);

  const handlePlanChange = (userId: string, plan: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, plan };
          // Persist to localStorage
          localStorage.setItem("detailbook_user", JSON.stringify(updated));
          return updated;
        }
        return u;
      })
    );
  };

  const handleSuspendToggle = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, suspended: !u.suspended };
          localStorage.setItem("detailbook_user", JSON.stringify(updated));
          return updated;
        }
        return u;
      })
    );
  };

  const filtered = users.filter(
    (u) =>
      (u.businessName || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = users.length;
  const starterCount = users.filter((u) => u.plan === "starter").length;
  const proCount = users.filter((u) => u.plan === "pro").length;
  const suspendedCount = users.filter((u) => u.suspended).length;

  if (!loaded) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all registered users</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: totalUsers },
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
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Business Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{user.businessName || user.name}</td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={user.plan}
                          onChange={(e) => handlePlanChange(user.id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            user.suspended
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {user.suspended ? "Suspended" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Suspend</span>
                          <Toggle
                            value={user.suspended}
                            onChange={() => handleSuspendToggle(user.id)}
                          />
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
