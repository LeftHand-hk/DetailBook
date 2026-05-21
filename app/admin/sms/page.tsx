"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Conversation {
  contact: string;
  lastBody: string;
  lastDirection: string;
  lastAt: string;
  unread: number;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  contact: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  status: string;
  read: boolean;
  createdAt: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminSmsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // New-message composer state.
  const [composing, setComposing] = useState(false);
  const [newTo, setNewTo] = useState("");

  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sms", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setListError("");
    } catch (err: any) {
      setListError(err?.message || "Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (contact: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/admin/sms?contact=${encodeURIComponent(contact)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      // Reflect read-state locally without a full reload.
      setConversations((prev) => prev.map((c) => (c.contact === contact ? { ...c, unread: 0 } : c)));
    } catch {
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Poll for new messages every 15s so inbound texts surface without a
  // manual refresh. Refreshes the open thread too.
  useEffect(() => {
    const t = setInterval(() => {
      loadConversations();
      if (activeContact) loadThread(activeContact);
    }, 15000);
    return () => clearInterval(t);
  }, [activeContact, loadConversations, loadThread]);

  useEffect(() => {
    if (activeContact) loadThread(activeContact);
  }, [activeContact, loadThread]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openConversation = (contact: string) => {
    setComposing(false);
    setActiveContact(contact);
    setSendError("");
  };

  const send = async () => {
    const to = composing ? newTo.trim() : activeContact;
    const text = reply.trim();
    if (!to || !text) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/admin/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error || `HTTP ${res.status}`);
        return;
      }
      setReply("");
      const sentTo = (data.message?.contact as string) || to;
      setComposing(false);
      setNewTo("");
      setActiveContact(sentTo);
      await loadThread(sentTo);
      await loadConversations();
    } catch (err: any) {
      setSendError(err?.message || "Network error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SMS Inbox</h1>
            <p className="text-sm text-gray-500 mt-1">
              Send and receive texts through your Twilio number, right here.
            </p>
          </div>
          <button
            onClick={() => { setComposing(true); setActiveContact(null); setMessages([]); setSendError(""); }}
            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New message
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          {/* Conversation list */}
          <aside className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-900">Conversations</h2>
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingList && <div className="p-4 text-sm text-gray-400">Loading…</div>}
              {listError && <div className="p-4 text-sm text-red-600">{listError}</div>}
              {!loadingList && !listError && conversations.length === 0 && (
                <div className="p-6 text-sm text-gray-400 text-center">
                  No messages yet. Inbound texts to your Twilio number will appear here.
                </div>
              )}
              {conversations.map((c) => {
                const active = c.contact === activeContact;
                return (
                  <button
                    key={c.contact}
                    onClick={() => openConversation(c.contact)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                      active ? "bg-gray-900 text-white" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold truncate ${active ? "text-white" : "text-gray-900"}`}>
                        {c.contact}
                      </span>
                      {c.unread > 0 && (
                        <span className="flex-shrink-0 text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs truncate mt-0.5 ${active ? "text-white/70" : "text-gray-500"}`}>
                      {c.lastDirection === "outbound" ? "You: " : ""}{c.lastBody}
                    </div>
                    <div className={`text-[11px] mt-0.5 ${active ? "text-white/50" : "text-gray-400"}`}>
                      {fmtTime(c.lastAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Thread / composer */}
          <section className="bg-white rounded-2xl border border-gray-200 flex flex-col max-h-[calc(100vh-180px)] min-h-[400px]">
            {composing ? (
              <div className="p-4 border-b border-gray-100 flex-shrink-0">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</label>
                <input
                  type="tel"
                  value={newTo}
                  onChange={(e) => setNewTo(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
            ) : activeContact ? (
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-sm font-bold text-gray-900">{activeContact}</h2>
              </div>
            ) : null}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!activeContact && !composing && (
                <div className="h-full flex items-center justify-center text-sm text-gray-400 py-20 text-center">
                  Select a conversation, or start a new message.
                </div>
              )}
              {activeContact && loadingThread && messages.length === 0 && (
                <div className="text-sm text-gray-400">Loading…</div>
              )}
              {messages.map((m) => {
                const out = m.direction === "outbound";
                return (
                  <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      out ? "bg-gray-900 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${out ? "text-white/50" : "text-gray-400"}`}>
                        {fmtTime(m.createdAt)}
                        {out && m.status === "failed" && <span className="text-red-300 font-semibold"> · failed</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            {/* Reply box */}
            {(activeContact || composing) && (
              <div className="p-3 border-t border-gray-100 flex-shrink-0">
                {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
                    }}
                    rows={2}
                    placeholder="Type a message…  (⌘/Ctrl+Enter to send)"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !reply.trim() || (composing && !newTo.trim())}
                    className="flex-shrink-0 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
