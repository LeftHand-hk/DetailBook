"use client";

import { useEffect, useState } from "react";

interface TicketUser {
  id: string;
  email: string;
  name: string;
  businessName: string;
  phone?: string;
  plan: string;
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  adminReply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  user: TicketUser;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_STYLES: Record<string, string> = {
  open:        "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  resolved:    "bg-green-50 text-green-700 border-green-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
};

const CATEGORY_LABEL: Record<string, string> = {
  general:   "General",
  billing:   "Billing",
  technical: "Technical",
  feature:   "Feature",
  account:   "Account",
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<{ status: string; priority: string }>({ status: "open", priority: "all" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.status !== "all") params.set("status", filter.status);
    if (filter.priority !== "all") params.set("priority", filter.priority);
    try {
      const res = await fetch(`/api/admin/tickets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply: reply.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
        setReply("");
      }
    } catch { /* silent */ }
    setSending(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelected(updated);
        setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      }
    } catch { /* silent */ }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  const formatRelative = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  };

  const filteredTickets = tickets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      t.message.toLowerCase().includes(q) ||
      t.user.email.toLowerCase().includes(q) ||
      t.user.name.toLowerCase().includes(q) ||
      t.user.businessName.toLowerCase().includes(q)
    );
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const priorityCount = tickets.filter((t) => t.priority === "priority" && t.status !== "resolved" && t.status !== "closed").length;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and reply to customer support requests.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{tickets.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Open</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{openCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Priority</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{priorityCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Resolved</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{tickets.filter((t) => t.status === "resolved").length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr] gap-4">
        {/* ── Ticket list ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
          {/* Filters */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="flex-1 text-xs font-medium px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="flex-1 text-xs font-medium px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="all">All priorities</option>
                <option value="priority">Priority</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-10 text-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-400 mt-2">Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No tickets</p>
                <p className="text-xs text-gray-400 mt-0.5">Try adjusting your filters</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = selected?.id === ticket.id;
                const unread = ticket.status === "open";
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setSelected(ticket)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {ticket.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className={`text-sm truncate ${unread ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                            {ticket.user.name}
                          </p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelative(ticket.createdAt)}</span>
                        </div>
                        <p className={`text-xs truncate mb-1 ${unread ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{ticket.user.businessName}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {ticket.priority === "priority" && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              PRIORITY
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLES[ticket.status] || STATUS_STYLES.open}`}>
                            {STATUS_LABEL[ticket.status] || ticket.status}
                          </span>
                        </div>
                      </div>

                      {unread && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Detail panel ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">Select a ticket</p>
                <p className="text-xs text-gray-400 mt-0.5">Choose a ticket from the list to view and reply</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900">{selected.subject}</h2>
                      {selected.priority === "priority" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          PRIORITY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Ticket #{selected.id.slice(-8)} · {CATEGORY_LABEL[selected.category] || selected.category} · {formatDate(selected.createdAt)}
                    </p>
                  </div>
                  <select
                    value={selected.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-900 ${STATUS_STYLES[selected.status] || STATUS_STYLES.open}`}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Customer info */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                      {selected.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">{selected.user.name}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          selected.user.plan === "pro"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-200 text-gray-600"
                        }`}>
                          {selected.user.plan.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{selected.user.businessName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`mailto:${selected.user.email}`}
                        title={selected.user.email}
                        className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </a>
                      {selected.user.phone && (
                        <a href={`tel:${selected.user.phone}`}
                          title={selected.user.phone}
                          className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/30">
                {/* User message */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">
                    {selected.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold text-gray-900">{selected.user.name}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(selected.createdAt)}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                    </div>
                  </div>
                </div>

                {/* Admin reply */}
                {selected.adminReply && (
                  <div className="flex gap-3 flex-row-reverse">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">
                      DB
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 justify-end">
                        <p className="text-[10px] text-gray-400">
                          {selected.repliedAt ? formatDate(selected.repliedAt) : ""}
                        </p>
                        <p className="text-xs font-bold text-blue-700">DetailBook Support</p>
                      </div>
                      <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm p-4">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.adminReply}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply composer */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={selected.adminReply ? "Send another reply..." : "Type your reply..."}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none placeholder-gray-400"
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-400">
                    Sends an email to <strong>{selected.user.email}</strong>
                  </p>
                  <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim()}
                    className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Reply
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
