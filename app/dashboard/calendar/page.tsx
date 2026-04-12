"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getBookings, getUser } from "@/lib/storage";
import type { Booking } from "@/types";
import DashboardHelp from "@/components/DashboardHelp";

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
  cancelled: "bg-red-400",
};

const statusBadge: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusChip: Record<string, string> = {
  confirmed: "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
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

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showDaySheet, setShowDaySheet] = useState(false);

  useEffect(() => {
    setBookings(getBookings());
    setSelectedDay(new Date().toISOString().split("T")[0]);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date().toISOString().split("T")[0];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const getBookingsForDate = (dateStr: string) => bookings.filter((b) => b.date === dateStr);

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
  const monthBookings = bookings.filter(b => b.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));
  const monthConfirmed = monthBookings.filter(b => b.status === "confirmed").length;
  const monthPending = monthBookings.filter(b => b.status === "pending").length;
  const monthCompleted = monthBookings.filter(b => b.status === "completed").length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Calendar</h1>
          <p className="text-gray-500 text-sm">View and manage your schedule</p>
        </div>
        {/* Month stats pills */}
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
        {/* ── Calendar Card ── */}
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
                  {/* Day number */}
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

                  {/* Mobile: dots only */}
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
                        b.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
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
                <span className="text-[11px] text-gray-500 capitalize font-medium">{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Day Detail Panel (Desktop) ── */}
        <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm h-fit sticky top-6">
          <DayPanel
            selectedDay={selectedDay}
            selectedBookings={selectedBookings}
            today={today}
            formatDayFull={formatDayFull}
            statusBadge={statusBadge}
            statusChip={statusChip}
            statusDot={statusDot}
          />
        </div>
      </div>

      {/* ── Mobile Bottom Sheet ── */}
      {showDaySheet && selectedDay && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowDaySheet(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
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

            {/* Bookings list */}
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
                    <BookingCard key={booking.id} booking={booking} statusChip={statusChip} statusDot={statusDot} />
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50">
              {Object.entries(statusDot).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] text-gray-500 capitalize">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Google Calendar Integration ── */}
      <div className="mt-5">
        <Suspense fallback={null}>
          <GoogleCalendarSection userPlan={getUser()?.plan} />
        </Suspense>
      </div>

      <DashboardHelp page="calendar" />
    </div>
  );
}

function GoogleCalendarSection({ userPlan }: { userPlan?: string }) {
  const [status, setStatus] = useState<{ connected: boolean; calendarId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();
  const gcalParam = searchParams.get("gcal");
  const isPro = userPlan === "pro";

  useEffect(() => {
    fetch("/api/google-calendar/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data); })
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = () => { window.location.href = "/api/google-calendar/connect"; };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (res.ok) setStatus({ connected: false });
    } catch { /* silent */ }
    setDisconnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(data);
      }
    } catch { /* silent */ }
    setSyncing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-white font-bold text-base">Google Calendar</h2>
      </div>
      <div className="p-5">
        {gcalParam === "success" && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Google Calendar connected successfully!
          </div>
        )}
        {gcalParam === "error" && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-3 rounded-xl">
            Failed to connect Google Calendar. Please try again.
          </div>
        )}

        <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="4" fill="#4285F4" />
                <path d="M12 6.5C13.93 6.5 15.5 7.57 16.28 9.15L18.2 7.23C16.87 5.56 14.57 4.5 12 4.5C8.24 4.5 5.07 6.78 3.69 10L5.96 11.78C6.63 9.33 9.11 7.5 12 7.5V6.5Z" fill="#EA4335" />
                <path d="M18.64 12.2C18.64 11.57 18.58 10.97 18.46 10.4H12V13.7H15.73C15.33 14.9 14.39 15.86 13.14 16.38V18.62H15.97C17.66 17.07 18.64 14.83 18.64 12.2Z" fill="#4285F4" />
                <path d="M12 20.5C14.97 20.5 17.46 19.54 18.97 17.8L16.14 15.56C15.37 16.09 14.29 16.5 12 16.5C9.11 16.5 6.63 14.67 5.96 12.22L3.69 14C5.07 17.22 8.24 19.5 12 19.5V20.5Z" fill="#34A853" />
                <path d="M3.69 14L5.96 12.22C5.84 11.65 5.78 11.05 5.78 10.4C5.78 9.75 5.84 9.15 5.96 8.58L3.69 10C3.35 10.75 3.14 11.55 3.14 12.4C3.14 13.25 3.35 14.05 3.69 14Z" fill="#FBBC04" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">Google Calendar</p>
                {!isPro && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Pro</span>
                )}
                {status?.connected && (
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Connected</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {status?.connected
                  ? `Syncing to: ${status.calendarId || "Primary calendar"}`
                  : "Sync your bookings to Google Calendar automatically."}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin flex-shrink-0 mt-1" />
          ) : !isPro ? (
            <a href="/dashboard/billing"
              className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Upgrade
            </a>
          ) : status?.connected ? (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleSync} disabled={syncing}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="text-xs font-bold text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                {disconnecting ? "..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <button onClick={handleConnect}
              className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Connect
            </button>
          )}
        </div>

        {syncResult && (
          <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            Sync complete: <strong>{syncResult.synced}</strong> bookings synced
            {syncResult.errors > 0 && <span className="text-red-500">, {syncResult.errors} errors</span>}.
          </div>
        )}
      </div>
    </div>
  );
}

function DayPanel({
  selectedDay, selectedBookings, today, formatDayFull, statusBadge, statusChip, statusDot,
}: {
  selectedDay: string | null; selectedBookings: Booking[]; today: string;
  formatDayFull: (s: string) => string;
  statusBadge: Record<string, string>; statusChip: Record<string, string>; statusDot: Record<string, string>;
}) {
  return (
    <>
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
              <BookingCard key={booking.id} booking={booking} statusChip={statusChip} statusDot={statusDot} />
            ))}
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="px-5 pb-5">
        <div className="border-t border-gray-100 pt-3">
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusDot).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-[11px] text-gray-500 capitalize">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function BookingCard({ booking, statusChip, statusDot }: { booking: Booking; statusChip: Record<string, string>; statusDot: Record<string, string> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 hover:border-gray-200 hover:shadow-sm transition-all">
      {/* Time + Status row */}
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
          {booking.status}
        </span>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600 font-bold text-[10px]">{booking.customerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{booking.customerName}</p>
          <p className="text-xs text-gray-500 truncate">{booking.serviceName}</p>
        </div>
      </div>

      {/* Vehicle + Price */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
        <span>{booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}</span>
        <div className="flex items-center gap-2">
          {booking.depositPaid > 0 && (
            <span className="text-green-600 font-medium">${booking.depositPaid} dep.</span>
          )}
          <span className="font-bold text-gray-900">${booking.servicePrice}</span>
        </div>
      </div>

      {/* Contact */}
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
