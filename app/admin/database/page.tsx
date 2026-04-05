"use client";

import { useState, useEffect } from "react";
import { getAllUsers, getAllBookings, getAllPackages, getPlatformSettings, setPlatformSettings } from "@/lib/admin";
import type { PlatformSettings } from "@/lib/admin";

type TabName = "users" | "bookings" | "packages";

const STORAGE_KEYS: Record<TabName, string> = {
  users: "detailbook_user",
  bookings: "detailbook_bookings",
  packages: "detailbook_packages",
};

export default function AdminDatabasePage() {
  const [activeTab, setActiveTab] = useState<TabName>("users");
  const [data, setData] = useState<Record<TabName, any[]>>({ users: [], bookings: [], packages: [] });
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  // DB config
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState(3306);
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [dbSaved, setDbSaved] = useState(false);

  // JSON editor
  const [editingJson, setEditingJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonSaved, setJsonSaved] = useState(false);

  // Clear modal
  const [showClearModal, setShowClearModal] = useState<TabName | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    const s = getPlatformSettings();
    setSettings(s);
    setDbHost(s.dbHost);
    setDbPort(s.dbPort);
    setDbName(s.dbName);
    setDbUser(s.dbUser);
    setDbPassword(s.dbPassword);
    loadData();
    setLoaded(true);
  }, []);

  const loadData = () => {
    const d = { users: getAllUsers(), bookings: getAllBookings(), packages: getAllPackages() };
    setData(d);
    return d;
  };

  useEffect(() => {
    if (loaded) {
      const current = data[activeTab];
      setJsonText(JSON.stringify(current, null, 2));
      setEditingJson(false);
      setJsonError("");
    }
  }, [activeTab, loaded]);

  const handleSaveDb = () => {
    if (!settings) return;
    const updated: PlatformSettings = { ...settings, dbHost, dbPort, dbName, dbUser, dbPassword };
    setPlatformSettings(updated);
    setSettings(updated);
    setDbSaved(true);
    setTimeout(() => setDbSaved(false), 2000);
  };

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const key = STORAGE_KEYS[activeTab];
      if (activeTab === "users") {
        // Users is stored as a single object, not array
        const userData = Array.isArray(parsed) ? parsed[0] : parsed;
        localStorage.setItem(key, JSON.stringify(userData));
      } else {
        const arrData = Array.isArray(parsed) ? parsed : [parsed];
        localStorage.setItem(key, JSON.stringify(arrData));
      }
      const newData = loadData();
      setJsonText(JSON.stringify(newData[activeTab], null, 2));
      setEditingJson(false);
      setJsonError("");
      setJsonSaved(true);
      setTimeout(() => setJsonSaved(false), 2000);
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON");
    }
  };

  const handleExport = (tab: TabName) => {
    const json = JSON.stringify(data[tab], null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dbName || "detailbook"}_${tab}_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = (tab: TabName) => {
    if (confirmText !== "DELETE") return;
    localStorage.removeItem(STORAGE_KEYS[tab]);
    const newData = loadData();
    setJsonText(JSON.stringify(newData[tab], null, 2));
    setShowClearModal(null);
    setConfirmText("");
  };

  const tabs: { key: TabName; label: string; icon: string }[] = [
    { key: "users", label: "Users", icon: "👤" },
    { key: "bookings", label: "Bookings", icon: "📋" },
    { key: "packages", label: "Packages", icon: "📦" },
  ];

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900";

  if (!loaded) return <div className="p-8 text-gray-400">Loading...</div>;

  const currentData = data[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database</h1>
          <p className="text-sm text-gray-500 mt-1">Configure MySQL connection, view and edit data</p>
        </div>

        {/* ── MySQL Connection ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">MySQL Connection</h2>
                <p className="text-xs text-gray-500">Database credentials for production</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dbHost && dbName && dbUser ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  Not configured
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Host</label>
                <input type="text" value={dbHost} onChange={(e) => setDbHost(e.target.value)} placeholder="localhost" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                <input type="number" value={dbPort} onChange={(e) => setDbPort(parseInt(e.target.value) || 3306)} placeholder="3306" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Database Name</label>
                <input type="text" value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="detailbook" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                <input type="text" value={dbUser} onChange={(e) => setDbUser(e.target.value)} placeholder="root" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                <input type="password" value={dbPassword} onChange={(e) => setDbPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveDb}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Save
                  </button>
                  {dbSaved && <span className="text-xs text-green-600 font-medium">Saved!</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Connection string: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">mysql://{dbUser || "root"}:***@{dbHost || "localhost"}:{dbPort}/{dbName || "detailbook"}</code>
            </p>
          </div>
        </div>

        {/* ── Data Tabs ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}>
                <span>{tab.icon}</span>
                {tab.label}
                <span className="text-xs opacity-60">({data[tab.key].length})</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport(activeTab)}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export JSON
            </button>
            <button onClick={() => setShowClearModal(activeTab)}
              className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">
              Clear
            </button>
          </div>
        </div>

        {/* ── Table View ── */}
        {currentData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {Object.keys(currentData[0]).slice(0, 7).map((key) => (
                      <th key={key} className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((item, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      {Object.keys(currentData[0]).slice(0, 7).map((key) => (
                        <td key={key} className="px-4 py-2.5 text-gray-700 text-xs whitespace-nowrap max-w-[180px] truncate">
                          {typeof item[key] === "object" ? JSON.stringify(item[key]).slice(0, 50) + "..." : String(item[key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentData.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">No {activeTab} data</p>
          </div>
        )}

        {/* ── JSON Editor ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Raw JSON</h3>
              <span className="text-xs text-gray-400">{activeTab}</span>
            </div>
            <div className="flex items-center gap-2">
              {jsonSaved && <span className="text-xs text-green-600 font-medium">Saved to storage!</span>}
              {jsonError && <span className="text-xs text-red-600 font-medium">{jsonError}</span>}
              {editingJson ? (
                <>
                  <button onClick={() => { setEditingJson(false); setJsonText(JSON.stringify(currentData, null, 2)); setJsonError(""); }}
                    className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSaveJson}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Save Changes
                  </button>
                </>
              ) : (
                <button onClick={() => setEditingJson(true)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit
                </button>
              )}
            </div>
          </div>
          {editingJson ? (
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(""); }}
              className={`w-full p-4 text-xs font-mono leading-relaxed bg-gray-50 text-gray-800 focus:outline-none resize-none min-h-[400px] ${jsonError ? "ring-2 ring-red-300" : ""}`}
              spellCheck={false}
            />
          ) : (
            <div className="p-4 max-h-[400px] overflow-auto bg-gray-50">
              <pre className="text-xs font-mono leading-relaxed text-gray-700 whitespace-pre-wrap">{JSON.stringify(currentData, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md mx-4 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear {showClearModal} data</h3>
            <p className="text-sm text-gray-600 mb-4">Type <strong>DELETE</strong> to confirm.</p>
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE"'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowClearModal(null); setConfirmText(""); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => handleClear(showClearModal)} disabled={confirmText !== "DELETE"}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
