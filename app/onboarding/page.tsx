"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { VehicleIcon } from "@/components/VehicleIcon";
import { VEHICLE_TYPES, type VehicleTypeId } from "@/lib/vehicle-pricing";
import { getUser, isLoggedIn, setUser, syncFromServer } from "@/lib/storage";
import type { PackageVehiclePricing, User } from "@/types";

const STEPS = [
  { label: "Business", title: "Set up your business", note: "What customers see first." },
  { label: "Package", title: "Create your first package", note: "One service is enough to go live." },
  { label: "Link", title: "Your booking page is ready", note: "Share it or customize it later." },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const PACKAGE_STARTERS = [
  {
    name: "Full Detail",
    price: "249",
    description: "Complete interior and exterior detail with wheels, glass, panels, vacuum, and final finish.",
  },
  {
    name: "Interior Detail",
    price: "149",
    description: "Deep interior clean for seats, carpets, mats, dash, panels, cupholders, and windows.",
  },
  {
    name: "Wash and Wax",
    price: "119",
    description: "Exterior hand wash, wheels, tires, glass, light decontamination, and wax protection.",
  },
];

type ServiceType = "mobile" | "shop" | "both";

const emptyPackageForm = () => ({
  name: "",
  description: "",
  price: "",
});

const defaultVehiclePricing = (): PackageVehiclePricing[] => (
  VEHICLE_TYPES.map((vehicle) => ({ type: vehicle.id, surcharge: 0 }))
);

const INPUT_CLASS = "w-full h-11 px-3.5 bg-white border border-gray-200 rounded-xl text-gray-950 text-sm placeholder-gray-400 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [user, setUserState] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [packageSaved, setPackageSaved] = useState(false);
  const [packageError, setPackageError] = useState("");
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
  const currentStep = STEPS[step];

  const bookingUrl = user
    ? `${typeof window !== "undefined" ? window.location.origin : "https://detailbookapp.com"}/book/${user.slug}`
    : "";

  const businessPreview = bizForm.businessName || "Your Detailing Business";
  const locationPreview = bizForm.serviceArea || bizForm.city || "Your service area";
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
      setPackageSaved(true);
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
    setPackageSaved(false);
  };

  const finishOnboarding = () => {
    try { sessionStorage.setItem("dB_showTour", "1"); } catch { /* private mode */ }
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-gray-950">
      <header className="bg-white/85 backdrop-blur border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Logo size="sm" href="/" darkText />
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Quick setup
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[360px_1fr] gap-5 items-start">
          <aside className="animate-fadeInUp">
            <div className="rounded-3xl bg-gray-950 text-white p-5 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Preview</p>
                  <h1 className="mt-1 text-xl font-black leading-tight">Your page taking shape</h1>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <OperationIcon type={bizForm.serviceType} className="w-6 h-6 text-cyan-200" />
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white text-gray-950 p-3 shadow-2xl">
                <div className="rounded-xl bg-gradient-to-br from-blue-700 to-cyan-500 p-4 min-h-[112px] flex flex-col justify-end">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/75">{locationPreview}</p>
                  <p className="text-lg font-black text-white truncate">{businessPreview}</p>
                </div>
                <div className="pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Package</p>
                      <p className="text-base font-black truncate">{packagePreview}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {packageForm.description || "Add a short description customers can understand fast."}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-400 font-bold">from</p>
                      <p className="text-xl font-black">${pricePreview}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {vehiclePricing.slice(0, 4).map((entry) => {
                      const vehicle = VEHICLE_TYPES.find((item) => item.id === entry.type);
                      if (!vehicle) return null;
                      return (
                        <span key={entry.type} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-700">
                          <VehicleIcon type={vehicle.id} className="w-3 h-3" />
                          {vehicle.label.split(" ")[0]}
                          {entry.surcharge > 0 ? ` +$${entry.surcharge}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {STEPS.map((item, index) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl px-3 py-2.5 border transition-all ${
                      index === step
                        ? "bg-white text-gray-950 border-white"
                        : index < step
                        ? "bg-emerald-400/15 text-emerald-100 border-emerald-300/20"
                        : "bg-white/5 text-white/55 border-white/10"
                    }`}
                  >
                    <p className="text-[10px] font-black">0{index + 1}</p>
                    <p className="text-xs font-bold">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-3xl bg-white border border-gray-200 shadow-xl shadow-blue-950/5 overflow-hidden animate-fadeInUp">
            <div className="px-5 sm:px-6 py-5 border-b border-gray-100">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">{currentStep.label}</p>
              <div className="mt-2 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black leading-tight">{currentStep.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{currentStep.note}</p>
                </div>
                <span className="hidden sm:flex w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 items-center justify-center text-sm font-black">
                  0{step + 1}
                </span>
              </div>
            </div>

            {step === 0 && (
              <form onSubmit={handleBusinessSubmit} className="p-5 sm:p-6 space-y-5 animate-fadeIn">
                <div>
                  <p className="text-sm font-black mb-2">How do you operate?</p>
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    {([
                      { value: "mobile", label: "Mobile", desc: "I go to customers" },
                      { value: "shop", label: "Shop", desc: "Customers come in" },
                      { value: "both", label: "Both", desc: "Mobile and shop" },
                    ] as const).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setBizForm({ ...bizForm, serviceType: item.value })}
                        className={`group h-[94px] rounded-2xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 ${
                          bizForm.serviceType === item.value
                            ? "border-blue-600 bg-blue-50 shadow-md shadow-blue-100"
                            : "border-gray-200 bg-gray-50 hover:bg-white hover:border-blue-200"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          bizForm.serviceType === item.value ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200 group-hover:text-blue-700"
                        }`}>
                          <OperationIcon type={item.value} className="w-5 h-5" />
                        </div>
                        <p className="mt-2 text-sm font-black">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
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
                  <Field label="Phone" required>
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
                  <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
              <div className="p-5 sm:p-6 animate-fadeIn">
                {!packageSaved ? (
                  <form onSubmit={savePackage} className="space-y-5">
                    {packageError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {packageError}
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-black mb-2">Quick starters</p>
                      <div className="grid sm:grid-cols-3 gap-2.5">
                        {PACKAGE_STARTERS.map((starter) => (
                          <button
                            key={starter.name}
                            type="button"
                            onClick={() => setPackageForm(starter)}
                            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50"
                          >
                            <p className="text-sm font-black">{starter.name}</p>
                            <p className="text-xs text-gray-500">from ${starter.price}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-[1fr_130px] gap-3">
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
                        placeholder="What is included?"
                        className={`${INPUT_CLASS} h-auto min-h-[88px] resize-none py-3`}
                      />
                    </Field>

                    <div>
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">Vehicle pricing</p>
                          <p className="text-xs text-gray-500">Select vehicle types and add extra price if needed.</p>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2.5">
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
                  <div className="py-5 text-center animate-fadeIn">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black">Package added</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                      Your booking page now has {createdPackageCount === 1 ? "one service customers can book" : `${createdPackageCount} services customers can book`}.
                    </p>
                    <div className="mt-6 grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={resetPackageBuilder}
                        className="h-12 rounded-2xl border border-gray-200 bg-white text-sm font-black text-gray-800 transition-colors hover:bg-gray-50"
                      >
                        Add another package
                      </button>
                      <button
                        type="button"
                        onClick={finishOnboarding}
                        className="h-12 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="p-5 sm:p-6 animate-fadeIn">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">Your booking link</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-mono text-sm text-blue-700">{bookingUrl}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition-colors ${
                        copied
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-200"
                      }`}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <Link
                    href="/dashboard/booking-page"
                    className="flex h-12 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700"
                  >
                    Edit booking page
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex h-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm font-black text-gray-800 transition-colors hover:bg-gray-50"
                  >
                    Go to dashboard
                  </Link>
                </div>

                <Link
                  href={user?.slug ? `/book/${user.slug}` : "/dashboard"}
                  target={user?.slug ? "_blank" : undefined}
                  className="mt-4 flex items-center justify-center text-sm font-black text-blue-700 hover:text-blue-800"
                >
                  Preview public booking page
                </Link>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="font-black text-blue-950">Customize later from the dashboard</p>
                  <p className="mt-1 text-sm text-blue-900/70">
                    Edit text, add your logo, upload images, change the page, and add more packages anytime.
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

function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function StateSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
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
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
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

function PrimaryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:translate-y-0 disabled:bg-blue-400"
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
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          selected ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-500"
        }`}>
          <VehicleIcon type={vehicle.id} className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">{vehicle.label}</span>
          <span className="block text-xs text-gray-500">{selected ? "Available" : "Hidden"}</span>
        </span>
        <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${
          selected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"
        }`}>
          {selected && (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="h-9 w-24 rounded-xl border border-gray-200 bg-white pl-7 pr-2 text-sm text-gray-950 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label}
    </>
  );
}

function OperationIcon({ type, className = "h-5 w-5" }: { type: ServiceType; className?: string }) {
  if (type === "shop") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 10h16M6 10l1.2-4h9.6L18 10M6 10v9h12v-9M9 19v-5h6v5" />
      </svg>
    );
  }

  if (type === "both") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11h7M5 11l1-3h5l1 3M4 15h9M6 15a1.5 1.5 0 103 0M15 10h5M16 10l.8-3h2.4L20 10M15 10v7h5v-7M16.5 17h2" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h2l2-4h8l2 4h2M5 14h14v3H5v-3M7 17a1.5 1.5 0 103 0M14 17a1.5 1.5 0 103 0M9 10l1-3h4l1 3" />
    </svg>
  );
}
