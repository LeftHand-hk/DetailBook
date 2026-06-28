"use client";

import { useEffect, useMemo, useState } from "react";

// Share Toolkit — turns the lonely "copy your link" step into the action
// that actually gets a detailer their first booking. New accounts have no
// traffic, so the fastest path to felt value is blasting the booking link
// to people they already know. Each channel has a pre-written, detailing-
// specific message and a one-tap action (deep link on mobile, copy on
// desktop). onShared fires on any real share/copy so callers can mark the
// "share_link" setup step complete.

type Channel = "text" | "whatsapp" | "instagram" | "email";

type ShareToolkitProps = {
  url: string;
  businessName?: string;
  onShared?: () => void;
  className?: string;
};

const CHANNELS: { id: Channel; label: string; emoji: string }[] = [
  { id: "text", label: "Text", emoji: "💬" },
  { id: "whatsapp", label: "WhatsApp", emoji: "🟢" },
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "email", label: "Email", emoji: "✉️" },
];

function buildMessage(channel: Channel, url: string, biz: string): { subject?: string; body: string } {
  const name = biz?.trim() || "us";
  switch (channel) {
    case "text":
      return {
        body: `Hey! You can now book your detail with ${name} online — pick your service and time here: ${url}`,
      };
    case "whatsapp":
      return {
        body: `Hi! 🚗✨ ${name} is now taking bookings online. Choose your service and time (and lock it in with a quick deposit) here: ${url}`,
      };
    case "instagram":
      return {
        body: `📲 Booking is now ONLINE!\nTap the link to reserve your detail with ${name} — pick your time in seconds. 🚗✨\n${url}`,
      };
    case "email":
      return {
        subject: `Book your next detail with ${name} online`,
        body: `Hi,\n\nYou can now book your next detail with ${name} online — choose your service, pick a time, and reserve your slot in under a minute:\n\n${url}\n\nSee you soon!\n${name}`,
      };
  }
}

export default function ShareToolkit({ url, businessName, onShared, className = "" }: ShareToolkitProps) {
  const [channel, setChannel] = useState<Channel>("text");
  const [message, setMessage] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const built = useMemo(() => buildMessage(channel, url, businessName || ""), [channel, url, businessName]);

  // Reset the editable message whenever the channel changes so the user
  // always starts from the tailored copy (they can still tweak it).
  useEffect(() => {
    setMessage(built.body);
    setCopiedMsg(false);
  }, [built.body]);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const markShared = () => { try { onShared?.(); } catch { /* noop */ } };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      markShared();
    } catch { /* clipboard blocked */ }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
      markShared();
    } catch { /* clipboard blocked */ }
  };

  const openChannel = () => {
    const text = message || built.body;
    let href = "";
    if (channel === "text") {
      href = `sms:?&body=${encodeURIComponent(text)}`;
    } else if (channel === "whatsapp") {
      href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    } else if (channel === "email") {
      href = `mailto:?subject=${encodeURIComponent(built.subject || "")}&body=${encodeURIComponent(text)}`;
    } else if (channel === "instagram") {
      // No text-prefill deep link for IG; copy the caption and open the app/site.
      copyMessage();
      href = "https://instagram.com";
    }
    if (href) {
      window.open(href, channel === "whatsapp" || channel === "instagram" ? "_blank" : "_self");
      markShared();
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "Book online", text: message || built.body, url });
      markShared();
    } catch { /* user cancelled */ }
  };

  const openLabel = channel === "instagram" ? "Copy caption & open Instagram" : channel === "email" ? "Open email" : channel === "whatsapp" ? "Open WhatsApp" : "Open Messages";

  return (
    <div className={`rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg" aria-hidden>🔗</span>
        <h3 className="text-base font-black text-gray-900">Share your link & get your first booking</h3>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        The fastest way to a booking: send your link to customers you already have. Pick a channel — the message is written for you.
      </p>

      {/* The link itself */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 font-mono text-sm text-blue-700">{url}</code>
        <button
          type="button"
          onClick={copyLink}
          className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition-all active:scale-[0.98] ${
            copiedLink ? "bg-emerald-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {copiedLink ? "Copied!" : "Copy link"}
        </button>
      </div>

      {/* Channel selector */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {CHANNELS.map((c) => {
          const active = channel === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-2.5 text-xs font-black transition-all active:scale-[0.97] ${
                active ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
              }`}
            >
              <span className="text-lg" aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Editable, pre-written message */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="mb-3 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm leading-relaxed text-gray-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={openChannel}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.99]"
        >
          {openLabel}
        </button>
        <button
          type="button"
          onClick={copyMessage}
          className={`flex h-12 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-sm font-black transition-all active:scale-[0.99] ${
            copiedMsg ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
          }`}
        >
          {copiedMsg ? "Copied!" : "Copy message"}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-4 text-sm font-black text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.99]"
          >
            Share…
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Tip: add this link to your Instagram bio, Google Business profile, and WhatsApp status so new customers can book 24/7.
      </p>
    </div>
  );
}
