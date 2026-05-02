"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, setUser, getPackages, setPackages, isLoggedIn, generateId, syncFromServer } from "@/lib/storage";
import type { User, Package } from "@/types";
import Logo from "@/components/Logo";
import type { Paddle } from "@paddle/paddle-js";

const STEPS = [
  { id: 0, label: "Business Details", icon: "🏢" },
  { id: 1, label: "First Package",    icon: "📦" },
  { id: 2, label: "Choose Plan",      icon: "💎" },
  { id: 3, label: "Booking Page",     icon: "🚀" },
];

const VEHICLE_TYPES = [
  { id: "sedan",     label: "Sedan",       icon: "🚗" },
  { id: "suv",       label: "SUV / Truck",  icon: "🚙" },
  { id: "van",       label: "Van / Minivan",icon: "🚐" },
  { id: "sports",    label: "Sports Car",   icon: "🏎️" },
  { id: "coupe",     label: "Coupe",        icon: "🚘" },
  { id: "pickup",    label: "Pickup Truck", icon: "🛻" },
  { id: "luxury",    label: "Luxury / SUV", icon: "🏁" },
  { id: "motorcycle",label: "Motorcycle",   icon: "🏍️" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]           = useState(0);
  const [user, setUserState]      = useState<User | null>(null);
  const [copied, setCopied]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro" | null>(null);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const selectedPlanRef = useRef<"starter" | "pro">("starter");

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return;
    import("@paddle/paddle-js").then(({ initializePaddle }) => {
      initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as "sandbox" | "production") || "production",
        token,
        async eventCallback(event) {
          if (event.name === "checkout.completed") {
            // Wait for the verified Paddle webhook to flip
            // subscriptionStatus to "active" before sending the user
            // into the dashboard. Activation is never client-driven.
            const deadline = Date.now() + 60_000;
            while (Date.now() < deadline) {
              try {
                const r = await fetch("/api/user", { cache: "no-store" });
                if (r.ok) {
                  const d = await r.json();
                  if (d.user?.subscriptionStatus === "active") break;
                }
              } catch {
                // keep polling
              }
              await new Promise((res) => setTimeout(res, 2000));
            }
            router.push("/dashboard");
          }
        },
      }).then((instance) => { if (instance) setPaddle(instance); });
    });
  }, [router]);

  // Step 1 — business details
  const [bizForm, setBizForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "FL",
    zip: "",
    serviceType: "mobile" as "mobile" | "shop" | "both",
  });

  // Step 2 — first package
  const [pkgForm, setPkgForm] = useState({
    name: "",
    description: "",
    price: "",
    duration: "120",
    depositPercent: "25",
    vehicleTypes: [] as string[],
    includedServices: "",
    notIncluded: "",
  });

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    const u = getUser();
    if (u) {
      setUserState(u);
      setBizForm((prev) => ({
        ...prev,
        businessName: u.businessName || "",
        email: u.email || "",
        phone: u.phone || "",
        city: u.city || "",
      }));
    }
  }, [router]);

  // ── Step 1 submit ──────────────────────────────────────────────────────────
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const fullAddress = `${bizForm.address}, ${bizForm.city}, ${bizForm.state} ${bizForm.zip}`.trim();
    const slug = bizForm.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: bizForm.businessName,
          phone: bizForm.phone,
          city: `${bizForm.city}, ${bizForm.state}`,
          address: fullAddress,
          serviceType: bizForm.serviceType,
          slug,
        }),
      });
      if (res.ok) {
        await syncFromServer();
        const u = getUser();
        if (u) setUserState(u);
      } else if (user) {
        const updated = { ...user, ...bizForm, address: fullAddress, slug };
        setUser(updated); setUserState(updated);
      }
    } catch {
      if (user) {
        const slug2 = bizForm.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const updated = { ...user, ...bizForm, address: `${bizForm.address}, ${bizForm.city}, ${bizForm.state} ${bizForm.zip}`, slug: slug2 };
        setUser(updated); setUserState(updated);
      }
    }

    setSaving(false);
    setStep(1);
  };

  // ── Step 2 submit ──────────────────────────────────────────────────────────
  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const depositAmount = pkgForm.depositPercent === "0" ? 0 : Math.round((parseFloat(pkgForm.price) * parseInt(pkgForm.depositPercent)) / 100);

    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pkgForm.name,
          description: pkgForm.description,
          price: pkgForm.price,
          duration: pkgForm.duration,
          deposit: depositAmount,
          active: true,
        }),
      });
      if (res.ok) {
        await syncFromServer();
      } else {
        const existing = getPackages();
        const newPkg: Package = {
          id: generateId(),
          name: pkgForm.name,
          description: pkgForm.description,
          price: parseFloat(pkgForm.price),
          duration: parseInt(pkgForm.duration),
          deposit: depositAmount,
          active: true,
        };
        setPackages([...existing, newPkg]);
      }
    } catch {
      const existing = getPackages();
      const depositAmount2 = pkgForm.depositPercent === "0" ? 0 : Math.round((parseFloat(pkgForm.price) * parseInt(pkgForm.depositPercent)) / 100);
      const newPkg: Package = {
        id: generateId(),
        name: pkgForm.name,
        description: pkgForm.description,
        price: parseFloat(pkgForm.price),
        duration: parseInt(pkgForm.duration),
        deposit: depositAmount2,
        active: true,
      };
      setPackages([...existing, newPkg]);
    }

    setSaving(false);
    setStep(2);
  };

  // ── Step 3 — free trial path ───────────────────────────────────────────────
  const handleStep3 = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      await syncFromServer();
      const u = getUser();
      if (u) setUserState(u);
    } catch {
      if (user) {
        const updated = { ...user, plan: selectedPlan };
        setUser(updated); setUserState(updated);
      }
    }
    setSaving(false);
    setStep(3);
  };

  // ── Pay Now path — open Paddle first, activate only after payment ──────────
  const handlePayNow = () => {
    if (!selectedPlan || !user) return;
    selectedPlanRef.current = selectedPlan;
    const priceId = selectedPlan === "pro"
      ? process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID
      : process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID;
    if (!priceId || !paddle) {
      alert("Payment system loading, please try again.");
      return;
    }
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: (user as any).id },
    });
  };

  const bookingUrl = user
    ? `${typeof window !== "undefined" ? window.location.origin : "https://detailbook.app"}/book/${user.slug}`
    : "";

  const handleCopy = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleVehicleType = (id: string) => {
    setPkgForm((prev) => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.includes(id)
        ? prev.vehicleTypes.filter((v) => v !== id)
        : [...prev.vehicleTypes, id],
    }));
  };

  const depositPreview = pkgForm.price && pkgForm.depositPercent
    ? Math.round((parseFloat(pkgForm.price) * parseInt(pkgForm.depositPercent)) / 100)
    : 0;

  // Compute the actual trial length (promo codes can extend it beyond 15 days)
  const trialDays = (() => {
    if (!user?.trialEndsAt) return 15;
    const diff = new Date(user.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 15;
  })();
  const trialLabel = trialDays >= 28 && trialDays <= 31
    ? "1-month"
    : trialDays >= 58 && trialDays <= 62
    ? "2-month"
    : trialDays >= 88 && trialDays <= 93
    ? "3-month"
    : `${trialDays}-day`;
  const trialLabelCapitalized = trialLabel.charAt(0).toUpperCase() + trialLabel.slice(1);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Logo size="sm" href="/" darkText />
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 hidden sm:block">Step {step + 1} of {STEPS.length}</span>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 font-medium transition-colors">
              Skip setup →
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-2xl">

          {/* Progress stepper */}
          <div className="mb-8">
            <div className="flex items-center">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold transition-all duration-300 shadow-sm ${
                      i < step
                        ? "bg-green-500 text-white shadow-green-200"
                        : i === step
                        ? "bg-blue-600 text-white shadow-blue-200"
                        : "bg-white border-2 border-gray-200 text-gray-400"
                    }`}>
                      {i < step ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-base">{s.icon}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold hidden sm:block text-center ${
                      i === step ? "text-blue-600" : i < step ? "text-green-600" : "text-gray-400"
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300 ${i < step ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── STEP 1: Business Details ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-xl">🏢</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Your Business Details</h1>
                    <p className="text-gray-400 text-sm">This will appear on your public booking page.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleStep1} className="px-8 py-7 space-y-5">
                {/* Business Name + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bizForm.businessName}
                      onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
                      placeholder="e.g. Mike's Mobile Detailing"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Business Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={bizForm.email}
                      onChange={(e) => setBizForm({ ...bizForm, email: e.target.value })}
                      placeholder="mike@yourbusiness.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={bizForm.phone}
                      onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bizForm.address}
                    onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                  />
                </div>

                {/* City / State / ZIP */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={bizForm.city}
                      onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                      placeholder="Miami"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">State</label>
                    <select
                      value={bizForm.state}
                      onChange={(e) => setBizForm({ ...bizForm, state: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                    >
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ZIP Code</label>
                    <input
                      type="text"
                      value={bizForm.zip}
                      onChange={(e) => setBizForm({ ...bizForm, zip: e.target.value })}
                      placeholder="33101"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    How do you operate? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: "mobile", icon: "🚗", label: "Mobile Service", desc: "I go to customers" },
                      { value: "shop",   icon: "🏪", label: "Shop / Location", desc: "Customers come to me" },
                      { value: "both",   icon: "⚡", label: "Both",            desc: "Shop + mobile" },
                    ] as const).map(({ value, icon, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBizForm({ ...bizForm, serviceType: value })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                          bizForm.serviceType === value
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-gray-50 hover:border-blue-300"
                        }`}
                      >
                        <span className="text-2xl">{icon}</span>
                        <span className={`text-xs font-bold ${bizForm.serviceType === value ? "text-blue-700" : "text-gray-700"}`}>{label}</span>
                        <span className="text-[10px] text-gray-400">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200"
                  >
                    {saving ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                    ) : (
                      <>Continue to First Package <span>→</span></>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STEP 2: First Package ────────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl">📦</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Create Your First Package</h1>
                    <p className="text-gray-400 text-sm">Customers will choose from your packages when booking. You can add more later.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleStep2} className="px-8 py-7 space-y-6">
                {/* Package Name + Description */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Package Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={pkgForm.name}
                      onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                      placeholder="e.g. Full Interior & Exterior Detail"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={pkgForm.description}
                      onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                      placeholder="Describe what's included in this package — customers read this before booking."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Price / Duration / Deposit */}
                <div>
                  <h3 className="text-sm font-black text-gray-700 mb-3 uppercase tracking-wide">Pricing & Duration</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        Price (USD) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">$</span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={pkgForm.price}
                          onChange={(e) => setPkgForm({ ...pkgForm, price: e.target.value })}
                          placeholder="199"
                          className="w-full pl-8 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Duration</label>
                      <select
                        value={pkgForm.duration}
                        onChange={(e) => setPkgForm({ ...pkgForm, duration: e.target.value })}
                        className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                      >
                        {[30,60,90,120,150,180,210,240,300,360,480].map((m) => (
                          <option key={m} value={m}>
                            {m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60 > 0 ? `${m%60}m` : ""}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Deposit %</label>
                      <select
                        value={pkgForm.depositPercent}
                        onChange={(e) => setPkgForm({ ...pkgForm, depositPercent: e.target.value })}
                        className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                      >
                        <option value="0">No Deposit</option>
                        {[10,15,20,25,30,40,50].map((p) => (
                          <option key={p} value={p}>{p}%</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Deposit preview */}
                  {depositPreview > 0 && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Customers will pay a <strong>${depositPreview}</strong> deposit to confirm booking</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vehicle Types */}
                <div>
                  <h3 className="text-sm font-black text-gray-700 mb-1 uppercase tracking-wide">
                    Vehicle Types Included
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">Select which vehicle types this package applies to. Leave blank for all types.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {VEHICLE_TYPES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => toggleVehicleType(v.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          pkgForm.vehicleTypes.includes(v.id)
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <span className="text-base">{v.icon}</span>
                        <span className="text-xs">{v.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Included / Not Included */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      What&apos;s Included <span className="text-gray-400 font-normal text-xs">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={pkgForm.includedServices}
                      onChange={(e) => setPkgForm({ ...pkgForm, includedServices: e.target.value })}
                      placeholder={"Exterior hand wash\nInterior vacuum\nDash wipe down\nWindow cleaning"}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-xs transition-all resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">One item per line</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Not Included <span className="text-gray-400 font-normal text-xs">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={pkgForm.notIncluded}
                      onChange={(e) => setPkgForm({ ...pkgForm, notIncluded: e.target.value })}
                      placeholder={"Paint correction\nCeramic coating\nEngine bay cleaning"}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-xs transition-all resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">One item per line</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 border border-gray-200 bg-white text-gray-600 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200"
                  >
                    {saving ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                    ) : (
                      <>Save Package & Continue →</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STEP 3: Choose Plan ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center text-xl">💎</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Choose Your Plan</h1>
                    <p className="text-gray-400 text-sm">Your {trialLabel} free trial includes all features. Pick the plan you want after.</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-7">
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  {/* Starter */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("starter")}
                    className={`text-left rounded-2xl border-2 p-5 transition-all ${
                      selectedPlan === "starter"
                        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
                        : "border-gray-200 bg-gray-50 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-black text-gray-900 text-lg">Starter</span>
                      <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        selectedPlan === "starter" ? "border-blue-500 bg-blue-500" : "border-gray-300"
                      }`}>
                        {selectedPlan === "starter" && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <span className="text-3xl font-black text-gray-900">$29</span>
                      <span className="text-gray-400 text-sm">/month</span>
                    </div>
                    <p className="text-gray-500 text-xs mb-4">Perfect for solo detailers just getting started.</p>
                    <ul className="space-y-2">
                      {[
                        "Custom booking page",
                        "Up to 5 service packages",
                        "Deposit collection",
                        "Email reminders",
                        "Calendar dashboard",
                        "Analytics overview",
                        "Before/after photo upload",
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>

                  {/* Pro */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("pro")}
                    className={`text-left rounded-2xl border-2 p-5 relative transition-all ${
                      selectedPlan === "pro"
                        ? "border-blue-500 bg-gradient-to-b from-blue-600 to-indigo-700 shadow-lg shadow-blue-200"
                        : "border-blue-300 bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                    }`}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-[10px] font-black px-3 py-1 rounded-full shadow-md">
                        RECOMMENDED
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-black text-white text-lg">Pro</span>
                      <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        selectedPlan === "pro" ? "border-white bg-white" : "border-white/50"
                      }`}>
                        {selectedPlan === "pro" && (
                          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <span className="text-3xl font-black text-white">$50</span>
                      <span className="text-blue-200 text-sm">/month</span>
                    </div>
                    <p className="text-blue-200 text-xs mb-4">For serious detailers ready to scale their business.</p>
                    <ul className="space-y-2">
                      {[
                        "Everything in Starter",
                        "SMS reminders",
                        "Multiple staff & calendars",
                        "Google Calendar sync",
                        "Advanced analytics",
                        "Review request automation",
                        "Priority support",
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-white">
                          <svg className="w-3.5 h-3.5 text-blue-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Your <strong className="text-gray-700">{trialLabel} free trial</strong> starts on the Starter plan. You won&apos;t be charged until your trial ends and you choose to continue. Cancel anytime.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 border border-gray-200 bg-white text-gray-600 font-semibold py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                  >
                    ← Back
                  </button>
                  <div className="flex-[2] flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handlePayNow}
                      disabled={!selectedPlan || saving}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200 disabled:shadow-none"
                    >
                      {saving ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Loading...</>
                      ) : !selectedPlan ? (
                        "Select a plan to continue"
                      ) : (
                        <>💳 Pay Now — ${selectedPlan === "starter" ? "29" : "50"}/mo</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleStep3}
                      disabled={!selectedPlan || saving}
                      className="w-full bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-semibold py-3 rounded-xl transition-all text-sm"
                    >
                      {!selectedPlan ? "Select a plan first" : `Start ${trialLabelCapitalized} Free Trial →`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Booking Page Ready ───────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-10 pb-6 text-center">
                {/* Animated checkmark */}
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                <h1 className="text-2xl font-black text-gray-900 mb-2">You&apos;re all set! 🎉</h1>
                <p className="text-gray-400 text-sm mb-2">
                  Your booking page is live. Start sharing it with customers!
                </p>
                {selectedPlan && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                    selectedPlan === "pro"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {selectedPlan === "pro" ? "💎 Pro Plan" : "⚡ Starter Plan"} · {trialLabel} free trial active
                  </span>
                )}
              </div>

              <div className="px-8 pb-8">
                {/* Booking URL */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-5">
                  <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider">Your Booking Link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-blue-600 font-mono truncate">{bookingUrl}</code>
                    <button
                      onClick={handleCopy}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                        copied
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                      }`}
                    >
                      {copied ? "✓ Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* Checklist */}
                <div className="grid sm:grid-cols-3 gap-3 mb-6">
                  {[
                    { icon: "✅", label: "Booking page live" },
                    { icon: "📦", label: "First package created" },
                    { icon: "🎯", label: `Trial active (${trialDays} days)` },
                  ].map(({ icon, label }) => (
                    <div key={label} className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <span className="text-lg">{icon}</span>
                      <span className="text-xs font-semibold text-green-700">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <Link
                    href={`/book/${user?.slug}`}
                    target="_blank"
                    className="flex items-center justify-center gap-2 w-full border-2 border-blue-200 text-blue-600 font-bold py-3.5 rounded-xl hover:bg-blue-50 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview Your Booking Page
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    Go to Dashboard →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-5 px-4 bg-white">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="xs" href="/" darkText />
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} DetailBook · The booking platform for auto detailers
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-gray-600 transition-colors">Terms</a>
            <a href="/refund" className="hover:text-gray-600 transition-colors">Refund</a>
            <a href="/dashboard" className="hover:text-gray-600 transition-colors">Dashboard</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
