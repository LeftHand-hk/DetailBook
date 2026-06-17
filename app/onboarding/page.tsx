"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { VehicleIcon } from "@/components/VehicleIcon";
import { VEHICLE_TYPES, type VehicleTypeId } from "@/lib/vehicle-pricing";
import { getUser, isLoggedIn, setUser, syncFromServer } from "@/lib/storage";
import type { PackageVehiclePricing, User } from "@/types";

const STEPS = [
  {
    label: "Business",
    title: "Tell customers where you work",
    body: "A few details make your booking page feel real right away.",
  },
  {
    label: "Package",
    title: "Add one bookable service",
    body: "Start with your easiest package. You can refine everything later.",
  },
  {
    label: "Live Link",
    title: "Your booking page is ready",
    body: "Share it, preview it, or keep customizing from the dashboard.",
  },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const PACKAGE_IDEAS = [
  {
    name: "Full Detail",
    description: "Interior and exterior clean with wheels, glass, trim, vacuum, wipe-down, and final finish.",
    price: "249",
  },
  {
    name: "Interior Reset",
    description: "Deep interior clean for seats, carpets, mats, panels, dashboard, cupholders, and windows.",
    price: "149",
  },
  {
    name: "Wash and Wax",
    description: "Exterior hand wash, wheels, tires, glass, light decontamination, and protective wax finish.",
    price: "119",
  },
];

type ServiceType = "mobile" | "shop" | "both";
type PackageStage = "form" | "saved";

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
  const [packageStage, setPackageStage] = useState<PackageStage>("form");
  const [createdPackageCount, setCreatedPackageCount] = useState(0);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);
  const [vehiclePricing, setVehiclePricing] = useState<PackageVehiclePricing[]>(defaultVehiclePricing);

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
  const selectedVehicleIds = new Set(vehiclePricing.map((entry) => entry.type));
  const activeStep = STEPS[step];

  const bookingUrl = user
    ? `${typeof window !== "undefined" ? window.location.origin : "https://detailbookapp.com"}/book/${user.slug}`
    : "";

  const locationPreview = bizForm.serviceArea || bizForm.city || "Your service area";
  const businessPreview = bizForm.businessName || "Your Detailing Business";
  const packagePreview = packageForm.name || "Full Detail";
  const pricePreview = packageForm.price || "149";

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

  const savePackage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPackageError("");
    setSavingPackage(true);

    const price = Number.parseFloat(packageForm.price);
    if (!packageForm.name.trim() || !packageForm.description.trim() || !Number.isFinite(price) || price < 0) {
      setSavingPackage(false);
      setPackageError("Add a package name, description, and valid price.");
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
          addons: [],
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
    setPackageError("");
    setPackageStage("form");
  };

  const finishOnboarding = () => {
    try { sessionStorage.setItem("dB_showTour", "1"); } catch { /* private mode */ }
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-[#eef4fb] text-gray-950">
      <header className="px-4 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Logo size="sm" href="/" darkText />
          <div className="hidden sm:flex items-center gap-2 text-xs font-black text-blue-700 bg-white/80 border border-blue-100 rounded-full px-3 py-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Booking page setup
          </div>
        </div>
      </header>

      <main className="px-4 pb-10">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-start">
          <aside className="lg:sticky lg:top-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-gray-950 text-white p-6 sm:p-8 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.35),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(20,184,166,0.24),transparent_30%)]" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-bold text-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
                  Live preview
                </div>
                <h1 className="mt-5 text-3xl sm:text-4xl font-black leading-tight">
                  Build the page customers will book from.
                </h1>
                <p className="mt-3 text-sm sm:text-base text-blue-100/80 leading-relaxed">
                  Every answer you add shows up as a real booking experience. Keep it simple, get live, improve later.
                </p>

                <div className="mt-7 rounded-[1.5rem] bg-white text-gray-950 p-4 shadow-2xl border border-white/50">
                  <div className="h-28 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 p-4 flex flex-col justify-end">
                    <p className="text-white/75 text-xs font-bold uppercase tracking-wider">{locationPreview}</p>
                    <p className="text-white text-xl font-black truncate">{businessPreview}</p>
                  </div>
                  <div className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Featured service</p>
                        <h2 className="text-lg font-black text-gray-950 truncate">{packagePreview}</h2>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {packageForm.description || "Your package description will help customers choose with confidence."}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-gray-400 font-bold">from</p>
                        <p className="text-2xl font-black text-gray-950">${pricePreview}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {vehiclePricing.slice(0, 4).map((entry) => {
                        const vehicle = VEHICLE_TYPES.find((v) => v.id === entry.type);
                        if (!vehicle) return null;
                        return (
                          <span key={entry.type} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700">
                            <VehicleIcon type={vehicle.id} className="w-3.5 h-3.5" />
                            {vehicle.label.split(" ")[0]}
                            {entry.surcharge > 0 ? ` +$${entry.surcharge}` : ""}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-xl bg-gray-950 text-white text-center py-3 text-sm font-black">
                      Book Now
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  {STEPS.map((item, index) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border px-3 py-3 ${
                        index === step
                          ? "bg-white text-gray-950 border-white"
                          : index < step
                          ? "bg-green-400/15 text-green-100 border-green-300/20"
                          : "bg-white/5 text-white/55 border-white/10"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider">0{index + 1}</p>
                      <p className="text-xs font-bold mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="bg-white rounded-[2rem] border border-gray-200/80 shadow-xl shadow-blue-950/5 overflow-hidden">
            <div className="px-5 sm:px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{activeStep.label}</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-black text-gray-950 leading-tight">{activeStep.title}</h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{activeStep.body}</p>
              </div>
              <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 items-center justify-center font-black">
                0{step + 1}
              </div>
            </div>

            {step === 0 && (
              <form onSubmit={handleBusinessSubmit} className="p-5 sm:p-8 space-y-6 animate-fadeIn">
                <div>
                  <label className="block text-sm font-black text-gray-800 mb-3">How do customers reach you?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { value: "mobile", icon: "mobile", label: "Mobile", desc: "I go to them" },
                      { value: "shop", icon: "shop", label: "Shop", desc: "They come to me" },
                      { value: "both", icon: "both", label: "Both", desc: "Flexible booking" },
                    ] as const).map(({ value, icon, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBizForm({ ...bizForm, serviceType: value })}
                        className={`group min-h-[120px] rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${
                          bizForm.serviceType === value
                            ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
                            : "border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-white"
                        }`}
                      >
                        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          bizForm.serviceType === value ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200 group-hover:text-blue-600"
                        }`}>
                          <OperationIcon type={icon} />
                        </span>
                        <span className="block mt-3 text-sm font-black text-gray-950">{label}</span>
                        <span className="block text-xs text-gray-500">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Business name" required>
                    <input
                      type="text"
                      required
                      value={bizForm.businessName}
                      onChange={(e) => setBizForm({ ...bizForm, businessName: e.target.value })}
                      placeholder="Mike's Mobile Detailing"
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Phone number" required>
                    <input
                      type="tel"
                      required
                      value={bizForm.phone}
                      onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      className={INPUT_CLASS}
                    />
                  </Field>
                </div>

                {showMobileFields && (
                  <Field label="Service area" required>
                    <input
                      type="text"
                      required={showMobileFields}
                      value={bizForm.serviceArea}
                      onChange={(e) => setBizForm({ ...bizForm, serviceArea: e.target.value })}
                      placeholder="Miami and surrounding areas"
                      className={INPUT_CLASS}
                    />
                  </Field>
                )}

                {bizForm.serviceType === "mobile" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="City">
                      <input
                        type="text"
                        value={bizForm.city}
                        onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                        placeholder="Miami"
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="State">
                      <StateSelect value={bizForm.state} onChange={(state) => setBizForm({ ...bizForm, state })} />
                    </Field>
                  </div>
                )}

                {showShopFields && (
                  <>
                    <Field label="Shop address" required>
                      <input
                        type="text"
                        required={showShopFields}
                        value={bizForm.address}
                        onChange={(e) => setBizForm({ ...bizForm, address: e.target.value })}
                        placeholder="123 Main Street"
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Field label="City" required>
                        <input
                          type="text"
                          required={showShopFields}
                          value={bizForm.city}
                          onChange={(e) => setBizForm({ ...bizForm, city: e.target.value })}
                          placeholder="Miami"
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <Field label="State" required>
                        <StateSelect value={bizForm.state} onChange={(state) => setBizForm({ ...bizForm, state })} />
                      </Field>
                      <Field label="ZIP" required className="col-span-2 sm:col-span-1">
                        <input
                          type="text"
                          required={showShopFields}
                          value={bizForm.zip}
                          onChange={(e) => setBizForm({ ...bizForm, zip: e.target.value })}
                          placeholder="33101"
                          className={INPUT_CLASS}
                        />
                      </Field>
                    </div>
                  </>
                )}

                <PrimaryButton disabled={savingBusiness}>
                  {savingBusiness ? <SpinnerText label="Saving..." /> : "Continue"}
                </PrimaryButton>
              </form>
            )}

            {step === 1 && (
              <div className="p-5 sm:p-8 animate-fadeIn">
                {packageStage === "form" ? (
                  <form onSubmit={savePackage} className="space-y-6">
                    {packageError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                        {packageError}
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-black text-gray-800 mb-3">Start with a proven package</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {PACKAGE_IDEAS.map((idea) => (
                          <button
                            key={idea.name}
                            type="button"
                            onClick={() => setPackageForm(idea)}
                            className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 p-4 text-left transition-colors"
                          >
                            <span className="block text-sm font-black text-gray-950">{idea.name}</span>
                            <span className="block text-xs text-gray-500 mt-1">from ${idea.price}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-4">
                      <Field label="Package name" required>
                        <input
                          type="text"
                          required
                          value={packageForm.name}
                          onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                          placeholder="Full Detail"
                          className={INPUT_CLASS}
                        />
                      </Field>
                      <Field label="Price" required>
                        <CurrencyInput
                          value={packageForm.price}
                          onChange={(price) => setPackageForm({ ...packageForm, price })}
                          placeholder="149"
                        />
                      </Field>
                    </div>

                    <Field label="Description" required>
                      <textarea
                        required
                        rows={3}
                        value={packageForm.description}
                        onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                        placeholder="What is included in this package?"
                        className={`${INPUT_CLASS} resize-none`}
                      />
                    </Field>

                    <div>
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <p className="text-sm font-black text-gray-900">Vehicle pricing</p>
                          <p className="text-xs text-gray-500">Tap a vehicle to show or hide it. Add $10, $20, etc. for bigger vehicles.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {VEHICLE_TYPES.map((vehicle) => {
                          const selected = selectedVehicleIds.has(vehicle.id);
                          const entry = vehiclePricing.find((item) => item.type === vehicle.id);
                          return (
                            <VehiclePriceTile
                              key={vehicle.id}
                              vehicle={vehicle}
                              selected={selected}
                              surcharge={entry?.surcharge ?? 0}
                              onToggle={() => toggleVehicle(vehicle.id)}
                              onSurcharge={(value) => updateVehicleSurcharge(vehicle.id, value)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <PrimaryButton disabled={savingPackage}>
                      {savingPackage ? <SpinnerText label="Saving package..." /> : "Save package"}
                    </PrimaryButton>
                  </form>
                ) : (
                  <div className="text-center py-6 animate-fadeIn">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black text-gray-950">Package added</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto mt-2">
                      Your booking page now has {createdPackageCount === 1 ? "one service customers can book" : `${createdPackageCount} services customers can book`}.
                    </p>
                    <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={resetPackageBuilder}
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-black py-3.5 rounded-2xl transition-colors text-sm"
                      >
                        Add another package
                      </button>
                      <button
                        type="button"
                        onClick={finishOnboarding}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl transition-colors text-sm shadow-lg shadow-blue-200"
                      >
                        Continue
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">More packages can always be added from the dashboard.</p>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="p-5 sm:p-8 animate-fadeIn">
                <div className="rounded-3xl bg-gray-50 border border-gray-200 p-5">
                  <p className="text-[10px] text-gray-400 font-black mb-2 uppercase tracking-wider">Your Booking Link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-blue-700 font-mono truncate">{bookingUrl}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`flex-shrink-0 px-3 py-2 text-xs rounded-xl font-black transition-all ${
                        copied
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                      }`}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link
                    href="/dashboard/booking-page"
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl transition-colors text-sm shadow-lg shadow-blue-200"
                  >
                    Edit booking page
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-black py-3.5 rounded-2xl transition-colors text-sm"
                  >
                    Go to dashboard
                  </Link>
                </div>

                <Link
                  href={user?.slug ? `/book/${user.slug}` : "/dashboard"}
                  target={user?.slug ? "_blank" : undefined}
                  className="mt-4 flex items-center justify-center w-full text-sm font-black text-blue-700 hover:text-blue-800"
                >
                  Preview public booking page
                </Link>

                <div className="mt-6 rounded-3xl bg-blue-50 border border-blue-100 p-5">
                  <p className="font-black text-blue-950">Customize when you are ready</p>
                  <p className="text-sm text-blue-900/70 mt-1">
                    From the dashboard you can edit every text section, add your logo, upload images, change colors, collect reviews, and add more packages.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const INPUT_CLASS = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder-gray-400 text-sm transition-all";

function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-black text-gray-800 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    >
      {US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
    </select>
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">$</span>
      <input
        type="number"
        min="0"
        step="1"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT_CLASS} pl-8`}
      />
    </div>
  );
}

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-200"
    >
      {children}
    </button>
  );
}

function VehiclePriceTile({
  vehicle,
  selected,
  surcharge,
  onToggle,
  onSurcharge,
}: {
  vehicle: typeof VEHICLE_TYPES[number];
  selected: boolean;
  surcharge: number;
  onToggle: () => void;
  onSurcharge: (value: string) => void;
}) {
  return (
    <div className={`rounded-2xl border p-3 transition-all ${
      selected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-200 bg-gray-50"
    }`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 text-left">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          selected ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200"
        }`}>
          <VehicleIcon type={vehicle.id} className="w-6 h-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-gray-950 truncate">{vehicle.label}</span>
          <span className="block text-xs text-gray-500">{selected ? "Available" : "Tap to include"}</span>
        </span>
        <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${
          selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300"
        }`}>
          {selected && (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </button>

      {selected && (
        <label className="mt-3 flex items-center justify-between gap-3 text-xs font-black text-gray-500">
          Extra price
          <span className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={surcharge}
              onChange={(e) => onSurcharge(e.target.value)}
              className="w-24 pl-7 pr-2 py-2 bg-white border border-gray-200 rounded-xl text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </span>
        </label>
      )}
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

function OperationIcon({ type }: { type: "mobile" | "shop" | "both" }) {
  if (type === "shop") {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 10h16M5 10l1.4-5h11.2L19 10M6 10v9h12v-9M9 19v-5h6v5" />
      </svg>
    );
  }

  if (type === "both") {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 13h2l2-4h6l2 4h2M6 17h12M7 17a2 2 0 104 0M13 17a2 2 0 104 0M5 7h3M16 7h3M12 5v4" />
      </svg>
    );
  }

  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 14h2l2-4h8l2 4h2M6 17h12M7 17a2 2 0 104 0M13 17a2 2 0 104 0M9 10l1-3h4l1 3" />
    </svg>
  );
}
