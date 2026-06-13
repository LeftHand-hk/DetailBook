"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseVcf } from "@/lib/vcf";

type CustomerRow = {
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
  totalBookings: number;
  totalSpent: number;
  lastBookingDate: string | null;
  lastService: string | null;
};

type SortKey = "name" | "bookings" | "spent" | "last";

const PAGE_SIZE = 20;

const emptyForm = {
  firstName: "", lastName: "", email: "", phone: "", notes: "",
  vehicleMake: "", vehicleModel: "", vehicleYear: "", vehicleColor: "",
};

function fullName(c: CustomerRow): string {
  return `${c.firstName}${c.lastName ? " " + c.lastName : ""}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function emit(name: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(name));
  }
}

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sort)   params.set("sort", sort);
      const r = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
      const data = r.ok ? await r.json() : [];
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchRows, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort]);

  const visible = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowAdd(true);
  };
  const openEdit = (c: CustomerRow) => {
    setEditing(c);
    setForm({
      firstName: c.firstName, lastName: c.lastName || "",
      email: c.email || "", phone: c.phone || "", notes: c.notes || "",
      vehicleMake: c.vehicleMake || "", vehicleModel: c.vehicleModel || "",
      vehicleYear: c.vehicleYear || "", vehicleColor: c.vehicleColor || "",
    });
    setError(null);
    setShowAdd(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!form.firstName.trim()) { setError("First name is required."); setSaving(false); return; }
    if (!form.email.trim() && !form.phone.trim()) { setError("Add an email or a phone number."); setSaving(false); return; }
    try {
      const url = editing ? `/api/customers/${editing.id}` : "/api/customers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Save failed"); setSaving(false); return; }
      setShowAdd(false);
      setForm(emptyForm);
      setEditing(null);
      await fetchRows();
      emit("detailbook:customers-changed");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/customers/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    await fetchRows();
    emit("detailbook:customers-changed");
  };

  const handleExport = () => {
    window.location.href = "/api/customers/export";
  };

  if (!loading && rows.length === 0 && !search) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Customers</h1>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">No customers yet</h2>
          <p className="text-sm text-gray-500 mb-5">Add your first customer or import a list.</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl">Add Customer</button>
            <button onClick={() => setShowImport(true)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold px-4 py-2.5 rounded-xl">Import CSV / VCF</button>
          </div>
        </div>
        {showAdd && <CustomerFormModal form={form} setForm={setForm} editing={editing} onClose={() => setShowAdd(false)} onSubmit={handleSave} saving={saving} error={error} />}
        {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { fetchRows(); emit("detailbook:customers-changed"); }} />}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{rows.length} customer{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openAdd} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Add Customer
          </button>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-2 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            Import CSV / VCF
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-2 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="search" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, email, or phone"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortKey); setPage(0); }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Sort: Name</option>
          <option value="bookings">Sort: Total bookings</option>
          <option value="spent">Sort: Total spent</option>
          <option value="last">Sort: Last booking</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">No customers match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500 tracking-wider">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 whitespace-nowrap">Bookings</th>
                  <th className="px-4 py-3 whitespace-nowrap">Total Spent</th>
                  <th className="px-4 py-3 whitespace-nowrap">Last Booking</th>
                  <th className="px-4 py-3 whitespace-nowrap">Last Service</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      <Link href={`/dashboard/customers/${c.id}`} className="hover:text-blue-600">
                        {fullName(c)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{c.totalBookings}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">${c.totalSpent.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(c.lastBookingDate)}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={c.lastService || ""}>{c.lastService || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Link href={`/dashboard/customers/${c.id}`} title="View" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </Link>
                        <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteId(c.id)} title="Delete" className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}

      {showAdd && <CustomerFormModal form={form} setForm={setForm} editing={editing} onClose={() => setShowAdd(false)} onSubmit={handleSave} saving={saving} error={error} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { fetchRows(); emit("detailbook:customers-changed"); }} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-2">Delete this customer?</h3>
            <p className="text-sm text-gray-500 mb-5">Their bookings stay — the link to this customer record is just removed.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerFormModal({
  form, setForm, editing, onClose, onSubmit, saving, error,
}: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  editing: CustomerRow | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="min-h-screen flex items-start sm:items-center justify-center p-4">
        <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-extrabold text-gray-900">{editing ? "Edit customer" : "Add customer"}</h2>
            <button type="button" onClick={() => !saving && onClose()} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">First name *</label>
                <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
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
            <p className="text-[11px] text-gray-400 -mt-2">Email or phone — at least one.</p>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" placeholder="e.g. prefers interior only, has a Tesla" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Vehicle (optional)</label>
              <div className="grid grid-cols-2 gap-2.5">
                <input value={form.vehicleMake} onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })} placeholder="Make" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} placeholder="Model" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input value={form.vehicleYear} onChange={(e) => setForm({ ...form, vehicleYear: e.target.value })} placeholder="Year" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input value={form.vehicleColor} onChange={(e) => setForm({ ...form, vehicleColor: e.target.value })} placeholder="Color" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button type="button" onClick={() => !saving && onClose()} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">{saving ? "Saving…" : editing ? "Save changes" : "Add customer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ParsedCSV = { headers: string[]; rows: string[][] };

function parseCsv(text: string): ParsedCSV {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || row.length) { row.push(field); rows.push(row); }
        row = []; field = "";
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1).filter((r) => r.some((c) => (c || "").trim() !== "")) };
}

// Score each column for "looks like email/phone/name" using BOTH the
// header keyword (in 4+ languages) AND the actual cell content. Lets a
// detailer drop in any CSV — Square exports, contacts dumps, even a
// no-header dump of "Name, Phone" — without renaming columns first.
function scoreColumn(header: string, samples: string[]) {
  const h = (header || "").trim().toLowerCase();
  const filled = samples.map((s) => (s || "").trim()).filter(Boolean);
  const n = Math.max(1, filled.length);
  const hit = (...keys: string[]) => keys.some((k) => h.includes(k));

  const emailHeader = hit("email", "e-mail", "mail", "correo", "posta");
  const emailContent = filled.filter((s) => s.includes("@") && s.includes(".")).length / n;

  const phoneHeader = hit("phone", "mobile", "tel", "cell", "number", "celular", "movil", "kontakt");
  const phoneContent = filled.filter((s) => /^[+\d][\d\s\-().]{5,}$/.test(s)).length / n;

  const firstHeader = hit("first", "given", "fname", "fore", "emri");
  const lastHeader  = hit("last", "surname", "family", "lname", "mbiemr");
  const fullHeader  = hit("name", "full", "client", "customer", "nom", "nombre");
  const alphaContent = filled.filter((s) => /^[A-Za-zÀ-ÿ' \-.]+$/.test(s)).length / n;
  const spaceContent = filled.filter((s) => /\s/.test(s)).length / n;

  return {
    email: (emailHeader ? 0.6 : 0) + emailContent,
    phone: (phoneHeader ? 0.6 : 0) + phoneContent,
    firstName: (firstHeader ? 0.9 : 0) + (alphaContent * 0.5),
    lastName:  (lastHeader  ? 0.9 : 0) + (alphaContent * 0.3),
    fullName:  (fullHeader && !firstHeader && !lastHeader ? 0.8 : 0) + alphaContent * 0.4 + spaceContent * 0.4,
  };
}

function autoMap(headers: string[], sampleRows: string[][] = []) {
  const samples = headers.map((_, i) => sampleRows.slice(0, 10).map((r) => r[i] || ""));
  const scores = headers.map((h, i) => scoreColumn(h, samples[i]));

  const argmax = (key: keyof ReturnType<typeof scoreColumn>, threshold: number, exclude: number[]) => {
    let bestIdx = -1; let bestScore = threshold;
    scores.forEach((sc, i) => {
      if (exclude.includes(i)) return;
      if (sc[key] > bestScore) { bestScore = sc[key]; bestIdx = i; }
    });
    return bestIdx;
  };

  const email = argmax("email", 0.4, []);
  const phone = argmax("phone", 0.4, [email].filter((i) => i >= 0));

  // Prefer a separate Last name column when one clearly exists, otherwise
  // pick a single combined "Full Name" column and let the server split it.
  const lastName = argmax("lastName", 0.7, [email, phone].filter((i) => i >= 0));
  let firstName = -1;
  if (lastName >= 0) {
    firstName = argmax("firstName", 0.4, [email, phone, lastName]);
  } else {
    firstName = argmax("fullName", 0.4, [email, phone].filter((i) => i >= 0));
    if (firstName < 0) firstName = argmax("firstName", 0.3, [email, phone].filter((i) => i >= 0));
  }

  return { firstName, lastName, email, phone };
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsed, setParsed] = useState<ParsedCSV | null>(null);
  const [mapping, setMapping] = useState({ firstName: -1, lastName: -1, email: -1, phone: -1 });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    const name = file.name.toLowerCase();
    const isVcf = name.endsWith(".vcf") || file.type === "text/vcard" || file.type === "text/x-vcard";
    const isCsv = name.endsWith(".csv") || file.type === "text/csv";
    if (!isVcf && !isCsv) {
      setError("Please upload a .csv or .vcf file.");
      return;
    }
    const text = await file.text();
    if (isVcf) {
      const contacts = parseVcf(text);
      if (contacts.length === 0) { setError("No contacts found in that .vcf file."); return; }
      const p: ParsedCSV = {
        headers: ["First Name", "Last Name", "Email", "Phone"],
        rows: contacts.map((c) => [c.firstName, c.lastName, c.email, c.phone]),
      };
      setParsed(p);
      setMapping({ firstName: 0, lastName: 1, email: 2, phone: 3 });
      setStep("preview");
      return;
    }
    const p = parseCsv(text);
    if (p.headers.length === 0) { setError("That file is empty."); return; }
    setParsed(p);
    setMapping(autoMap(p.headers, p.rows));
    setStep("preview");
  };

  const sampleCsv = `Name,Email,Phone\nMike Anderson,mike@example.com,+15551234567\nSarah Johnson,sarah@example.com,+15552345678`;

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "customers-sample.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      const rows = parsed.rows.map((cells) => {
        const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : "");
        const rawFirst = get(mapping.firstName);
        let firstName = rawFirst;
        let lastName = get(mapping.lastName);
        if (rawFirst && !lastName && mapping.lastName < 0 && rawFirst.trim().includes(" ")) {
          const parts = rawFirst.trim().split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(" ");
        }
        return { firstName, lastName, email: get(mapping.email), phone: get(mapping.phone) };
      });
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Import failed"); setImporting(false); return; }
      setResult({ imported: data.imported || 0, skipped: data.skipped || 0 });
      setStep("done");
    } catch {
      setError("Network error.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto" onClick={() => !importing && onClose()}>
      <div className="min-h-screen flex items-start sm:items-center justify-center p-4">
        <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-extrabold text-gray-900">Import customers from CSV or VCF</h2>
            <button type="button" onClick={() => !importing && onClose()} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
          </div>
          <div className="px-6 py-5">
            {step === "upload" && (
              <>
                <label className="block w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/40 rounded-2xl p-10 text-center cursor-pointer transition-colors">
                  <input type="file" accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm font-bold text-gray-900">Click to upload a CSV or VCF</p>
                  <p className="text-xs text-gray-500 mt-1">CSV columns: Name, Email, Phone — or drop a phone-contacts .vcf</p>
                </label>
                <div className="mt-4 text-center">
                  <button type="button" onClick={downloadSample} className="text-xs font-semibold text-blue-600 hover:underline">Download sample CSV</button>
                </div>
                {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              </>
            )}

            {step === "preview" && parsed && (
              <>
                <p className="text-sm text-gray-600 mb-3"><strong>{parsed.rows.length}</strong> customer{parsed.rows.length === 1 ? "" : "s"} found in the file. Map the columns below:</p>
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  {(["firstName", "lastName", "email", "phone"] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        {field === "firstName" ? "Name (or first name)" : field === "lastName" ? "Last name" : field === "email" ? "Email" : "Phone"}
                      </label>
                      <select
                        value={mapping[field]}
                        onChange={(e) => setMapping({ ...mapping, [field]: parseInt(e.target.value, 10) })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                      >
                        <option value={-1}>— Skip —</option>
                        {parsed.headers.map((h, i) => (<option key={i} value={i}>{h || `Column ${i + 1}`}</option>))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>{parsed.headers.map((h, i) => (<th key={i} className="px-3 py-2 text-left">{h || `Col ${i + 1}`}</th>))}</tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 5).map((r, ri) => (
                        <tr key={ri} className="border-t border-gray-100">
                          {parsed.headers.map((_, ci) => (<td key={ci} className="px-3 py-2 text-gray-700">{r[ci] || ""}</td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              </>
            )}

            {step === "done" && result && (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-extrabold text-gray-900">{result.imported} customer{result.imported === 1 ? "" : "s"} imported</h3>
                {result.skipped > 0 && <p className="text-sm text-gray-500 mt-1">{result.skipped} duplicate{result.skipped === 1 ? "" : "s"} skipped.</p>}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            {step === "upload" && (
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl">Cancel</button>
            )}
            {step === "preview" && (
              <>
                <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl">Back</button>
                <button onClick={handleImport} disabled={importing || mapping.firstName < 0} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
                  {importing ? "Importing…" : `Import ${parsed?.rows.length ?? 0} customers`}
                </button>
              </>
            )}
            {step === "done" && (
              <button onClick={() => { onImported(); onClose(); }} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl">Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
