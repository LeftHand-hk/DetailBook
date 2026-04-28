"use client";

import { useState, useEffect } from "react";
import { getPlatformSettings, setPlatformSettings } from "@/lib/admin";
import type { PlatformSettings } from "@/lib/admin";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        value ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");

  // Form fields
  const [platformName, setPlatformName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [defaultDomain, setDefaultDomain] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  // SMS test
  const [smsTo, setSmsTo] = useState("");
  const [smsMessage, setSmsMessage] = useState("DetailBook test SMS — if you got this, Twilio is working.");
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSendTestSms = async () => {
    setSmsSending(true);
    setSmsResult(null);
    try {
      const res = await fetch("/api/admin/sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: smsTo, message: smsMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSmsResult({ ok: false, text: data.error || `Failed (HTTP ${res.status})` });
      } else {
        setSmsResult({ ok: true, text: `Sent. Twilio Message SID: ${data.sid || "(none)"}` });
      }
    } catch (e) {
      setSmsResult({ ok: false, text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => {
    const s = getPlatformSettings();
    setSettings(s);
    setPlatformName(s.platformName);
    setSupportEmail(s.supportEmail);
    setDefaultDomain(s.defaultDomain);
    setMaintenanceMode(s.maintenanceMode);
    setMaintenanceMessage(s.maintenanceMessage);
    setLoaded(true);
  }, []);

  const handleSave = () => {
    if (!settings) return;
    const updated: PlatformSettings = {
      ...settings,
      platformName,
      supportEmail,
      defaultDomain,
      maintenanceMode,
      maintenanceMessage,
    };
    setPlatformSettings(updated);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (resetConfirm !== "RESET") return;
    // Clear all platform-related localStorage keys
    const keysToRemove = [
      "detailbook_platform",
      "detailbook_user",
      "detailbook_bookings",
      "detailbook_packages",
      "detailbook_admin",
      "detailbook_logged_in",
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    setShowResetModal(false);
    setResetConfirm("");
    // Reload to reinitialize defaults
    window.location.reload();
  };

  if (!loaded || !settings) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Global configuration for DetailBook</p>
        </div>

        {/* General Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">General</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Changes this name across the entire website (logo text, footer, etc.)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Domain</label>
            <input
              type="text"
              value={defaultDomain}
              onChange={(e) => setDefaultDomain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>
        </div>

        {/* SMS Test */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Send Test SMS</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Sends a real SMS through your Twilio account. Use it to verify deliverability after toll-free verification or messaging service changes.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
            <input
              type="tel"
              value={smsTo}
              onChange={(e) => setSmsTo(e.target.value)}
              placeholder="+15551234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">Include country code (e.g. +1 for US).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendTestSms}
              disabled={smsSending || !smsTo.trim()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {smsSending ? "Sending…" : "Send test SMS"}
            </button>
            {smsResult && (
              <span className={`text-sm ${smsResult.ok ? "text-green-700" : "text-red-700"}`}>
                {smsResult.ok ? "✓ " : "✗ "}{smsResult.text}
              </span>
            )}
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Maintenance Mode</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                When enabled, users see a maintenance message instead of the app
              </p>
            </div>
            <Toggle value={maintenanceMode} onChange={setMaintenanceMode} />
          </div>

          {maintenanceMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Message</label>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 resize-none"
              />
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">Saved!</span>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-white border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-1">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            This will permanently reset all platform data including users, bookings, packages, and settings.
          </p>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Reset All Platform Data
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md mx-4 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset All Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              This action is irreversible. All users, bookings, packages, and platform settings will be deleted.
              Type <strong>RESET</strong> to confirm.
            </p>
            <input
              type="text"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              placeholder='Type "RESET" to confirm'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirm("");
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetConfirm !== "RESET"}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
