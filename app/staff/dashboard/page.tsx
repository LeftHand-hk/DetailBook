"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  serviceName: string;
  servicePrice: number;
  date: string;
  time: string;
  status: string;
  notes?: string;
  address?: string;
  depositPaid?: number;
}

interface StaffInfo {
  id: string;
  name: string;
  role: string;
  color: string;
  user: { businessName: string };
}

type TabType = "today" | "upcoming" | "history";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  completed: "Completed",
  in_progress: "In Progress",
  cancelled: "Cancelled",
};

export default function StaffDashboardPage() {
  const [staff, setStaff]       = useState<StaffInfo | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      fetch("/api/staff-auth/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/staff-bookings").then((r) => r.ok ? r.json() : []),
    ]).then(([meData, bookingsData]) => {
      if (meData) setStaff(meData.staff);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    }).finally(() => setLoading(false));
  }, []);

  const todayBookings    = bookings.filter((b) => b.date === today && b.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  const upcomingBookings = bookings.filter((b) => b.date > today && b.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const historyBookings  = bookings.filter((b) => b.date < today || b.status === "completed" || b.status === "cancelled").sort((a, b) => b.date.localeCompare(a.date));

  const completedCount     = bookings.filter((b) => b.status === "completed").length;
  const totalRevenue       = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.servicePrice, 0);
  const thisMonthRevenue   = bookings.filter((b) => b.status === "completed" && b.date.startsWith(today.slice(0, 7))).reduce((s, b) => s + b.servicePrice, 0);

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const formatDateFull = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const updateStatus = async (bookingId: string, status: string) => {
    try {
      const res = await fetch("/api/staff-bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status }),
      });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status } : b));
        if (selectedBooking?.id === bookingId) setSelectedBooking((prev) => prev ? { ...prev, status } : null);
      }
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading your schedule...</p>
      </div>
    );
  }

  // ── Booking Detail View ────────────────────────────────────────────────────
  if (selectedBooking) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedBooking(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                {formatDateFull(selectedBooking.date)} · {selectedBooking.time}
              </p>
              <h2 className="text-xl font-bold text-gray-900">{selectedBooking.customerName}</h2>
              <p className="text-gray-500 text-sm">{selectedBooking.serviceName}</p>
            </div>
            <StatusBadge status={selectedBooking.status} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Service Price</p>
              <p className="text-sm font-bold text-gray-800">${selectedBooking.servicePrice}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">Deposit Paid</p>
              <p className="text-sm font-bold text-gray-800">{selectedBooking.depositPaid ? `$${selectedBooking.depositPaid}` : "—"}</p>
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Vehicle</p>
          <p className="font-semibold text-gray-900">{selectedBooking.vehicleYear} {selectedBooking.vehicleMake} {selectedBooking.vehicleModel}</p>
          <p className="text-gray-500 text-sm">{selectedBooking.vehicleColor}</p>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Customer</p>
          <div className="space-y-2">
            <a href={`tel:${selectedBooking.customerPhone}`}
              className="flex items-center gap-3 py-2.5 px-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{selectedBooking.customerPhone}</span>
              <span className="ml-auto text-xs text-gray-400">Call</span>
            </a>
            {selectedBooking.customerEmail && (
              <a href={`mailto:${selectedBooking.customerEmail}`}
                className="flex items-center gap-3 py-2.5 px-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">{selectedBooking.customerEmail}</span>
                <span className="ml-auto text-xs text-gray-400">Email</span>
              </a>
            )}
            {selectedBooking.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedBooking.address)}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 py-2.5 px-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 truncate">{selectedBooking.address}</span>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">Directions</span>
              </a>
            )}
          </div>
        </div>

        {/* Notes */}
        {selectedBooking.notes && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-gray-600 text-sm leading-relaxed">{selectedBooking.notes}</p>
          </div>
        )}

        {/* Actions */}
        {selectedBooking.status !== "completed" && selectedBooking.status !== "cancelled" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Update Status</p>
            {selectedBooking.status !== "confirmed" && (
              <button onClick={() => updateStatus(selectedBooking.id, "confirmed")}
                className="w-full border border-gray-200 text-gray-700 text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">
                Mark as Confirmed
              </button>
            )}
            {selectedBooking.status !== "in_progress" && (
              <button onClick={() => updateStatus(selectedBooking.id, "in_progress")}
                className="w-full border border-gray-200 text-gray-700 text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">
                Start Job
              </button>
            )}
            <button onClick={() => updateStatus(selectedBooking.id, "completed")}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold py-3 rounded-xl transition-colors">
              Mark as Completed
            </button>
          </div>
        )}

        {selectedBooking.status === "completed" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-center gap-2 text-gray-600 text-sm font-semibold">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Job Completed
          </div>
        )}
      </div>
    );
  }

  // ── Main Dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}, {staff?.name.split(" ")[0]}
        </h1>
        <p className="text-gray-400 text-sm mt-0.5 capitalize">
          {staff?.role} · {staff?.user.businessName}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today", value: todayBookings.length },
          { label: "Completed", value: completedCount },
          { label: "This Month", value: `$${thisMonthRevenue.toLocaleString()}` },
          { label: "All-time", value: `$${totalRevenue.toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            { id: "today" as TabType, label: "Today", count: todayBookings.length },
            { id: "upcoming" as TabType, label: "Upcoming", count: upcomingBookings.length },
            { id: "history" as TabType, label: "History", count: historyBookings.length },
          ]).map(({ id, label, count }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                activeTab === id ? "text-gray-900 border-b-2 border-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}>
              {label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "today" && (
            todayBookings.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-2xl mb-2">🎉</p>
                <p className="font-semibold text-gray-700 text-sm">No jobs today</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(today)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} onOpen={() => setSelectedBooking(b)} onStatusUpdate={updateStatus} />
                ))}
              </div>
            )
          )}

          {activeTab === "upcoming" && (
            upcomingBookings.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-2xl mb-2">📭</p>
                <p className="font-semibold text-gray-700 text-sm">No upcoming bookings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} onOpen={() => setSelectedBooking(b)} onStatusUpdate={updateStatus} />
                ))}
              </div>
            )
          )}

          {activeTab === "history" && (
            historyBookings.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-2xl mb-2">📋</p>
                <p className="font-semibold text-gray-700 text-sm">No history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} onOpen={() => setSelectedBooking(b)} onStatusUpdate={updateStatus} compact />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/staff/bookings"
          className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">All Bookings</p>
            <p className="text-xs text-gray-400">Full list</p>
          </div>
        </Link>
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{staff?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{staff?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed:   "bg-gray-100 text-gray-600",
    pending:     "bg-gray-100 text-gray-600",
    completed:   "bg-gray-900 text-white",
    in_progress: "bg-gray-800 text-white",
    cancelled:   "bg-gray-100 text-gray-400 line-through",
  };
  return (
    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${styles[status] ?? "bg-gray-100 text-gray-500"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Booking Row ───────────────────────────────────────────────────────────────
function BookingRow({
  booking, onOpen, onStatusUpdate, compact = false,
}: {
  booking: Booking;
  onOpen: () => void;
  onStatusUpdate: (id: string, status: string) => void;
  compact?: boolean;
}) {
  const [updating, setUpdating] = useState(false);

  const handle = async (status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdating(true);
    await onStatusUpdate(booking.id, status);
    setUpdating(false);
  };

  if (compact) {
    return (
      <button onClick={onOpen}
        className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors">
        <div className="text-center w-9 flex-shrink-0">
          <p className="text-[10px] text-gray-400 font-medium leading-tight">
            {new Date(booking.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p className="text-base font-bold text-gray-700 leading-tight">{new Date(booking.date + "T00:00:00").getDate()}</p>
        </div>
        <div className="w-px h-7 bg-gray-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{booking.customerName}</p>
          <p className="text-xs text-gray-500">{booking.serviceName} · {booking.time}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-gray-700">${booking.servicePrice}</span>
          <StatusBadge status={booking.status} />
        </div>
      </button>
    );
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-900 text-sm">{booking.customerName}</p>
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-xs text-gray-500">{booking.serviceName} · {booking.time}</p>
            <p className="text-xs text-gray-400">{booking.vehicleYear} {booking.vehicleMake} {booking.vehicleModel}</p>
          </div>
          <p className="text-sm font-bold text-gray-800 flex-shrink-0">${booking.servicePrice}</p>
        </div>

        {booking.notes && (
          <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
            <span className="font-medium">Note: </span>{booking.notes}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button onClick={onOpen}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
            View Details
          </button>
          {booking.status !== "completed" && booking.status !== "cancelled" && (
            <>
              {booking.status !== "in_progress" && (
                <button onClick={(e) => handle("in_progress", e)} disabled={updating}
                  className="text-xs font-medium text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Start
                </button>
              )}
              <button onClick={(e) => handle("completed", e)} disabled={updating}
                className="text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                Complete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
