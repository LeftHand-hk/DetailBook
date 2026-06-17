"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { VEHICLE_TYPES, type VehicleTypeId } from "@/lib/vehicle-pricing";
import { getUser, isLoggedIn, setUser, syncFromServer } from "@/lib/storage";
import type { PackageAddon, PackageVehiclePricing, User } from "@/types";

const STEPS = [
  { id: 0, label: "Business Details", icon: "01" },
  { id: 1, label: "First Package", icon: "02" },
  { id: 2, label: "Booking Link", icon: "03" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

type ServiceType = "mobile" | "shop" | "both";
type PackageStage = "details" | "vehicles" | "addons" | "saved";

type AddonDraft = {
  id: string;
  name: string;
  price: string;
  description: string;
};

const newAddon = (): AddonDraft => ({
  id: `addon_${Math.random().toString(36).slice(2, 9)}`,
  name: "",
  price: "",
  description: "",
});

const emptyPackageForm = () => ({
  name: "",
  description: "",
  price: "",
});

const defaultVehiclePricing = (): PackageVehiclePricing[] => (
  VEHICLE_TYPES.map((vehicle) => ({ type: vehicle.id, surcharge: 0 }))
);

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [user, setUserState] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [packageError, setPackageError] = useState("");
  const [packageStage, setPackageStage] = useState<PackageStage>("details");
  const [createdPackageCount, setCreatedPackageCount] = useState(0);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);
  const [vehiclePricing, setVehiclePricing] = useState<PackageVehiclePricing[]>(defaultVehiclePricing);
  const [addons, setAddons] = useState<AddonDraft[]>([newAddon()]);

  const [bizForm, setBizForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "FL",
    zip: "",
    serviceArea: "",
    serviceType: "mobile" as ServiceType,
  });

  const firedLeadRef = useRef(false);
  const stepResolved = useRef(false);
  const LEAD_KEY = "dB_fired_lead";

  const hasFired = (key: string): boolean => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  };

  const markFired = (key: string): void => {
    if (typeof window === "undefined") return;
    try { sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
  };

  const fireLeadOnce = () => {
    if (firedLeadRef.current) return;
    if (hasFired(LEAD_KEY)) { firedLeadRef.current = true; return; }
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    firedLeadRef.current = true;
    markFired(LEAD_KEY);
    window.fbq("track", "Lead", {
      content_name: "DetailBook Business Details",
      value: 0,
      currency: "USD",
    });
  };

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }

    const applyUser = (u: User | null) => {
      if (!u) return;
      setUserState(u);
      setBizForm((prev) => ({
        ...prev,
        businessName: u.businessName || prev.businessName,
        email: u.email || prev.email,
        phone: u.phone || prev.phone,
        address: u.address || prev.address,
        city: u.city || prev.city,
        serviceArea: Array.isArray(u.serviceAreas) && u.serviceAreas[0] ? u.serviceAreas[0] : prev.serviceArea,
        serviceType: (u.serviceType as ServiceType) || prev.serviceType,
      }));

      if (!stepResolved.current) {
        stepResolved.current = true;
        const phone = (u.phone || "").trim();
        const address = (u.address || "").trim();
        const firstServiceArea = Array.isArray(u.serviceAreas) && u.serviceAreas[0] ? String(u.serviceAreas[0]).trim() : "";
        if (phone || address || firstServiceArea) setStep(1);
      }
    };

    const cached = getUser();
    applyUser(cached);

    if (!cached?.businessName) {
      syncFromServer()
        .then(() => applyUser(getUser()))
        .catch(() => { /* form falls back to manual entry */ });
    }
  }, [router]);

  const showShopFields = bizForm.serviceType === "shop" || bizForm.serviceType === "both";
  const showMobileFields = bizForm.serviceType === "mobile" || bizForm.serviceType === "both";

  const bookingUrl = user
    ? `${typeof window !== "undefined" ? window.location.origin : "https://detailbookapp.com"}/book/${user.slug}`
    : "";

  const handleCopy = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);

    const slug = bizForm.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const isMobileOnly = bizForm.serviceType === "mobile";
    const fullAddress = isMobileOnly
      ? bizForm.serviceArea.trim()
      : `${bizForm.address}, ${bizForm.city}, ${bizForm.state} ${bizForm.zip}`.trim();

    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: bizForm.businessName,
          phone: bizForm.phone,
          city: isMobileOnly ? bizForm.city : `${bizForm.city}, ${bizForm.state}`,
          address: fullAddress,
          serviceType: bizForm.serviceType,
          serviceAreas: bizForm.serviceArea ? [bizForm.serviceArea.trim()] : undefined,
          slug,
        }),
      });

      if (res.ok) {
        await syncFromServer();
        const freshUser = getUser();
        if (freshUser) setUserState(freshUser);
      } else if (user) {
        const updated = { ...user, ...bizForm, address: fullAddress, slug };
        setUser(updated);
        setUserState(updated);
      }
    } catch {
      if (user) {
        const updated = { ...user, ...bizForm, address: fullAddress, slug };
        setUser(updated);
        setUserState(updated);
      }
    }

    setSavingBusiness(false);
    fireLeadOnce();
    setStep(1);
  };

  const handlePackageDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPackageError("");
    setPackageStage("vehicles");
  };

  const selectedVehicleIds = new Set(vehiclePricing.map((entry) => entry.type));

  const toggleVehicle = (id: VehicleTypeId) => {
    setVehiclePricing((current) => {
      if (current.some((entry) => entry.type === id)) {
        const next = current.filter((entry) => entry.type !== id);
        return next.length ? next : current;
      }
      return [...current, { type: id, surcharge: 0 }];
    });
  };

  const updateVehicleSurcharge = (id: VehicleTypeId, value: string) => {
    const parsed = parseFloat(value);
    const surcharge = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setVehiclePricing((current) => current.map((entry) => (
      entry.type === id ? { ...entry, surcharge } : entry
    )));
  };

  const updateAddon = (id: string, data: Partial<AddonDraft>) => {
    setAddons((current) => current.map((addon) => (
      addon.id === id ? { ...addon, ...data } : addon
    )));
  };

  const removeAddon = (id: string) => {
    setAddons((current) => current.length > 1 ? current.filter((addon) => addon.id !== id) : [newAddon()]);
  };

  const addAddonRow = () => {
    setAddons((current) => [...current, newAddon()]);
  };

  const buildAddonsPayload = (): PackageAddon[] => addons
    .map((addon) => ({
      id: addon.id,
      name: addon.name.trim(),
      price: Number.parseFloat(addon.price || "0"),
      description: addon.description.trim(),
    }))
    .filter((addon) => addon.name && Number.isFinite(addon.price) && addon.price >= 0)
    .map((addon) => ({
      id: addon.id,
      name: addon.name,
      price: Math.round(addon.price * 100) / 100,
      ...(addon.description ? { description: addon.description } : {}),
    }));

  const savePackage = async (includeAddons: boolean) => {
    setPackageError("");
    setSavingPackage(true);

    const price = Number.parseFloat(packageForm.price);
    if (!packageForm.name.trim() || !packageForm.description.trim() || !Number.isFinite(price) || price < 0) {
      setSavingPackage(false);
      setPackageError("Add a package name, description, and valid price.");
      setPackageStage("details");
      return;
    }

    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: packageForm.name.trim(),
          description: packageForm.description.trim(),
          price,
          duration: 120,
          active: true,
          vehiclePricing,
          addons: includeAddons ? buildAddonsPayload() : [],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not save package.");
      }

      setCreatedPackageCount((count) => count + 1);
      await syncFromServer().catch(() => {});
      setPackageStage("saved");
    } catch (err) {
      setPackageError(err instanceof Error ? err.message : "Could not save package.");
    } finally {
      setSavingPackage(false);
    }
  };

  const resetPackageBuilder = () => {
    setPackageForm(emptyPackageForm());
    setVehiclePricing(defaultVehiclePricing());
    setAddons([newAddon()]);
    setPackageError("");
    setPackageStage("details");
  };

  const finishOnboarding = () => {
    try { sessionStorage.setItem("dB_showTour", "1"); } catch { /* private mode */ }
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Logo size="sm" href="/" darkText />
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-700">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <div className="flex items-center">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-300 shadow-sm ${
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
                      ) : s.icon}
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

          {step === 0 && (
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-sm font-black text-blue-700">01</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Your Business Details</h1>
                    <p className="text-gray-400 text-sm">This will appear on your public booking page.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleBusinessSubmit} className="px-8 py-7 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    How do you operate? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { value: "mobile", label: "Mobile Service", desc: "I go to customers" },
                      { value: "shop", label: "Shop / Location", desc: "Customers come to me" },
                      { value: "both", label: "Both", desc: "Shop and mobile" },
                    ] as const).map(({ value, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBizForm({ ...bizForm, serviceType: value })}
                        className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                          bizForm.serviceType === value
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-gray-50 hover:border-blue-300"
                        }`}
                      >
                        <span className={`text-xs font-bold ${bizForm.serviceType === value ? "text-blue-700" : "text-gray-700"}`}>{label}</span>
                        <span className="text-[10px] text-gray-400">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

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

                  <div className="sm:col-span-2">
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

                {showShopFields && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Street Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={showShopFields}
                        value={bizForm.address}
                        onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                        placeholder="123 Main Street"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          City <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={showShopFields}
                          value={bizForm.city}
                          onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                          placeholder="Miami"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          State <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={bizForm.state}
                          onChange={(e) => setBizForm({ ...bizForm, state: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                        >
                          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                          ZIP Code <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={showShopFields}
                          value={bizForm.zip}
                          onChange={(e) => setBizForm({ ...bizForm, zip: e.target.value })}
                          placeholder="33101"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {showMobileFields && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Service Area <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required={showMobileFields}
                        value={bizForm.serviceArea}
                        onChange={(e) => setBizForm({ ...bizForm, serviceArea: e.target.value })}
                        placeholder="e.g. Miami and surrounding areas"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5">Where you travel to. Shown to customers on your booking page.</p>
                    </div>

                    {bizForm.serviceType === "mobile" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            City <span className="text-gray-400 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={bizForm.city}
                            onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                            placeholder="Miami"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            State <span className="text-gray-400 font-normal">(optional)</span>
                          </label>
                          <select
                            value={bizForm.state}
                            onChange={(e) => setBizForm({ ...bizForm, state: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm transition-all"
                          >
                            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button
                  type="submit"
                  disabled={savingBusiness}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200"
                >
                  {savingBusiness ? <SpinnerText label="Saving..." /> : <>Continue</>}
                </button>
              </form>
            </section>
          )}

          {step === 1 && (
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-50">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-sm font-black text-blue-700">02</div>
                  <div>
                    <h1 className="text-xl font-black text-gray-900">Add Your First Package</h1>
                    <p className="text-gray-400 text-sm">Start with one service. You can add the rest from the dashboard.</p>
                  </div>
                </div>
              </div>

              <div className="px-8 py-7">
                <PackageStageBar stage={packageStage} />

                {packageError && (
                  <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                    {packageError}
                  </div>
                )}

                {packageStage === "details" && (
                  <form onSubmit={handlePackageDetailsSubmit} className="space-y-5 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Package Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={packageForm.name}
                        onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                        placeholder="Full Interior Detail"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={packageForm.description}
                        onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                        placeholder="Deep clean of seats, carpets, mats, panels, dashboard, and windows."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Starting Price <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={packageForm.price}
                          onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                          placeholder="150"
                          className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all text-sm shadow-lg shadow-blue-200"
                    >
                      Continue to vehicle pricing
                    </button>
                  </form>
                )}

                {packageStage === "vehicles" && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <h2 className="text-lg font-black text-gray-900">This package is for</h2>
                      <p className="text-sm text-gray-500 mt-1">Choose the vehicle types customers can book, then add any extra price for larger vehicles.</p>
                    </div>

                    <div className="space-y-3">
                      {VEHICLE_TYPES.map((vehicle) => {
                        const selected = selectedVehicleIds.has(vehicle.id);
                        const entry = vehiclePricing.find((item) => item.type === vehicle.id);
                        return (
                          <div
                            key={vehicle.id}
                            className={`grid grid-cols-[1fr_auto] gap-3 items-center rounded-2xl border p-3 transition-all ${
                              selected ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleVehicle(vehicle.id)}
                              className="flex items-center gap-3 text-left"
                            >
                              <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300"
                              }`}>
                                {selected && (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span>
                                <span className="block text-sm font-bold text-gray-900">{vehicle.label}</span>
                                <span className="block text-xs text-gray-500">{selected ? "Shown on booking page" : "Not available for this package"}</span>
                              </span>
                            </button>

                            {selected && (
                              <label className="flex items-center gap-1 text-xs font-bold text-gray-500">
                                +$
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={entry?.surcharge ?? 0}
                                  onChange={(e) => updateVehicleSurcharge(vehicle.id, e.target.value)}
                                  className="w-20 px-2 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setPackageStage("details")}
                        className="sm:w-36 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackageStage("addons")}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-200"
                      >
                        Continue to add-ons
                      </button>
                    </div>
                  </div>
                )}

                {packageStage === "addons" && (
                  <div className="space-y-5 animate-fadeIn">
                    <div>
                      <h2 className="text-lg font-black text-gray-900">Add-ons</h2>
                      <p className="text-sm text-gray-500 mt-1">Optional extras customers can add when they book this package.</p>
                    </div>

                    <div className="space-y-3">
                      {addons.map((addon) => (
                        <div key={addon.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3">
                            <input
                              type="text"
                              value={addon.name}
                              onChange={(e) => updateAddon(addon.id, { name: e.target.value })}
                              placeholder="Pet hair removal"
                              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-sm transition-all"
                            />
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={addon.price}
                                onChange={(e) => updateAddon(addon.id, { price: e.target.value })}
                                placeholder="25"
                                className="w-full pl-7 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-sm transition-all"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAddon(addon.id)}
                              className="px-3 py-2.5 bg-white border border-gray-200 hover:border-red-200 hover:text-red-600 rounded-xl text-gray-500 font-bold text-sm transition-colors"
                              aria-label="Remove add-on"
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            value={addon.description}
                            onChange={(e) => updateAddon(addon.id, { description: e.target.value })}
                            placeholder="Short description, optional"
                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-sm transition-all"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addAddonRow}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                    >
                      Add another add-on
                    </button>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setPackageStage("vehicles")}
                        disabled={savingPackage}
                        className="sm:w-28 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => savePackage(false)}
                        disabled={savingPackage}
                        className="sm:w-40 bg-white border border-gray-200 hover:bg-gray-50 disabled:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Skip add-ons
                      </button>
                      <button
                        type="button"
                        onClick={() => savePackage(true)}
                        disabled={savingPackage}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-200"
                      >
                        {savingPackage ? <SpinnerText label="Saving package..." /> : "Save package"}
                      </button>
                    </div>
                  </div>
                )}

                {packageStage === "saved" && (
                  <div className="text-center animate-fadeIn">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">
                      Package added
                    </h2>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      Your booking page now has {createdPackageCount === 1 ? "a service customers can book" : `${createdPackageCount} services customers can book`}.
                    </p>

                    <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={resetPackageBuilder}
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        Add more packages
                      </button>
                      <button
                        type="button"
                        onClick={finishOnboarding}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-lg shadow-blue-200"
                      >
                        Skip for now
                      </button>
                    </div>

                    <p className="text-xs text-gray-400 mt-3">
                      You can add more packages anytime from the dashboard.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 pt-10 pb-6 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h1 className="text-2xl font-black text-gray-900 mb-2">
                  Your booking page is ready
                </h1>
                <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto leading-relaxed">
                  Share this link with customers. In the dashboard you can edit every text section, add your logo, upload images, customize the booking page, and add more packages.
                </p>
              </div>

              <div className="px-8 pb-8 space-y-5">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider">Your Booking Link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-blue-600 font-mono truncate">{bookingUrl}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                        copied
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                      }`}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/dashboard/booking-page"
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-lg shadow-blue-200"
                  >
                    Edit booking page
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    Go to dashboard
                  </Link>
                </div>

                <Link
                  href={user?.slug ? `/book/${user.slug}` : "/dashboard"}
                  target={user?.slug ? "_blank" : undefined}
                  className="flex items-center justify-center w-full text-sm font-bold text-blue-700 hover:text-blue-800"
                >
                  Preview public booking page
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-100 py-5 px-4 bg-white">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="xs" href="/" darkText />
          <p className="text-xs text-gray-400">
            (c) {new Date().getFullYear()} DetailBook - The booking platform for auto detailers
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

function PackageStageBar({ stage }: { stage: PackageStage }) {
  const stages: Array<{ id: PackageStage; label: string }> = [
    { id: "details", label: "Details" },
    { id: "vehicles", label: "Vehicles" },
    { id: "addons", label: "Add-ons" },
    { id: "saved", label: "Done" },
  ];
  const currentIndex = stages.findIndex((item) => item.id === stage);

  return (
    <div className="mb-6 grid grid-cols-4 gap-2">
      {stages.map((item, index) => (
        <div key={item.id} className={`h-1.5 rounded-full transition-colors ${
          index <= currentIndex ? "bg-blue-600" : "bg-gray-200"
        }`}>
          <span className="sr-only">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function SpinnerText({ label }: { label: string }) {
  return (
    <>
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label}
    </>
  );
}
