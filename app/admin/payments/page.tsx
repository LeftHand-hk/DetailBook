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

const NETWORKS = ["Ethereum", "Bitcoin", "Solana", "Polygon", "Binance Smart Chain"];
const COINS = ["BTC", "ETH", "USDT", "USDC", "SOL"];

export default function AdminPaymentsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  // Stripe
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");

  // Crypto
  const [cryptoEnabled, setCryptoEnabled] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("Ethereum");
  const [acceptedCoins, setAcceptedCoins] = useState<string[]>([]);

  useEffect(() => {
    const s = getPlatformSettings();
    setSettings(s);

    // Stripe
    setStripeEnabled(s.stripe?.enabled || false);
    setStripePublishableKey(s.stripe?.publishableKey || "");
    setStripeSecretKey(s.stripe?.secretKey || "");
    setStripeWebhookSecret(s.stripe?.webhookSecret || "");

    // Crypto
    setCryptoEnabled(s.crypto?.enabled || false);
    setWalletAddress(s.crypto?.walletAddress || "");
    setNetwork(s.crypto?.network || "Ethereum");
    setAcceptedCoins(s.crypto?.acceptedCoins || []);

    setLoaded(true);
  }, []);

  const handleSave = () => {
    if (!settings) return;
    const updated: PlatformSettings = {
      ...settings,
      stripe: {
        enabled: stripeEnabled,
        publishableKey: stripePublishableKey,
        secretKey: stripeSecretKey,
        webhookSecret: stripeWebhookSecret,
      },
      crypto: {
        enabled: cryptoEnabled,
        walletAddress,
        network,
        acceptedCoins,
      },
    };
    setPlatformSettings(updated);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleCoin = (coin: string) => {
    setAcceptedCoins((prev) =>
      prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]
    );
  };

  if (!loaded) return <div className="p-8 text-gray-400">Loading...</div>;

  const stripeConnected = stripeEnabled && stripePublishableKey && stripeSecretKey;
  const cryptoConnected = cryptoEnabled && walletAddress;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how customers pay for DetailBook subscriptions
          </p>
        </div>

        {/* Stripe Configuration */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Stripe</h2>
              <p className="text-sm text-gray-500 mt-0.5">Accept credit card payments via Stripe</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded ${
                  stripeConnected
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    stripeConnected ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {stripeConnected ? "Connected" : "Not Connected"}
              </span>
              <Toggle value={stripeEnabled} onChange={setStripeEnabled} />
            </div>
          </div>

          {stripeEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publishable Key</label>
                <input
                  type="text"
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  placeholder="pk_live_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                <input
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                <input
                  type="text"
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cryptocurrency Configuration */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cryptocurrency</h2>
              <p className="text-sm text-gray-500 mt-0.5">Accept crypto payments for subscriptions</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded ${
                  cryptoConnected
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    cryptoConnected ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {cryptoConnected ? "Connected" : "Not Connected"}
              </span>
              <Toggle value={cryptoEnabled} onChange={setCryptoEnabled} />
            </div>
          </div>

          {cryptoEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address</label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  {NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Accepted Coins</label>
                <div className="flex flex-wrap gap-3">
                  {COINS.map((coin) => (
                    <label
                      key={coin}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={acceptedCoins.includes(coin)}
                        onChange={() => toggleCoin(coin)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {coin}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Payment Settings
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">Saved!</span>
          )}
        </div>
      </div>
    </div>
  );
}
