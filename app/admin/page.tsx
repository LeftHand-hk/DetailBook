"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPlatformSettings, getAllUsers, getAllBookings, getAllPackages } from "@/lib/admin";

export default function AdminOverview() {
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setUsers(getAllUsers());
    setBookings(getAllBookings());
    setPackages(getAllPackages());
    setSettings(getPlatformSettings());
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="p-8 text-gray-400">Loading...</div>;

  const totalUsers = users.length;
  const activeSubscriptions = users.filter((u) => u.plan === "starter" || u.plan === "pro").length;
  const monthlyRevenue = users.reduce((sum, u) => {
    if (u.plan === "pro") return sum + (settings?.proPrice || 49);
    if (u.plan === "starter") return sum + (settings?.starterPrice || 29);
    return sum;
  }, 0);
  const totalBookings = bookings.length;

  const recentUsers = [...users].slice(-5).reverse();
  const recentBookings = [...bookings].slice(-5).reverse();

  const quickLinks = [
    { label: "Users", href: "/admin/users", desc: "Manage all users" },
    { label: "Subscriptions", href: "/admin/subscriptions", desc: "Pricing & plans" },
    { label: "Payments", href: "/admin/payments", desc: "Payment configuration" },
    { label: "Domains", href: "/admin/domains", desc: "Slugs & custom domains" },
    { label: "Database", href: "/admin/database", desc: "Raw data & exports" },
    { label: "Settings", href: "/admin/settings", desc: "Platform settings" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-sm text-gray-500 mt-1">DetailBook master admin panel</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: totalUsers },
            { label: "Active Subscriptions", value: activeSubscriptions },
            { label: "Monthly Revenue", value: `$${monthlyRevenue}` },
            { label: "Total Bookings", value: totalBookings },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Platform Health */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Platform Health</h2>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                settings?.maintenanceMode ? "bg-yellow-400" : "bg-green-500"
              }`}
            />
            <span className="text-sm text-gray-700">
              {settings?.maintenanceMode
                ? "Maintenance mode is ON"
                : "All systems operational"}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Signups */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Signups</h2>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-gray-400">No users yet.</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{u.businessName || u.name}</span>
                      <span className="text-gray-400 ml-2">{u.email}</span>
                    </div>
                    <span className="text-xs text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded">
                      {u.plan}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Bookings */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Bookings</h2>
            {recentBookings.length === 0 ? (
              <p className="text-sm text-gray-400">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{b.customerName}</span>
                      <span className="text-gray-400 ml-2">{b.serviceName}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        b.status === "confirmed"
                          ? "bg-green-50 text-green-700"
                          : b.status === "completed"
                          ? "bg-blue-50 text-blue-700"
                          : b.status === "cancelled"
                          ? "bg-red-50 text-red-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{link.label}</div>
                <div className="text-xs text-gray-400 mt-1">{link.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
