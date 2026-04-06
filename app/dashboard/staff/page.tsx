"use client";

import { useState, useEffect } from "react";
import { getUser } from "@/lib/storage";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  color: string;
  active: boolean;
  passwordSet: boolean;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
  bookingsThisMonth: number;
  createdAt: string;
}

const ROLE_OPTIONS = ["detailer", "manager", "receptionist", "apprentice"];
const COLOR_OPTIONS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];
const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);
const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

export default function StaffPage() {
  const user = getUser();
  const isPro = user?.plan === "pro";

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPasswordFor, setShowPasswordFor] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const emptyForm = { name: "", email: "", phone: "", role: "detailer", color: "#3B82F6", password: "" };
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!isPro) { setLoading(false); return; }
    fetchStaff();
  }, [isPro]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff");
      if (res.ok) setStaff(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setForm({ name: m.name, email: m.email, phone: m.phone || "", role: m.role, color: m.color, password: "" });
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError("Name and email are required."); return; }
    if (!editingId && !form.password) { setError("Password is required for new staff."); return; }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/staff/${editingId}` : "/api/staff";
      const method = editingId ? "PUT" : "POST";
      const body: Record<string, string> = { name: form.name, email: form.email, phone: form.phone, role: form.role, color: form.color };
      if (form.password) body.password = form.password;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setError((await res.json()).error || "Something went wrong."); return; }
      setShowForm(false);
      setSuccess(editingId ? "Staff member updated." : "Staff member added.");
      setTimeout(() => setSuccess(""), 3000);
      fetchStaff();
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (id: string) => {
    if (!newPassword.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/staff/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPassword }) });
      setShowPasswordFor(null);
      setNewPassword("");
      setSuccess("Password updated.");
      setTimeout(() => setSuccess(""), 3000);
      fetchStaff();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: StaffMember) => {
    await fetch(`/api/staff/${m.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !m.active }) });
    setStaff((prev) => prev.map((s) => s.id === m.id ? { ...s, active: !s.active } : s));
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/staff/${id}`, { method: "DELETE" });
    setStaff((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirm(null);
    setSuccess("Staff member removed.");
    setTimeout(() => setSuccess(""), 3000);
  };

  // Pro gate
  if (!isPro) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Staff Management</h2>
          <p className="text-gray-500 text-sm mb-6">Add your team, give them their own login, and track their performance — Pro only.</p>
          <a href="/dashboard/billing" className="inline-flex items-center gap-2 bg-gray-800 text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-700 transition-all">
            Upgrade to Pro — $50/mo
          </a>
        </div>
      </div>
    );
  }

  const totalRevenue = staff.reduce((s, m) => s + m.totalRevenue, 0);
  const totalCompleted = staff.reduce((s, m) => s + m.completedBookings, 0);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500">{staff.length} team member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-gray-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-gray-700 transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Add Staff
        </button>
      </div>

      {/* Staff login link */}
      <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          Staff login portal:
          <span className="font-bold text-gray-700">{typeof window !== "undefined" ? window.location.origin : ""}/staff/login</span>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/staff/login`); setSuccess("Link copied!"); setTimeout(() => setSuccess(""), 2000); }}
          className="text-xs font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
          Copy Link
        </button>
      </div>

      {success && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          {success}
        </div>
      )}

      {/* Team stats */}
      {staff.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{staff.filter(s => s.active).length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active Staff</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalCompleted}</p>
            <p className="text-xs text-gray-500 mt-0.5">Jobs Done</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Team Revenue</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No staff yet</h3>
          <p className="text-sm text-gray-500 mb-5">Add your first team member to start managing your crew.</p>
          <button onClick={openAdd} className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Add First Staff Member
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${!member.active ? "opacity-60" : ""}`}>
              <div className="h-1" style={{ backgroundColor: member.color }} />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar + info */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: member.color }}>
                    {getInitials(member.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{member.name}</p>
                      {!member.active && <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded uppercase">Inactive</span>}
                      {!member.passwordSet && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          No password
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{roleLabel(member.role)} · {member.email}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    { label: "This Month", value: member.bookingsThisMonth },
                    { label: "Total Jobs", value: member.totalBookings },
                    { label: "Completed", value: member.completedBookings },
                    { label: "Revenue", value: `$${member.totalRevenue.toLocaleString()}` },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="font-bold text-gray-900 text-sm">{stat.value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50 flex-wrap">
                  <button onClick={() => openEdit(member)}
                    className="text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                    Edit
                  </button>
                  <button onClick={() => { setShowPasswordFor(member.id); setNewPassword(""); setShowPass(false); }}
                    className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    {member.passwordSet ? "Reset Password" : "Set Password"}
                  </button>
                  <button onClick={() => toggleActive(member)}
                    className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${member.active ? "text-amber-700 bg-amber-50 hover:bg-amber-100" : "text-green-700 bg-green-50 hover:bg-green-100"}`}>
                    {member.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => setDeleteConfirm(member.id)}
                    className="ml-auto p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">{editingId ? "Edit Staff Member" : "Add Staff Member"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 000-0000"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Calendar Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className="w-8 h-8 rounded-lg transition-transform hover:scale-110 focus:outline-none"
                      style={{ backgroundColor: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {editingId ? "New Password (leave blank to keep current)" : "Password *"}
                </label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingId ? "Leave blank to keep current" : "Set a login password"}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPass ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">
              Reset Password — {staff.find(s => s.id === showPasswordFor)?.name}
            </h2>
            <div className="relative mb-4">
              <input type={showPass ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password" autoFocus
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPass ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /> : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                </svg>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPasswordFor(null)}
                className="flex-1 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl transition-colors">Cancel</button>
              <button onClick={() => resetPassword(showPasswordFor)} disabled={saving || !newPassword}
                className="flex-1 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Remove Staff Member?</h3>
            <p className="text-sm text-gray-500 mb-5">Their login will be disabled and bookings will be unassigned.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 py-2.5 rounded-xl">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 py-2.5 rounded-xl">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
