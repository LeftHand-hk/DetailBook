"use client";

import { useState, useEffect } from "react";
import { getBookings, setBookings as saveBookings, getUser } from "@/lib/storage";
import type { Booking, Staff } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 border border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  completed: "bg-blue-100 text-blue-700 border border-blue-200",
  cancelled: "bg-red-100 text-red-700 border border-red-200",
};

const statusDots: Record<string, string> = {
  confirmed: "bg-green-500",
  pending: "bg-yellow-500",
  completed: "bg-blue-500",
  cancelled: "bg-red-500",
};

type FilterType = "all" | "upcoming" | "completed" | "cancelled" | "pending";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    // Load from API (source of truth)
    fetch("/api/bookings")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        // Map flat DB fields to nested shape the page expects
        const mapped: Booking[] = data.map((b) => ({
          ...b,
          vehicle: b.vehicle || {
            make: b.vehicleMake || "",
            model: b.vehicleModel || "",
            year: b.vehicleYear || "",
            color: b.vehicleColor || "",
          },
        }));
        // Sort by createdAt newest first
        const sorted = mapped.sort((a, b) =>
          new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime()
        );
        setBookings(sorted);
      })
      .catch(() => setBookings(getBookings()));

    fetch("/api/user")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user?.plan === "pro") setIsPro(true);
      })
      .catch(() => setIsPro(getUser()?.plan === "pro"));

    fetch("/api/staff").then((r) => r.ok ? r.json() : []).then(setStaffList).catch(() => {});
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    const updated = bookings.map((b) =>
      b.id === id ? { ...b, status: newStatus } : b
    );
    setBookings(updated);
    saveBookings(updated);
    if (selected && selected.id === id) {
      setSelected({ ...selected, status: newStatus });
    }
    // Persist to DB + triggers confirmation email/SMS on "confirmed"
    try {
      await fetch(`/api/bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch { /* silent — optimistic update already applied */ }
  };

  const assignStaff = async (bookingId: string, staffId: string) => {
    const member = staffList.find((s) => s.id === staffId);
    try {
      await fetch(`/api/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staffId || null, staffName: member?.name || null }),
      });
    } catch { /* silent */ }
    const updated = bookings.map((b) =>
      b.id === bookingId ? { ...b, staffId, staffName: member?.name } : b
    );
    setBookings(updated);
    saveBookings(updated);
    if (selected?.id === bookingId) {
      setSelected({ ...selected, staffId, staffName: member?.name });
    }
  };

  const removeBooking = async (id: string) => {
    const updated = bookings.filter((b) => b.id !== id);
    setBookings(updated);
    saveBookings(updated);
    setSelected(null);
    try {
      await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    } catch { /* silent */ }
  };

  const toggleDeposit = async (id: string) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const newDepositPaid = booking.depositPaid > 0 ? 0 : (booking.depositRequired || booking.depositPaid || 50);
    const updated = bookings.map((b) =>
      b.id === id ? { ...b, depositPaid: newDepositPaid } : b
    );
    setBookings(updated);
    saveBookings(updated);
    if (selected && selected.id === id) {
      setSelected({ ...selected, depositPaid: newDepositPaid });
    }
    try {
      await fetch(`/api/bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositPaid: newDepositPaid }),
      });
    } catch { /* silent — optimistic update already applied */ }
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = bookings.filter((b) => {
    const matchesSearch = b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.serviceName.toLowerCase().includes(search.toLowerCase()) ||
      b.vehicle.make.toLowerCase().includes(search.toLowerCase()) ||
      b.vehicle.model.toLowerCase().includes(search.toLowerCase()) ||
      b.customerEmail.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    if (filter === "upcoming") return b.date >= today && b.status !== "cancelled";
    if (filter === "completed") return b.status === "completed";
    if (filter === "cancelled") return b.status === "cancelled";
    if (filter === "pending") return b.status === "pending";
    return true;
  });

  const formatDate = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const formatDateShort = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const isToday = (date: string) => date === today;
  const isTomorrow = (date: string) => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return date === t.toISOString().split("T")[0];
  };
  const isPast = (date: string) => date < today;

  const counts: Record<FilterType, number> = {
    all: bookings.length,
    upcoming: bookings.filter((b) => b.date >= today && b.status !== "cancelled").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    pending: bookings.filter((b) => b.status === "pending").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  const totalRevenue = bookings.filter(b => b.status === "completed").reduce((s, b) => s + b.servicePrice, 0);
  const totalDeposits = bookings.reduce((s, b) => s + b.depositPaid, 0);
  const pendingDeposits = bookings.filter(b => b.status !== "cancelled" && b.depositPaid === 0 && (b.depositRequired || 0) > 0).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Bookings</h1>
            <p className="text-gray-500 text-sm">Manage and track all your customer bookings</p>
          </div>
          <button onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-200 transition-colors flex-shrink-0 font-semibold text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Need Help?
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            ${totalRevenue.toLocaleString()} earned
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            ${totalDeposits.toLocaleString()} deposits
          </div>
          {pendingDeposits > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              {pendingDeposits} awaiting deposit
            </div>
          )}
        </div>
      </div>

      {/* Filters + Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
        {/* Search (on top for mobile) */}
        <div className="p-4 pb-0 sm:hidden">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search name, email, vehicle..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full" />
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {(["all", "upcoming", "completed", "pending", "cancelled"] as FilterType[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold capitalize transition-all ${
                  filter === f
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {f}
                <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
                  filter === f ? "bg-white/20 text-white" : "bg-white text-gray-500"
                }`}>{counts[f]}</span>
              </button>
            ))}
          </div>

          {/* Desktop search */}
          <div className="relative hidden sm:block sm:ml-auto">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search name, email, vehicle..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64" />
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-500">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-semibold">No bookings found</p>
          <p className="text-sm mt-1">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const depositPaid = booking.depositPaid || 0;
            const depositRequired = booking.depositRequired || 0;
            const hasDeposit = depositRequired > 0 || depositPaid > 0;
            const depositComplete = depositPaid >= depositRequired && depositRequired > 0;

            return (
              <div key={booking.id} onClick={() => setSelected(booking)}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                  booking.status === "cancelled" ? "border-gray-100 opacity-60" : "border-gray-100 hover:border-blue-200"
                }`}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Customer */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-white font-bold text-sm">{booking.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900 truncate">{booking.customerName}</p>
                          {isToday(booking.date) && <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">TODAY</span>}
                          {isTomorrow(booking.date) && <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">TOMORROW</span>}
                          {isPast(booking.date) && booking.status !== "completed" && booking.status !== "cancelled" && (
                            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">OVERDUE</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{booking.customerEmail} | {booking.customerPhone}</p>
                      </div>
                    </div>

                    {/* Service */}
                    <div className="hidden md:block flex-shrink-0 w-48">
                      <p className="text-sm font-semibold text-gray-800 truncate">{booking.serviceName}</p>
                      <p className="text-xs text-gray-500">{booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}</p>
                    </div>

                    {/* Date */}
                    <div className="hidden lg:block flex-shrink-0 w-28 text-right">
                      <p className="text-sm font-semibold text-gray-800">{formatDateShort(booking.date)}</p>
                      <p className="text-xs text-gray-500">{booking.time}</p>
                    </div>

                    {/* Price & Deposit */}
                    <div className="hidden xl:block flex-shrink-0 w-36 text-right">
                      <p className="text-sm font-bold text-gray-900">${booking.servicePrice}</p>
                      {hasDeposit ? (
                        depositComplete ? (
                          <span className="text-xs text-green-600 font-semibold">${depositPaid} deposit paid</span>
                        ) : depositPaid > 0 ? (
                          <span className="text-xs text-amber-600 font-semibold">${depositPaid}/${depositRequired} deposit</span>
                        ) : (
                          <span className="text-xs text-red-500 font-semibold">No deposit yet</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">No deposit req.</span>
                      )}
                    </div>

                    {/* Staff badge */}
                    {isPro && booking.staffId && (() => {
                      const m = staffList.find((s) => s.id === booking.staffId);
                      return m ? (
                        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: m.color }}>
                            {m.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{m.name.split(" ")[0]}</span>
                        </div>
                      ) : null;
                    })()}

                    {/* Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${statusDots[booking.status]}`} />
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${statusColors[booking.status]}`}>{booking.status}</span>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div className="flex flex-wrap gap-3 mt-3 sm:hidden text-xs text-gray-500">
                    <span>{booking.serviceName}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatDateShort(booking.date)} · {booking.time}</span>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-gray-700">${booking.servicePrice}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          FULL-SCREEN BOOKING DETAIL PANEL
      ═══════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl animate-slideInRight"
            onClick={(e) => e.stopPropagation()}>

            {/* Top Bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 sm:px-8 py-4 flex items-center justify-between">
              <button onClick={() => setSelected(null)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-semibold">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Bookings
              </button>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold capitalize ${statusColors[selected.status]}`}>
                  <div className={`w-2 h-2 rounded-full ${statusDots[selected.status]}`} />
                  {selected.status}
                </span>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-8">

              {/* ── Customer ── */}
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md">
                    <span className="text-white font-extrabold text-xl">{selected.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900">{selected.customerName}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      {isToday(selected.date) && <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2.5 py-1 rounded-lg">TODAY</span>}
                      {isTomorrow(selected.date) && <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-lg">TOMORROW</span>}
                      {isPast(selected.date) && selected.status !== "completed" && selected.status !== "cancelled" && (
                        <span className="text-xs bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-lg">OVERDUE</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <a href={`mailto:${selected.customerEmail}`}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl p-4 transition-colors group">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 font-semibold">Email</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{selected.customerEmail}</p>
                    </div>
                  </a>
                  <a href={`tel:${selected.customerPhone}`}
                    className="flex items-center gap-3 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-200 rounded-xl p-4 transition-colors group">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 font-semibold">Phone</p>
                      <p className="text-sm font-semibold text-gray-900">{selected.customerPhone}</p>
                    </div>
                  </a>
                </div>
              </div>

              {/* ── Appointment Details ── */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Appointment</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-blue-600 font-bold uppercase">Date & Time</span>
                    </div>
                    <p className="text-base font-bold text-gray-900">{formatDate(selected.date)}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{selected.time}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs text-gray-500 font-bold uppercase">Vehicle</span>
                    </div>
                    <p className="text-base font-bold text-gray-900">{selected.vehicle.year} {selected.vehicle.make} {selected.vehicle.model}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{selected.vehicle.color}</p>
                  </div>
                </div>
              </div>

              {/* ── Service ── */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Service</h3>
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-lg font-bold text-gray-900">{selected.serviceName}</p>
                    <p className="text-lg font-extrabold text-gray-900">${selected.servicePrice}</p>
                  </div>
                </div>
              </div>

              {/* ── Assigned Staff ── */}
              {isPro && staffList.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Assigned Staff</h3>
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      {selected.staffId ? (
                        (() => {
                          const member = staffList.find((s) => s.id === selected.staffId);
                          return (
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                                style={{ backgroundColor: member?.color || "#3B82F6" }}>
                                {(member?.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{member?.name || selected.staffName}</p>
                                <p className="text-xs text-gray-500 capitalize">{member?.role || ""}</p>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-sm text-gray-400 flex-1">No staff assigned</p>
                      )}
                      <select
                        value={selected.staffId || ""}
                        onChange={(e) => assignStaff(selected.id, e.target.value)}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Unassigned</option>
                        {staffList.filter((s) => s.active).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Payment & Deposit ── */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Payment</h3>
                <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                  {/* Deposit row */}
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selected.depositPaid > 0 ? "bg-green-100" : "bg-red-100"}`}>
                        {selected.depositPaid > 0 ? (
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Deposit</p>
                        <p className={`text-lg font-extrabold ${selected.depositPaid > 0 ? "text-green-600" : "text-red-500"}`}>
                          ${selected.depositPaid}
                          {selected.depositPaid > 0 ? " paid" : " unpaid"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDeposit(selected.id)}
                      className={`px-5 py-3 rounded-xl font-bold text-sm transition-colors ${
                        selected.depositPaid > 0
                          ? "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100"
                          : "bg-green-600 text-white hover:bg-green-700 shadow-md"
                      }`}
                    >
                      {selected.depositPaid > 0 ? "Mark as Unpaid" : "Mark as Paid"}
                    </button>
                  </div>

                  {/* Balance */}
                  <div className="bg-gray-50 border-t-2 border-gray-200 p-5 flex items-center justify-between">
                    <p className="text-base font-bold text-gray-700">Balance Due</p>
                    <p className={`text-2xl font-extrabold ${(selected.servicePrice - selected.depositPaid) > 0 ? "text-gray-900" : "text-green-600"}`}>
                      ${selected.servicePrice - selected.depositPaid}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Payment Method & Proof ── */}
              {((selected as any).paymentMethod || (selected as any).paymentProof) && (
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Details</h3>
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 space-y-3">
                    {(selected as any).paymentMethod && (
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {(selected as any).paymentMethod === "stripe" ? "💳" :
                           (selected as any).paymentMethod === "paypal" ? "🅿️" :
                           (selected as any).paymentMethod === "cashapp" ? "💵" :
                           (selected as any).paymentMethod === "bankTransfer" ? "🏦" : "💰"}
                        </span>
                        <div>
                          <p className="text-xs text-gray-500">Payment Method</p>
                          <p className="text-sm font-bold text-gray-900 capitalize">
                            {(selected as any).paymentMethod === "bankTransfer" ? "Bank Transfer" :
                             (selected as any).paymentMethod === "cashapp" ? "Cash App" :
                             (selected as any).paymentMethod === "stripe" ? "Card (Stripe)" :
                             (selected as any).paymentMethod}
                          </p>
                        </div>
                      </div>
                    )}
                    {(selected as any).paymentProof && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Proof of Payment</p>
                        <a href={(selected as any).paymentProof} target="_blank" rel="noopener noreferrer">
                          <img
                            src={(selected as any).paymentProof}
                            alt="Payment proof"
                            className="w-full max-w-sm rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Notes ── */}
              {selected.notes && (
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Notes</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                    <p className="text-sm text-gray-700 leading-relaxed">{selected.notes}</p>
                  </div>
                </div>
              )}

              {/* ── Change Status ── */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Change Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  {selected.status !== "confirmed" && (
                    <button onClick={() => updateStatus(selected.id, "confirmed")}
                      className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-700 border-2 border-green-200 font-bold text-base rounded-xl hover:bg-green-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Confirm
                    </button>
                  )}
                  {selected.status !== "completed" && (
                    <button onClick={() => updateStatus(selected.id, "completed")}
                      className="flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 border-2 border-blue-200 font-bold text-base rounded-xl hover:bg-blue-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Complete
                    </button>
                  )}
                  {selected.status !== "pending" && (
                    <button onClick={() => updateStatus(selected.id, "pending")}
                      className="flex items-center justify-center gap-2 p-4 bg-yellow-50 text-yellow-700 border-2 border-yellow-200 font-bold text-base rounded-xl hover:bg-yellow-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Pending
                    </button>
                  )}
                  {selected.status !== "cancelled" && (
                    <button onClick={() => updateStatus(selected.id, "cancelled")}
                      className="flex items-center justify-center gap-2 p-4 bg-red-50 text-red-700 border-2 border-red-200 font-bold text-base rounded-xl hover:bg-red-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* ── Delete ── */}
              <button onClick={() => removeBooking(selected.id)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 border border-red-200 font-semibold text-sm rounded-xl hover:bg-red-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete Booking
              </button>

              {/* Booking ID */}
              <p className="text-xs text-gray-300 text-center font-mono">Booking ID: {selected.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          HELP GUIDE MODAL
      ═══════════════════════════════════════════════ */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-white">How Bookings Work</h2>
                <button onClick={() => setShowHelp(false)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-blue-100 text-sm mt-1">Everything you need to know about managing your bookings</p>
            </div>

            <div className="p-6 space-y-5">
              {[
                {
                  icon: "📋",
                  iconBg: "bg-blue-100",
                  title: "Viewing Bookings",
                  points: [
                    "All your bookings appear as cards on this page",
                    "Click any booking to see full details and take action",
                    "Use the filter tabs (All, Upcoming, Completed, Pending, Cancelled) to find specific bookings",
                    "Use the search bar to find customers by name, email, or vehicle",
                  ],
                },
                {
                  icon: "🔄",
                  iconBg: "bg-green-100",
                  title: "Changing Booking Status",
                  points: [
                    "Click a booking, then use the big colored buttons at the bottom",
                    "Pending = New booking, waiting for you to confirm",
                    "Confirmed = You accepted the job, customer is notified",
                    "Completed = Job is done",
                    "Cancelled = Booking was cancelled",
                  ],
                },
                {
                  icon: "💰",
                  iconBg: "bg-amber-100",
                  title: "Managing Deposits",
                  points: [
                    "Each booking shows if a deposit has been paid or not",
                    "Click a booking and use \"Mark as Paid\" or \"Mark as Unpaid\" to update",
                    "The Balance Due updates automatically",
                    "The summary at the top shows total deposits collected",
                  ],
                },
                {
                  icon: "🏷️",
                  iconBg: "bg-purple-100",
                  title: "Understanding Tags",
                  points: [
                    "TODAY (purple) = Appointment is scheduled for today",
                    "TOMORROW (indigo) = Appointment is tomorrow",
                    "OVERDUE (red) = Appointment date has passed but it's still pending",
                  ],
                },
                {
                  icon: "💡",
                  iconBg: "bg-indigo-100",
                  title: "Pro Tips",
                  points: [
                    "Confirm bookings quickly so customers know you're on it",
                    "Mark jobs as Completed right after finishing to keep records clean",
                    "Check the \"Pending\" filter daily for new bookings that need attention",
                    "Use the deposit tracking to know who still owes you money",
                  ],
                },
              ].map((section, i) => (
                <div key={i} className="flex gap-4">
                  <div className={`w-10 h-10 ${section.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 text-xl`}>
                    {section.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm mb-2">{section.title}</h3>
                    <ul className="space-y-1.5">
                      {section.points.map((point, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <button onClick={() => setShowHelp(false)}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-base">
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
      <DashboardHelp page="bookings" />
    </div>
  );
}
