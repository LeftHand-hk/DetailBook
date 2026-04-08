"use client";

import { useState, useEffect } from "react";

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

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusDot: Record<string, string> = {
  confirmed: "bg-green-500",
  pending: "bg-yellow-500",
  completed: "bg-blue-500",
  in_progress: "bg-purple-500",
  cancelled: "bg-red-400",
};

const statusChip: Record<string, string> = {
  confirmed: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  completed: "Completed",
  in_progress: "In Progress",
  cancelled: "Cancelled",
};

function formatTimeShort(time: string): string {
  if (!time) return "";
  const ampm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) return `${parseInt(ampm[1])}${ampm[3].toUpperCase()}`;
  const h24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    let h = parseInt(h24[1]);
    const s = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12; else if (h > 12) h -= 12;
    return `${h}${s}`;
  }
  return time;
}

export default function StaffCalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showDaySheet, setShowDaySheet] = useState(false);

  useEffect(() => {
    fetch("/api/staff-bookings")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
    setSelectedDay(new Date().toISOString().split("T")[0]);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().split("T")[0];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const getBookingsForDate = (dateStr: string) =>
    bookings.filter((b) => b.date === dateStr);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.toISOString().split("T")[0]);
  };

  const selectDay = (date: string | null) => {
    if (!date) return;
    setSelectedDay(date);
    setShowDaySheet(true);
  };

  const selectedBookings = selectedDay ? getBookingsForDate(selectedDay) : [];

  const formatDayFull = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const formatDayShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const isToday = (dateStr: string | null) => dateStr === today;

  // Build calendar grid
  const calendarDays: { date: string | null; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    calendarDays.push({ date: new Date(year, month - 1, d).toISOString().split("T")[0], day: d, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ date: new Date(year, month, d).toISOString().split("T")[0], day: d, isCurrentMonth: true });
  }
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    calendarDays.push({ date: new Date(year, month + 1, d).toISOString().split("T")[0], day: d, isCurrentMonth: false });
  }

  // Stats
  const monthBookings = bookings.filter((b) =>
    b.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
  );
  const monthPending = monthBookings.filter((b) => b.status === "pending").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-400 text-sm">Your schedule at a glance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            {monthBookings.length} this month
          </div>
          {monthPending > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              {monthPending} pending
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Calendar Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={goToToday}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              {MONTHS[month]} {year}
            </h2>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
            {DAYS_SHORT.map((d, i) => (
              <div key={i} className="py-2.5 text-center text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span className="sm:hidden">{d}</span>
                <span className="hidden sm:inline">{DAYS_FULL[i]}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, i) => {
              const dayBookings = cell.date ? getBookingsForDate(cell.date) : [];
              const count = dayBookings.length;
              const isTodayCell = cell.date === today;
              const isSelected = cell.date === selectedDay;
              const hasBookings = count > 0 && cell.isCurrentMonth;

              return (
                <button
                  key={i}
                  onClick={() => selectDay(cell.date)}
                  className={`relative min-h-[52px] sm:min-h-[90px] p-1 sm:p-2 border-b border-r border-gray-50 text-left transition-all duration-150 ${
                    !cell.isCurrentMonth ? "opacity-25" : "hover:bg-blue-50/50"
                  } ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : ""}`}
                >
                  <div className="flex items-center justify-center sm:justify-start">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                      isTodayCell
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                        : isSelected
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700"
                    }`}>
                      {cell.day}
                    </span>
                  </div>

                  {/* Mobile: dots */}
                  {hasBookings && (
                    <div className="sm:hidden flex items-center justify-center gap-0.5 mt-0.5">
                      {dayBookings.slice(0, 3).map((b, j) => (
                        <span key={j} className={`w-1.5 h-1.5 rounded-full ${statusDot[b.status]}`} />
                      ))}
                      {count > 3 && <span className="text-[8px] text-gray-400 ml-0.5">+{count - 3}</span>}
                    </div>
                  )}

                  {/* Desktop: booking chips */}
                  <div className="hidden sm:block mt-1 space-y-0.5">
                    {dayBookings.slice(0, 2).map((b, j) => (
                      <div key={j} className={`flex items-center gap-1 text-[10px] rounded px-1 py-0.5 truncate ${
                        b.status === "confirmed" ? "bg-green-100 text-green-700" :
                        b.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        b.status === "completed" ? "bg-blue-100 text-blue-700" :
                        b.status === "in_progress" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[b.status]}`} />
                        <span className="truncate">{formatTimeShort(b.time)} {b.customerName.split(" ")[0]}</span>
                      </div>
                    ))}
                    {count > 2 && (
                      <p className="text-[10px] text-blue-500 font-semibold pl-1">+{count - 2} more</p>
                    )}
                  </div>

                  {/* Count badge (mobile) */}
                  {hasBookings && (
                    <span className="sm:hidden absolute top-0.5 right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9px] font-bold px-1">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend (desktop) */}
          <div className="hidden sm:flex items-center gap-4 px-6 py-3 border-t border-gray-100 bg-gray-50/50">
            {Object.entries(statusDot).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-[11px] text-gray-500 capitalize font-medium">{status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day Detail Panel (Desktop) */}
        <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm h-fit sticky top-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">
                {selectedDay ? formatDayFull(selectedDay) : "Select a day"}
              </h3>
              {selectedDay === today && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">TODAY</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedBookings.length === 0 ? "No bookings" : `${selectedBookings.length} booking${selectedBookings.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="p-4">
            {selectedBookings.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">No bookings</p>
                {selectedDay === today && <p className="text-blue-500 text-xs mt-1 font-medium">Today is free!</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedBookings.sort((a, b) => a.time.localeCompare(b.time)).map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </div>
          <div className="px-5 pb-5">
            <div className="border-t border-gray-100 pt-3">
              <div className="flex flex-wrap gap-3">
                {Object.entries(statusDot).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-[11px] text-gray-500 capitalize">{status.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      {showDaySheet && selectedDay && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowDaySheet(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{formatDayShort(selectedDay)}</h3>
                <p className="text-xs text-gray-500">
                  {selectedBookings.length === 0 ? "No bookings" : `${selectedBookings.length} booking${selectedBookings.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isToday(selectedDay) && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">TODAY</span>
                )}
                <button onClick={() => setShowDaySheet(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {selectedBookings.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No bookings on this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedBookings.sort((a, b) => a.time.localeCompare(b.time)).map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50">
              {Object.entries(statusDot).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] text-gray-500 capitalize">{status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-gray-200 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1">
            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-bold text-gray-700">{booking.time}</span>
          </div>
        </div>
        <span className={`text-[10px] font-bold capitalize px-2 py-0.5 rounded-full border ${statusChip[booking.status]}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusDot[booking.status]}`} />
          {STATUS_LABEL[booking.status] ?? booking.status}
        </span>
      </div>

      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600 font-bold text-[10px]">
            {booking.customerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{booking.customerName}</p>
          <p className="text-xs text-gray-500 truncate">{booking.serviceName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
        <span>{booking.vehicleYear} {booking.vehicleMake} {booking.vehicleModel}</span>
        <div className="flex items-center gap-2">
          {booking.depositPaid && booking.depositPaid > 0 && (
            <span className="text-green-600 font-medium">${booking.depositPaid} dep.</span>
          )}
          <span className="font-bold text-gray-900">${booking.servicePrice}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50">
        {booking.customerPhone && (
          <a href={`tel:${booking.customerPhone}`} className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {booking.customerPhone}
          </a>
        )}
        {booking.customerEmail && (
          <a href={`mailto:${booking.customerEmail}`} className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 transition-colors truncate">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{booking.customerEmail}</span>
          </a>
        )}
      </div>
    </div>
  );
}
