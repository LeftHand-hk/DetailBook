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
type RangeType = "all" | "day" | "week" | "month";

export default function BookingsPage() {
  // Hydrate from localStorage cache so the list paints instantly while the
  // network refresh runs in the background.
  const [bookings, setBookings] = useState<Booking[]>(() => {
    if (typeof window === "undefined") return [];
    try { return getBookings() || []; } catch { return []; }
  });
  const [filter, setFilter] = useState<FilterType>("all");
  const [range, setRange] = useState<RangeType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      if (!res.ok) {
        setBookings(getBookings());
        return;
      }
      const data = await res.json();
      const mapped: Booking[] = data.map((b: any) => ({
        ...b,
        vehicle: b.vehicle || {
          make: b.vehicleMake || "",
          model: b.vehicleModel || "",
          year: b.vehicleYear || "",
          color: b.vehicleColor || "",
        },
      }));
      const sorted = mapped.sort((a, b) =>
        new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime()
      );
      setBookings(sorted);
      saveBookings(sorted);
    } catch {
      setBookings(getBookings());
    }
  };

  useEffect(() => {
    loadBookings();

    fetch("/api/user")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user?.plan === "pro") setIsPro(true);
      })
      .catch(() => setIsPro(getUser()?.plan === "pro"));

    fetch("/api/staff").then((r) => r.ok ? r.json() : []).then(setStaffList).catch(() => {});
  }, []);

  const openBooking = async (booking: Booking) => {
    // Show the panel immediately with list data; lazy-fetch paymentProof.
    setSelected(booking);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`);
      if (!res.ok) return;
      const full = await res.json();
      setSelected((cur) => (cur && cur.id === booking.id ? { ...cur, ...full, vehicle: cur.vehicle } : cur));
    } catch { /* silent — panel already usable without proof */ }
  };

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
    setDeleteError(null);
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDeleteError(err.error || `Delete failed (${res.status})`);
        return;
      }
    } catch (e: any) {
      setDeleteError(e?.message || "Network error while deleting");
      return;
    }
    const updated = bookings.filter((b) => b.id !== id);
    setBookings(updated);
    saveBookings(updated);
    setSelected(null);
    // Re-sync with DB to be safe
    loadBookings();
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

  // Compute date-range cutoffs for the day/week/month filter.
  const rangeStart = (() => {
    const d = new Date();
    if (range === "day") return today;
    if (range === "week") {
      d.setDate(d.getDate() - 6);
      return d.toISOString().split("T")[0];
    }
    if (range === "month") {
      d.setDate(d.getDate() - 29);
      return d.toISOString().split("T")[0];
    }
    return null;
  })();
  const inRange = (date: string) => !rangeStart || date >= rangeStart;

  const filtered = bookings.filter((b) => {
    const matchesSearch = b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.serviceName.toLowerCase().includes(search.toLowerCase()) ||
      b.vehicle.make.toLowerCase().includes(search.toLowerCase()) ||
      b.vehicle.model.toLowerCase().includes(search.toLowerCase()) ||
      b.customerEmail.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (!inRange(b.date)) return false;
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
      {deleteError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="font-semibold">Could not delete booking</div>
            <div className="text-red-600">{deleteError}</div>
          </div>
          <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}
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

          {/* Date range filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:border-l sm:border-gray-200 sm:pl-3">
            {([
              { key: "all", label: "All time" },
              { key: "day", label: "Today" },
              { key: "week", label: "Last 7 days" },
              { key: "month", label: "Last 30 days" },
            ] as { key: RangeType; label: string }[]).map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                  range === r.key
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {r.label}
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
              <div key={booking.id} onClick={() => openBooking(booking)}
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

                    {/* Status + inline confirm */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {booking.status === "pending" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateStatus(booking.id, "confirmed"); }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          Confirm
                        </button>
                      )}
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
          BOOKING DETAIL PANEL
      ═══════════════════════════════════════════════ */}
      {selected && (() => {
        const balance = selected.servicePrice - selected.depositPaid;
        const initials = selected.customerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
        const member = selected.staffId ? staffList.find((s) => s.id === selected.staffId) : null;
        const dateTag =
          isToday(selected.date) ? { label: "TODAY", cls: "bg-blue-100 text-blue-700" } :
          isTomorrow(selected.date) ? { label: "TOMORROW", cls: "bg-indigo-100 text-indigo-700" } :
          (isPast(selected.date) && selected.status !== "completed" && selected.status !== "cancelled")
            ? { label: "OVERDUE", cls: "bg-red-100 text-red-700" }
            : null;
        const pmRaw = (selected as any).paymentMethod;
        const pmLabel =
          pmRaw === "bankTransfer" ? "Bank Transfer" :
          pmRaw === "cashapp" ? "Cash App" :
          pmRaw === "stripe" ? "Card (Stripe)" :
          pmRaw === "square" ? "Square" :
          pmRaw === "paypal" ? "PayPal" :
          pmRaw === "cash" ? "Cash" : pmRaw;
        const proof = (selected as any).paymentProof as string | undefined;

        const allStatusOptions = [
          { key: "confirmed", label: "Confirm", active: "bg-green-600 text-white", idle: "bg-green-50 text-green-700 hover:bg-green-100" },
          { key: "completed", label: "Complete", active: "bg-blue-600 text-white", idle: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
          { key: "pending",   label: "Pending",  active: "bg-yellow-500 text-white", idle: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100" },
          { key: "cancelled", label: "Cancel",   active: "bg-red-600 text-white", idle: "bg-red-50 text-red-700 hover:bg-red-100" },
        ];
        // Once a booking is confirmed, the Confirm button is irrelevant —
        // re-clicking would not re-fire the email/SMS (intentional dedup),
        // so hide it to avoid confusion.
        const statusOptions = selected.status === "confirmed"
          ? allStatusOptions.filter((o) => o.key !== "confirmed")
          : allStatusOptions;
        const gridCols = statusOptions.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-stretch sm:justify-end" onClick={() => setSelected(null)}>
            <div className="bg-white w-full sm:max-w-md max-h-[92vh] sm:max-h-none sm:h-full rounded-t-3xl sm:rounded-none shadow-2xl animate-slideUp sm:animate-slideInRight flex flex-col"
              onClick={(e) => e.stopPropagation()}>

              {/* Mobile drag handle */}
              <div className="sm:hidden pt-2 pb-1 flex justify-center">
                <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
              </div>

              {/* Sticky header */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${statusColors[selected.status]}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${statusDots[selected.status]}`} />
                  {selected.status}
                </span>
                <button onClick={() => setSelected(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors -mr-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

                {/* Hero */}
                <div className="text-center pt-1">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 mb-3">
                    <span className="text-white font-extrabold text-lg">{initials}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900">{selected.customerName}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(selected.date)} · {selected.time}</p>
                  {dateTag && (
                    <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded ${dateTag.cls}`}>
                      {dateTag.label}
                    </span>
                  )}
                </div>

                {/* Quick contact */}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`mailto:${selected.customerEmail}`}
                    className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-sm py-2.5 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                  <a href={`tel:${selected.customerPhone}`}
                    className="flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-sm py-2.5 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </a>
                </div>

                {/* Info list */}
                <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100 shadow-sm">
                  <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Service</p>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{selected.serviceName}</p>
                      <p className="text-sm font-extrabold text-gray-900">${selected.servicePrice}</p>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Vehicle</p>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{selected.vehicle.year} {selected.vehicle.make} {selected.vehicle.model}</p>
                      {selected.vehicle.color && <p className="text-xs text-gray-500 mt-0.5">{selected.vehicle.color}</p>}
                    </div>
                  </div>
                  {selected.address && (
                    <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Address</p>
                      <p className="text-sm text-gray-900 text-right max-w-[60%]">{selected.address}</p>
                    </div>
                  )}
                  {isPro && staffList.length > 0 && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Staff</p>
                      <select
                        value={selected.staffId || ""}
                        onChange={(e) => assignStaff(selected.id, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[60%]"
                      >
                        <option value="">Unassigned</option>
                        {staffList.filter((s) => s.active).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {member && !staffList.length && selected.staffName && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Staff</p>
                      <p className="text-sm font-semibold text-gray-900">{selected.staffName}</p>
                    </div>
                  )}
                </div>

                {/* Payment card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Deposit</p>
                    <button
                      onClick={() => toggleDeposit(selected.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                        selected.depositPaid > 0
                          ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {selected.depositPaid > 0 ? "Mark Unpaid" : "Mark Paid"}
                    </button>
                  </div>
                  <p className="text-3xl font-extrabold text-gray-900">
                    ${selected.depositPaid}
                    <span className={`text-sm font-bold ml-2 ${selected.depositPaid > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {selected.depositPaid > 0 ? "paid" : "unpaid"}
                    </span>
                  </p>
                  {pmLabel && (
                    <p className="text-xs text-gray-500 mt-1">via {pmLabel}</p>
                  )}
                  <div className="border-t border-blue-200/60 mt-4 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Balance due</span>
                    <span className={`text-lg font-extrabold ${balance > 0 ? "text-gray-900" : "text-green-600"}`}>
                      ${balance}
                    </span>
                  </div>
                </div>

                {/* Payment proof */}
                {proof && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Proof of payment</p>
                    <a href={proof} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={proof}
                        alt="Payment proof"
                        className="w-full rounded-xl border border-gray-200 hover:opacity-90 transition-opacity"
                      />
                    </a>
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Customer notes</p>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      <p className="text-sm text-gray-700 leading-relaxed">{selected.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky action footer */}
              <div
                className="sticky bottom-0 bg-white border-t border-gray-100 px-4 pt-3 space-y-2"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <div className={`grid ${gridCols} gap-1.5`}>
                  {statusOptions.map((opt) => {
                    const isActive = selected.status === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => !isActive && updateStatus(selected.id, opt.key)}
                        disabled={isActive}
                        className={`text-xs font-bold py-2.5 rounded-xl transition-colors ${
                          isActive ? `${opt.active} cursor-default` : opt.idle
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => removeBooking(selected.id)}
                  className="w-full text-xs text-red-500 hover:text-red-700 font-semibold py-1 transition-colors">
                  Delete booking
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
