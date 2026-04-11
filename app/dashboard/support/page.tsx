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
  { value: "billing",   label: "Billing &amp; Payments" },
  { value: "technical", label: "Technical Issue" },
  { value: "feature",   label: "Feature Request" },
  { value: "account",   label: "Account Help" },
];

const STATUS_STYLES: Record<string, string> = {
  open:         "bg-amber-50 text-amber-700 border-amber-200",
  in_progress:  "bg-blue-50 text-blue-700 border-blue-200",
  resolved:     "bg-green-50 text-green-700 border-green-200",
  closed:       "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
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
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SupportPage() {
  const [isPro, setIsPro] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

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
        fetchTickets();
        setTimeout(() => setSuccess(false), 5000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit ticket");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  const handleTicketUpdate = (updated: Ticket) => {
    setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setSelectedTicket(updated);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-extrabold text-gray-900">Support</h1>
          {isPro ? (
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Priority Support
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-full">
              Standard Support
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          {isPro
            ? "As a Pro member, your tickets get priority response within 1 hour during business hours."
            : "We respond to all tickets within 5-10 hours. Upgrade to Pro for priority response within 1 hour."}
        </p>
      </div>

      {/* Pro upgrade banner */}
      {!isPro && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Get Priority Support</p>
              <p className="text-xs text-gray-600">Pro members get faster response times and priority handling.</p>
            </div>
          </div>
          <a href="/dashboard/billing"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex-shrink-0">
            Upgrade
          </a>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h2 className="font-bold text-gray-900">Submit a Ticket</h2>
              <p className="text-sm text-gray-500">Tell us what&apos;s going on and we&apos;ll get back to you by email.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-green-700">Ticket submitted!</p>
                    <p className="text-xs text-green-600 mt-0.5">We&apos;ve received your message and will reply to your account email.</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">{error}</div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white">
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">Subject</label>
                <input type="text" required maxLength={200} value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-300" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">Message</label>
                <textarea required rows={8} maxLength={5000} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us what's happening. Include any error messages, what you were trying to do, and what you've already tried."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-300 resize-none" />
                <p className="text-xs text-gray-400 mt-1">{form.message.length}/5000 characters</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-500">We&apos;ll reply to your account email</p>
                <button type="submit" disabled={submitting || !form.subject || !form.message}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                  ) : (
                    <>Send Ticket<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-bold text-gray-900 text-sm">Response Time</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Standard</span>
                <span className="text-sm font-bold text-gray-900">5-10h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  Priority
                  <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </span>
                <span className="text-sm font-bold text-blue-600">~1h</span>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400">Business hours: Mon–Sat, 9am–6pm EST</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-3">Other Ways to Reach Us</h3>
            <a href="mailto:info@detailbookapp.com"
              className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900">Email</p>
                <p className="text-xs text-gray-500 truncate">info@detailbookapp.com</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Ticket history */}
      {!loading && tickets.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Your Tickets</h2>
              <p className="text-xs text-gray-500">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} · Click to view &amp; continue conversation
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {tickets.map((ticket) => {
              const hasReply = !!(ticket.adminReply || ticket.messages?.some(m => m.sender === "admin"));
              const canReply = ticket.status !== "resolved" && ticket.status !== "closed";
              return (
                <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden text-left">
                  <div className={`h-1 w-full ${
                    ticket.priority === "priority" ? "bg-gradient-to-r from-blue-500 to-indigo-500" :
                    ticket.status === "resolved" ? "bg-green-500" :
                    ticket.status === "in_progress" ? "bg-blue-400" : "bg-amber-400"
                  }`} />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {ticket.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ticket.priority === "priority" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Priority
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[ticket.status] || STATUS_STYLES.open}`}>
                          {STATUS_LABEL[ticket.status] || ticket.status}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-blue-600 transition-colors line-clamp-1">{ticket.subject}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{ticket.message}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatRelative(ticket.createdAt)}
                      </span>
                      {hasReply ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Replied
                          {canReply && <span className="text-gray-400 font-normal ml-0.5">· tap to reply</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">Awaiting reply</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  );
}

function TicketDetailModal({
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages]);

  const formatFull = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  // Build thread: prefer messages array, fall back to original fields
  const thread: { sender: "user" | "admin"; content: string; createdAt: string }[] = [];
  if (ticket.messages && ticket.messages.length > 0) {
    ticket.messages.forEach((m) => thread.push({ sender: m.sender, content: m.content, createdAt: m.createdAt }));
  } else {
    thread.push({ sender: "user", content: ticket.message, createdAt: ticket.createdAt });
    if (ticket.adminReply) {
      thread.push({ sender: "admin", content: ticket.adminReply, createdAt: ticket.repliedAt || ticket.createdAt });
    }
  }

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
        // Refresh ticket data
        const ticketRes = await fetch("/api/support/ticket");
        if (ticketRes.ok) {
          const all = await ticketRes.json();
          const updated = Array.isArray(all) ? all.find((t: Ticket) => t.id === ticket.id) : null;
          if (updated) onUpdate(updated);
        }
      } else {
        const data = await res.json();
        setSendError(data.error || "Failed to send message");
      }
    } catch {
      setSendError("Network error. Please try again.");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Accent bar */}
        <div className={`h-1.5 w-full flex-shrink-0 ${
          ticket.priority === "priority" ? "bg-gradient-to-r from-blue-500 to-indigo-500" :
          ticket.status === "resolved" ? "bg-green-500" :
          ticket.status === "in_progress" ? "bg-blue-400" : "bg-amber-400"
        }`} />

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {ticket.priority === "priority" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Priority
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[ticket.status] || STATUS_STYLES.open}`}>
                {STATUS_LABEL[ticket.status] || ticket.status}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{ticket.subject}</h2>
            <p className="text-xs text-gray-400 mt-0.5">#{ticket.id.slice(-8)} · {ticket.category}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50/30">
          {thread.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.sender === "admin" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold ${
                msg.sender === "admin" ? "bg-blue-600" : "bg-gradient-to-br from-gray-700 to-gray-900"
              }`}>
                {msg.sender === "admin" ? "DB" : "YOU"}
              </div>
              <div className={`flex-1 min-w-0 ${msg.sender === "admin" ? "items-end" : ""}`}>
                <div className={`flex items-center gap-2 mb-1 ${msg.sender === "admin" ? "justify-end" : ""}`}>
                  {msg.sender === "admin" ? (
                    <>
                      <p className="text-[10px] text-gray-400">{formatFull(msg.createdAt)}</p>
                      <p className="text-xs font-bold text-blue-700">DetailBook Support</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-gray-700">You</p>
                      <p className="text-[10px] text-gray-400">{formatFull(msg.createdAt)}</p>
                    </>
                  )}
                </div>
                <div className={`rounded-2xl p-4 ${
                  msg.sender === "admin"
                    ? "bg-blue-50 border border-blue-100 rounded-tr-sm"
                    : "bg-white border border-gray-200 rounded-tl-sm shadow-sm"
                }`}>
                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.sender === "admin" ? "text-blue-900" : "text-gray-700"
                  }`}>{msg.content}</p>
                </div>
              </div>
            </div>
          ))}

          {thread.length === 0 || (thread.length === 1 && thread[0].sender === "user" && !ticket.adminReply) ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-gray-700">Awaiting reply</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {ticket.priority === "priority"
                  ? "Priority response within ~1 hour during business hours"
                  : "Response within 5-10 hours during business hours"}
              </p>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {/* Reply area */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
          {canReply ? (
            <>
              {sendError && (
                <p className="text-xs text-red-600 font-medium mb-2">{sendError}</p>
              )}
              <div className="flex gap-3 items-end">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Send a follow-up message..."
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
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
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
              <p className="text-xs text-gray-500">
                This ticket is <strong>{STATUS_LABEL[ticket.status]}</strong>. Contact us to reopen.
              </p>
              <button onClick={onClose}
                className="text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
