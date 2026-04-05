"use client";

import { useState, useEffect } from "react";
import { getPlatformSettings, setPlatformSettings, getAllUsers } from "@/lib/admin";
import type { PlatformSettings } from "@/lib/admin";

export default function AdminSubscriptionsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [starterPrice, setStarterPrice] = useState("");
  const [proPrice, setProPrice] = useState("");
  const [trialDays, setTrialDays] = useState("");
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = getPlatformSettings();
    setSettings(s);
    setStarterPrice(String(s.starterPrice));
    setProPrice(String(s.proPrice));
    setTrialDays(String(s.trialDays));
    setUsers(getAllUsers());
    setLoaded(true);
  }, []);

  const handleSave = () => {
    if (!settings) return;
    const updated: PlatformSettings = {
      ...settings,
      starterPrice: Number(starterPrice) || 25,
      proPrice: Number(proPrice) || 49,
      trialDays: Number(trialDays) || 30,
    };
    setPlatformSettings(updated);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!loaded || !settings)
    return <div className="p-8 text-gray-400">Loading...</div>;

  const starterCount = users.filter((u) => u.plan === "starter").length;
  const proCount = users.filter((u) => u.plan === "pro").length;
  const monthlyRevenue =
    starterCount * (Number(starterPrice) || 0) + proCount * (Number(proPrice) || 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage pricing, plans, and subscription data</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Starter Users", value: starterCount },
            { label: "Pro Users", value: proCount },
            { label: "Monthly Revenue", value: `$${monthlyRevenue}` },
            { label: "Trial Days", value: settings.trialDays },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Pricing Editor */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Pricing Editor</h2>
          <p className="text-sm text-gray-500 mb-6">Set the monthly prices for each plan</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starter Price ($/mo)</label>
              <input
                type="number"
                value={starterPrice}
                onChange={(e) => setStarterPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pro Price ($/mo)</label>
              <input
                type="number"
                value={proPrice}
                onChange={(e) => setProPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
              <input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Pricing
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">Saved!</span>
            )}
          </div>
        </div>

        {/* Current Subscriptions */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Current Subscriptions</h2>
          </div>
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">No subscriptions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Business</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Price</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Trial Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{user.businessName || user.name}</td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
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
                      <td className="px-4 py-3 text-gray-700">
                        ${user.plan === "pro" ? proPrice : starterPrice}/mo
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {user.trialEndsAt
                          ? new Date(user.trialEndsAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Revenue Calculation */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Starter ({starterCount} users x ${starterPrice})</span>
              <span className="font-medium text-gray-900">${starterCount * (Number(starterPrice) || 0)}/mo</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Pro ({proCount} users x ${proPrice})</span>
              <span className="font-medium text-gray-900">${proCount * (Number(proPrice) || 0)}/mo</span>
            </div>
            <div className="flex justify-between py-2 font-semibold">
              <span className="text-gray-900">Total Monthly Revenue</span>
              <span className="text-gray-900">${monthlyRevenue}/mo</span>
            </div>
            <div className="flex justify-between py-2 text-gray-500">
              <span>Projected Annual Revenue</span>
              <span className="font-medium">${monthlyRevenue * 12}/yr</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
