"use client";

import { useEffect, useState } from "react";

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
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
}

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

type Filter = "upcoming" | "completed" | "all";

export default function StaffBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [updating, setUpdating] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/staff-bookings")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    if (filter === "upcoming") return b.date >= today && b.status !== "cancelled" && b.status !== "completed";
    if (filter === "completed") return b.status === "completed";
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const updateStatus = async (bookingId: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/staff-bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status }),
      });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status } : b));
        if (selected?.id === bookingId) setSelected({ ...selected, status });
      }
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const counts = {
    upcoming: bookings.filter((b) => b.date >= today && b.status !== "cancelled" && b.status !== "completed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    all: bookings.length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <svg className="animate-spin w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Bookings</h1>

      {/* Filters */}
      <div className="flex gap-2">
        {(["upcoming", "completed", "all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold capitalize transition-all ${
              filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}>
            {f}
            <span className={`text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ${
              filter === f ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
            }`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12">
          <p className="text-2xl mb-2">📋</p>
          <p className="font-semibold text-gray-700">No bookings here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <div key={booking.id} onClick={() => setSelected(booking)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-blue-200 transition-all active:scale-[0.99]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-gray-900">{booking.customerName}</p>
                  <p className="text-xs text-gray-500">{booking.serviceName}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg capitalize flex-shrink-0 ${statusColors[booking.status]}`}>
                  {booking.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {formatDate(booking.date)}
                </span>
                <span>·</span>
                <span>{booking.time}</span>
                <span>·</span>
                <span>{booking.vehicleYear} {booking.vehicleMake}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelected(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selected.customerName}</h2>
                  <p className="text-sm text-gray-500">{selected.serviceName} · ${selected.servicePrice}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${statusColors[selected.status]}`}>
                  {selected.status.replace("_", " ")}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Date & Time</p>
                  <p className="font-bold text-gray-900">{formatDate(selected.date)}</p>
                  <p className="text-gray-600">{selected.time}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-semibold mb-1">Vehicle</p>
                  <p className="font-bold text-gray-900">{selected.vehicleYear} {selected.vehicleMake}</p>
                  <p className="text-gray-600">{selected.vehicleModel} · {selected.vehicleColor}</p>
                </div>
              </div>

              {/* Contact */}
              <div className="flex gap-2">
                <a href={`tel:${selected.customerPhone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 font-semibold text-sm py-3 rounded-xl hover:bg-green-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Customer
                </a>
                {selected.address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 font-semibold text-sm py-3 rounded-xl hover:bg-blue-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Directions
                  </a>
                )}
              </div>

              {selected.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
                  <span className="font-semibold">Customer note: </span>{selected.notes}
                </div>
              )}

              {/* Actions */}
              {selected.status !== "completed" && selected.status !== "cancelled" && (
                <div className="space-y-2">
                  {selected.status !== "in_progress" && (
                    <button onClick={() => updateStatus(selected.id, "in_progress")} disabled={updating}
                      className="w-full font-bold text-white bg-purple-600 hover:bg-purple-700 py-3 rounded-xl transition-colors disabled:opacity-50">
                      Start Job
                    </button>
                  )}
                  <button onClick={() => updateStatus(selected.id, "completed")} disabled={updating}
                    className="w-full font-bold text-white bg-blue-600 hover:bg-blue-700 py-3 rounded-xl transition-colors disabled:opacity-50">
                    Mark as Completed
                  </button>
                </div>
              )}

              <button onClick={() => setSelected(null)}
                className="w-full font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 py-3 rounded-xl transition-colors text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
