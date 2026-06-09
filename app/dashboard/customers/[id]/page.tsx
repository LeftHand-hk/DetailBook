"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Customer = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  vehicleColor: string | null;
  createdAt: string;
};

type Booking = {
  id: string;
  date: string;
  time: string;
  serviceName: string;
  servicePrice: number;
  addonsTotal: number;
  status: string;
};

const STATUS_PILL: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700 border border-green-200",
  pending:   "bg-yellow-100 text-yellow-700 border border-yellow-200",
  completed: "bg-blue-100 text-blue-700 border border-blue-200",
  cancelled: "bg-red-100 text-red-700 border border-red-200",
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/customers/${id}`, { cache: "no-store" });
      if (!r.ok) { setLoading(false); return; }
      const data = await r.json();
      setCustomer(data.customer);
      setBookings(data.bookings || []);
      setTotalSpent(data.totalSpent || 0);
      setForm({
        firstName: data.customer.firstName,
        lastName:  data.customer.lastName || "",
        email:     data.customer.email || "",
        phone:     data.customer.phone || "",
        notes:     data.customer.notes || "",
        vehicleMake:  data.customer.vehicleMake || "",
        vehicleModel: data.customer.vehicleModel || "",
        vehicleYear:  data.customer.vehicleYear || "",
        vehicleColor: data.customer.vehicleColor || "",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Save failed"); setSaving(false); return; }
      setEditing(false);
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const createBookingFor = () => {
    if (!customer) return;
    // Pass customer info via query so the bookings page can pre-fill the
    // Add-booking modal. The bookings page reads ?prefillCustomerId=...
    const qs = new URLSearchParams({
      prefillCustomerId: customer.id,
      prefillName: `${customer.firstName}${customer.lastName ? " " + customer.lastName : ""}`,
      prefillEmail: customer.email || "",
      prefillPhone: customer.phone || "",
      prefillVMake: customer.vehicleMake || "",
      prefillVModel: customer.vehicleModel || "",
      prefillVYear: customer.vehicleYear || "",
      prefillVColor: customer.vehicleColor || "",
    });
    router.push(`/dashboard/bookings?${qs.toString()}`);
  };

  if (loading) return <div className="p-6 max-w-4xl mx-auto text-sm text-gray-400">Loading…</div>;
  if (!customer) return <div className="p-6 max-w-4xl mx-auto text-sm text-gray-500">Customer not found. <Link href="/dashboard/customers" className="text-blue-600 underline">Back</Link></div>;

  const upcomingBookings = bookings.filter((b) => b.status !== "completed" && b.status !== "cancelled");
  const pastBookings     = bookings.filter((b) => b.status === "completed" || b.status === "cancelled");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <Link href="/dashboard/customers" className="text-xs font-semibold text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          All customers
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-gray-900 truncate">{customer.firstName}{customer.lastName ? ` ${customer.lastName}` : ""}</h1>
          <p className="text-sm text-gray-500">Customer since {new Date(customer.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={createBookingFor} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Create Booking
          </button>
          {!editing && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-2 rounded-xl">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total bookings</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{bookings.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Upcoming</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{upcomingBookings.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total spent</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">${totalSpent.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <h2 className="text-base font-extrabold text-gray-900 mb-4">Contact & vehicle</h2>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">First name</label>
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Last name</label>
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.vehicleMake} onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })} placeholder="Make" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} placeholder="Model" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={form.vehicleYear} onChange={(e) => setForm({ ...form, vehicleYear: e.target.value })} placeholder="Year" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input value={form.vehicleColor} onChange={(e) => setForm({ ...form, vehicleColor: e.target.value })} placeholder="Color" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setEditing(false); setError(null); load(); }} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            <div><span className="text-gray-500">Email:</span> <span className="text-gray-900 font-semibold">{customer.email || "—"}</span></div>
            <div><span className="text-gray-500">Phone:</span> <span className="text-gray-900 font-semibold">{customer.phone || "—"}</span></div>
            <div className="sm:col-span-2"><span className="text-gray-500">Notes:</span> <span className="text-gray-900">{customer.notes || "—"}</span></div>
            <div className="sm:col-span-2 pt-2 border-t border-gray-100 mt-2 text-gray-700">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Vehicle</p>
              {(customer.vehicleMake || customer.vehicleModel || customer.vehicleYear || customer.vehicleColor)
                ? `${customer.vehicleYear || ""} ${customer.vehicleMake || ""} ${customer.vehicleModel || ""}${customer.vehicleColor ? ` (${customer.vehicleColor})` : ""}`.trim()
                : "—"}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-base font-extrabold text-gray-900 mb-4">Booking history</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">No bookings yet.</p>
        ) : (
          <div className="space-y-2.5">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{b.serviceName}</p>
                  <p className="text-xs text-gray-500">{b.date} · {b.time}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-bold text-gray-900">${(b.servicePrice + (b.addonsTotal || 0)).toLocaleString()}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_PILL[b.status] || "bg-gray-100 text-gray-600 border border-gray-200"}`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
