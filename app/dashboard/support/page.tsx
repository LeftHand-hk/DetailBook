"use client";

import { useState, useEffect, useRef } from "react";
import { getUser } from "@/lib/storage";

interface TicketMessage {
  id: string;
  sender: "user" | "admin";
  content: string;
  createdAt: string;
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
  messages?: TicketMessage[];
}

const CATEGORIES = [
  { value: "general",   label: "General Question" },
  { value: "billing",   label: "Billing & Payments" },
  { value: "technical", label: "Technical Issue" },
  { value: "feature",   label: "Feature Request" },
  { value: "account",   label: "Account Help" },
];

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  open:        { label: "Open",        dot: "bg-amber-400",  badge: "bg-amber-50 text-amber-700 border-amber-200" },
  in_progress: { label: "In Progress", dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200" },
  resolved:    { label: "Resolved",    dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200" },
  closed:      { label: "Closed",      dot: "bg-gray-400",   badge: "bg-gray-100 text-gray-500 border-gray-200" },
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function SupportPage() {
  const [isPro, setIsPro] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [view, setView] = useState<"form" | "tickets">("form");
  const [form, setForm] = useState({ subject: "", category: "general", message: "" });

  useEffect(() => {
    const u = getUser();
    setIsPro(u?.plan === "pro");
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/support/ticket");
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess(true);
        setForm({ subject: "", category: "general", message: "" });
        await fetchTickets();
        setTimeout(() => {
          setSuccess(false);
          setView("tickets");
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit ticket");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  const handleDelete = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/ticket/${ticketId}`, { method: "DELETE" });
      if (res.ok) {
        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
        if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      }
    } catch { /* silent */ }
  };

  const handleTicketUpdate = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setSelectedTicket(updated);
  };

  const unreadCount = tickets.filter((t) => {
    const msgs = t.messages ?? [];
    return msgs.some((m) => m.sender === "admin") || t.adminReply;
  }).filter((t) => t.status !== "resolved" && t.status !== "closed").length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-extrabold text-gray-900">Support</h1>
            {isPro ? (
              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                PRIORITY
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">STANDARD</span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {isPro ? "Priority response within 1 hour during business hours." : "Response within 1-3 hours. Upgrade to Pro for guaranteed 1h response."}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setView("form")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === "form" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            New Ticket
          </button>
          <button onClick={() => setView("tickets")}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === "tickets" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            My Tickets
            {tickets.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full">
                {tickets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── New Ticket Form ── */}
      {view === "form" && (
        <div className="grid lg:grid-cols-[1fr_280px] gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Submit a Support Ticket</h2>
              <p className="text-xs text-gray-500 mt-0.5">Describe your issue and we&apos;ll get back to you by email.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">Ticket submitted successfully!</p>
                    <p className="text-xs text-green-600">Redirecting to your tickets...</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                    {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Subject</label>
                  <input type="text" required maxLength={200} value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Brief description..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Message</label>
                <textarea required rows={7} maxLength={5000} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, and what you've already tried."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300 resize-none" />
                <p className="text-xs text-gray-400 mt-1 text-right">{form.message.length}/5000</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">We&apos;ll reply to your account email</p>
                <button type="submit" disabled={submitting || !form.subject.trim() || !form.message.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm">
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                  ) : (
                    <>Send Ticket <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Response Times</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-sm text-gray-600">Standard</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">1-3h</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-600">Priority</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">~1h</span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400">Mon–Sat, 9am–6pm EST</p>
                </div>
              </div>
              {!isPro && (
                <a href="/dashboard/billing"
                  className="mt-4 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Upgrade to Priority
                </a>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Direct Contact</h3>
              <a href="mailto:info@detailbookapp.com"
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-100 transition-all">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Email Us</p>
                  <p className="text-xs text-gray-500">info@detailbookapp.com</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── My Tickets ── */}
      {view === "tickets" && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="font-bold text-gray-700 mb-1">No tickets yet</p>
              <p className="text-sm text-gray-400 mb-4">Submit a ticket and we&apos;ll get back to you shortly.</p>
              <button onClick={() => setView("form")}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
                Submit a Ticket
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
                const msgs = ticket.messages ?? [];
                const hasAdminReply = msgs.some((m) => m.sender === "admin") || !!ticket.adminReply;
                const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                const canReply = ticket.status !== "resolved" && ticket.status !== "closed";

                return (
                  <div key={ticket.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                    {/* Top bar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {ticket.priority === "priority" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Priority
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">#{ticket.id.slice(-6)}</span>
                        <span className="text-[10px] text-gray-400">{formatRelative(ticket.createdAt)}</span>
                      </div>
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this ticket?")) handleDelete(ticket.id);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete ticket"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base mb-0.5">{ticket.subject}</h3>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{ticket.category}</span>
                        </div>
                        {hasAdminReply && (
                          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Admin replied
                          </div>
                        )}
                      </div>

                      {/* Last message preview */}
                      {lastMsg ? (
                        <div className={`rounded-xl p-3 mb-3 ${lastMsg.sender === "admin" ? "bg-blue-50 border border-blue-100" : "bg-gray-50 border border-gray-100"}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${lastMsg.sender === "admin" ? "bg-blue-500" : "bg-gray-400"}`} />
                            <span className={`text-[10px] font-bold ${lastMsg.sender === "admin" ? "text-blue-700" : "text-gray-500"}`}>
                              {lastMsg.sender === "admin" ? "DetailBook Support" : "You"} · {formatRelative(lastMsg.createdAt)}
                            </span>
                          </div>
                          <p className={`text-xs line-clamp-2 leading-relaxed ${lastMsg.sender === "admin" ? "text-blue-900" : "text-gray-700"}`}>
                            {lastMsg.content}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500">You · {formatRelative(ticket.createdAt)}</span>
                          </div>
                          <p className="text-xs line-clamp-2 text-gray-600 leading-relaxed">{ticket.message}</p>
                        </div>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                          {msgs.length} message{msgs.length !== 1 ? "s" : ""}
                        </div>
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          {canReply ? "View & Reply" : "View Conversation"}
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Conversation Modal ── */}
      {selectedTicket && (
        <ConversationModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  );
}

function ConversationModal({
  ticket,
  onClose,
  onUpdate,
}: {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: (t: Ticket) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const canReply = ticket.status !== "resolved" && ticket.status !== "closed";

  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;

  // Build thread
  const thread: { sender: "user" | "admin"; content: string; createdAt: string }[] =
    ticket.messages && ticket.messages.length > 0
      ? ticket.messages.map((m) => ({ sender: m.sender, content: m.content, createdAt: m.createdAt }))
      : [
          { sender: "user", content: ticket.message, createdAt: ticket.createdAt },
          ...(ticket.adminReply
            ? [{ sender: "admin" as const, content: ticket.adminReply, createdAt: ticket.repliedAt || ticket.createdAt }]
            : []),
        ];

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [ticket.messages]);

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSendError("");
    setSending(true);
    try {
      const res = await fetch(`/api/support/ticket/${ticket.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      if (res.ok) {
        setReplyText("");
        const ticketRes = await fetch("/api/support/ticket");
        if (ticketRes.ok) {
          const all = await ticketRes.json();
          const updated = Array.isArray(all) ? all.find((t: Ticket) => t.id === ticket.id) : null;
          if (updated) onUpdate(updated);
        }
      } else {
        const data = await res.json();
        setSendError(data.error || "Failed to send");
      }
    } catch {
      setSendError("Network error.");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Status strip */}
        <div className={`h-1 w-full flex-shrink-0 ${
          ticket.priority === "priority" ? "bg-gradient-to-r from-blue-500 to-indigo-500" :
          ticket.status === "resolved" ? "bg-green-500" :
          ticket.status === "in_progress" ? "bg-blue-500" : "bg-amber-400"
        }`} />

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
                {ticket.priority === "priority" && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Priority
                  </span>
                )}
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">{ticket.category}</span>
              </div>
              <h2 className="font-bold text-gray-900 text-base leading-snug">{ticket.subject}</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">#{ticket.id.slice(-8)} · Opened {formatFull(ticket.createdAt)}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {thread.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.sender === "admin" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white ${
                msg.sender === "admin" ? "bg-blue-600" : "bg-gray-800"
              }`}>
                {msg.sender === "admin" ? "DB" : "YOU"}
              </div>
              <div className={`flex-1 max-w-[85%] ${msg.sender === "admin" ? "items-end" : ""}`}>
                <div className={`flex items-center gap-2 mb-1 ${msg.sender === "admin" ? "justify-end" : ""}`}>
                  {msg.sender === "admin" ? (
                    <>
                      <span className="text-[10px] text-gray-400">{formatFull(msg.createdAt)}</span>
                      <span className="text-xs font-bold text-blue-700">DetailBook Support</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-gray-700">You</span>
                      <span className="text-[10px] text-gray-400">{formatFull(msg.createdAt)}</span>
                    </>
                  )}
                </div>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.sender === "admin"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Awaiting reply placeholder */}
          {!thread.some((m) => m.sender === "admin") && (
            <div className="flex items-center gap-3 py-2 px-4 bg-amber-50 border border-amber-100 rounded-xl">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-700 font-medium">
                {ticket.priority === "priority" ? "Priority response within 1 hour during business hours." : "Response within 1-3 hours during business hours."}
              </p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Reply */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
          {canReply ? (
            <>
              {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
              <div className="flex gap-2.5 items-end">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a follow-up message..."
                  rows={2}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && replyText.trim()) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0 text-sm"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  Send
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Ctrl+Enter to send</p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                This ticket is <strong className="ml-1">{cfg.label}</strong>
              </div>
              <button onClick={onClose}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
