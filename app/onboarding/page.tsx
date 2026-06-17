"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { VEHICLE_TYPES, type VehicleTypeId } from "@/lib/vehicle-pricing";
import { getUser, isLoggedIn, setUser, syncFromServer } from "@/lib/storage";
import type { PackageVehiclePricing, User } from "@/types";

const STEPS = [
  { label: "Business", title: "Set up your business", note: "What customers see first." },
  { label: "Package", title: "Create your first package", note: "One service is enough to go live." },
  { label: "Go live", title: "Your booking page is ready", note: "Share it or customize it later." },
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

const INPUT_CLASS = "w-full h-12 px-4 bg-white border border-gray-200 rounded-2xl text-gray-950 text-[15px] placeholder-gray-400 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

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
  const [showVehiclePricing, setShowVehiclePricing] = useState(false);

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

      await fetch("/api/onboarding/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markStep: "services" }),
      }).catch(() => {});

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("detailbook:setup-changed"));
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
    setShowVehiclePricing(false);
    setPackageError("");
    setPackageSaved(false);
  };

  const finishOnboarding = () => {
    try { sessionStorage.removeItem("dB_showTour"); } catch { /* private mode */ }
    setStep(2);
  };

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-[#f4f7fb] to-blue-50 text-gray-950">
      {/* Soft decorative background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-cyan-200/25 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Logo size="sm" href="/" darkText />
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-blue-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />
            Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
          </span>
        </div>
      </header>

      <main className="px-4 pb-16 pt-5 sm:pt-8">
        <div className="mx-auto max-w-2xl">
          <Stepper step={step} />

          <section className="mt-5 animate-fadeInUp overflow-hidden rounded-3xl border border-white/80 bg-white shadow-xl shadow-blue-950/[0.06]">
            {/* Card header with gradient accent */}
            <div className="relative border-b border-gray-100 bg-gradient-to-br from-blue-50 via-white to-white px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-300/50">
                  <StepIcon step={step} />
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-black leading-tight sm:text-2xl">{currentStep.title}</h1>
                  <p className="mt-0.5 text-sm text-gray-500">{currentStep.note}</p>
                </div>
              </div>
            </div>

            {step === 0 && (
              <form onSubmit={handleBusinessSubmit} className="animate-fadeIn space-y-6 p-5 sm:p-7">
                <div>
                  <SectionLabel>How do you operate?</SectionLabel>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {([
                      { value: "mobile", label: "Mobile", desc: "I go to customers" },
                      { value: "shop", label: "Shop", desc: "Customers come in" },
                      { value: "both", label: "Both", desc: "Mobile and shop" },
                    ] as const).map((item) => {
                      const active = bizForm.serviceType === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setBizForm({ ...bizForm, serviceType: item.value })}
                          aria-pressed={active}
                          className={`group flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all active:scale-[0.98] sm:flex-col sm:items-start sm:gap-2.5 ${
                            active
                              ? "border-blue-600 bg-blue-50 shadow-md shadow-blue-100"
                              : "border-gray-200 bg-gray-50 hover:border-blue-200 hover:bg-white"
                          }`}
                        >
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            active ? "bg-blue-600 text-white" : "bg-white text-gray-400 group-hover:text-blue-500"
                          }`}>
                            <ServiceTypeIcon type={item.value} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-black">{item.label}</span>
                            <span className="block text-xs text-gray-500">{item.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
                  {savingBusiness ? <SpinnerText label="Saving..." /> : <>Continue <ArrowIcon /></>}
                </PrimaryButton>
              </form>
            )}

            {step === 1 && (
              <div className="animate-fadeIn p-5 sm:p-7">
                {!packageSaved ? (
                  <form onSubmit={savePackage} className="space-y-5">
                    {packageError && (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.007M11.25 4.5h1.5l7.5 13a.75.75 0 01-.65 1.125H4.4a.75.75 0 01-.65-1.125l7.5-13z" />
                        </svg>
                        {packageError}
                      </div>
                    )}

                    {/* Section 1 — the package itself */}
                    <fieldset className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className="text-xs font-bold text-gray-400">Quick fill</span>
                        {PACKAGE_STARTERS.map((starter) => (
                          <button
                            key={starter.name}
                            type="button"
                            onClick={() => setPackageForm(starter)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                          >
                            <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            {starter.name} · ${starter.price}
                          </button>
                        ))}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
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
                          rows={2}
                          value={packageForm.description}
                          onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                          placeholder="What is included?"
                          className={`${INPUT_CLASS} h-auto min-h-[76px] resize-none py-3 leading-relaxed`}
                        />
                      </Field>
                    </fieldset>

                    {/* Section 2 — optional vehicle pricing, collapsed by default */}
                    <div className="border-t border-gray-100 pt-5">
                      {!showVehiclePricing ? (
                        <button
                          type="button"
                          onClick={() => setShowVehiclePricing(true)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3.5 text-left transition-colors hover:border-blue-200 hover:bg-white"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg">🚙</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black">
                              Vehicle pricing <span className="font-bold text-gray-400">· Optional</span>
                            </span>
                            <span className="block text-xs text-gray-500">
                              Bookable for all vehicle types. Tap to charge extra for bigger ones.
                            </span>
                          </span>
                          <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      ) : (
                        <>
                          <div className="mb-2.5 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black">Vehicle pricing <span className="font-bold text-gray-400">· Optional</span></p>
                              <p className="text-xs text-gray-500">Pick the types you serve and add extra for bigger ones.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowVehiclePricing(false)}
                              className="shrink-0 text-xs font-black text-blue-600 hover:text-blue-700"
                            >
                              Hide
                            </button>
                          </div>
                          <div className="grid gap-2.5 sm:grid-cols-2">
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
                        </>
                      )}
                    </div>

                    <PrimaryButton disabled={savingPackage}>
                      {savingPackage ? <SpinnerText label="Saving package..." /> : <>Save package <ArrowIcon /></>}
                    </PrimaryButton>
                  </form>
                ) : (
                  <div className="animate-fadeIn py-4 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-200">
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-black">Package added</h2>
                    <p className="mx-auto mt-1.5 max-w-sm text-sm text-gray-500">
                      Your booking page now has {createdPackageCount === 1 ? "one service customers can book" : `${createdPackageCount} services customers can book`}.
                    </p>
                    <div className="mt-7 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={resetPackageBuilder}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white text-sm font-black text-gray-800 transition-colors hover:bg-gray-50 active:scale-[0.98]"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add another
                      </button>
                      <button
                        type="button"
                        onClick={finishOnboarding}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.98]"
                      >
                        Continue <ArrowIcon />
                      </button>
                    </div>
                    <p className="mx-auto mt-4 max-w-sm text-xs text-gray-400">
                      You can add, edit, or remove packages anytime from your dashboard.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="animate-fadeIn p-5 sm:p-7">
                <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Live
                    </span>
                    <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Your booking link</p>
                  </div>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 truncate rounded-xl border border-blue-100 bg-white/80 px-3.5 py-3 font-mono text-sm text-blue-700">{bookingUrl}</code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition-all active:scale-[0.98] ${
                        copied
                          ? "bg-emerald-500 text-white"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {copied ? (
                        <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg> Copied</>
                      ) : (
                        <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg> Copy</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/dashboard/booking-page"
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.98]"
                  >
                    Edit booking page
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white text-sm font-black text-gray-800 transition-colors hover:bg-gray-50 active:scale-[0.98]"
                  >
                    Go to dashboard
                  </Link>
                </div>

                <Link
                  href={user?.slug ? `/book/${user.slug}` : "/dashboard"}
                  target={user?.slug ? "_blank" : undefined}
                  className="mt-4 flex items-center justify-center gap-1.5 text-sm font-black text-blue-700 transition-colors hover:text-blue-800"
                >
                  Preview public booking page
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </Link>

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                  <div>
                    <p className="text-sm font-black text-blue-950">Customize anytime</p>
                    <p className="mt-0.5 text-sm text-blue-900/70">
                      Edit text, add your logo, upload images, change the page, and add more packages from the dashboard.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <p className="mt-5 text-center text-xs text-gray-400">
            Takes about 2 minutes · You can change everything later
          </p>
        </div>
      </main>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((item, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <Fragment key={item.label}>
            {index > 0 && (
              <div className="-mx-1 mb-5 h-0.5 flex-1 rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: index <= step ? "100%" : "0%" }}
                />
              </div>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition-all ${
                  done
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                    : active
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 ring-4 ring-blue-100"
                    : "border-2 border-gray-200 bg-white text-gray-400"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className={`text-[11px] font-black transition-colors sm:text-xs ${active ? "text-blue-700" : done ? "text-emerald-600" : "text-gray-400"}`}>
                {item.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function StepIcon({ step }: { step: number }) {
  if (step === 0) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    );
  }
  if (step === 1) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function ServiceTypeIcon({ type }: { type: ServiceType }) {
  if (type === "shop") {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21M3 3h18M4.5 3v18m15-18v18M9 6.75h1.5m-1.5 3h1.5m3-3H15m-1.5 3H15M6.75 21v-3.75a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75V21" />
      </svg>
    );
  }
  if (type === "both") {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <p className="text-sm font-black">{children}</p>
      {hint && <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{hint}</span>}
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
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-black text-gray-400">$</span>
      <input
        type="number"
        min="0"
        step="1"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT_CLASS} pl-9`}
      />
    </div>
  );
}

function PrimaryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-200 active:translate-y-0 active:scale-[0.99] disabled:translate-y-0 disabled:from-blue-400 disabled:to-indigo-400 disabled:shadow-none"
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
    <div className={`rounded-2xl border-2 p-3 transition-all ${
      selected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 bg-gray-50"
    }`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-colors ${
          selected ? "bg-white" : "bg-white/70"
        }`}>
          {vehicle.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">{vehicle.label}</span>
          <span className={`block text-xs ${selected ? "text-blue-600" : "text-gray-400"}`}>{selected ? "Available" : "Tap to add"}</span>
        </span>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
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
        <label className="mt-3 flex items-center justify-between gap-3 border-t border-blue-100 pt-3 text-xs font-black text-gray-500">
          Extra price
          <span className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={surcharge}
              onChange={(e) => onSurcharge(e.target.value)}
              className="h-10 w-24 rounded-xl border border-gray-200 bg-white pl-7 pr-2 text-sm text-gray-950 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
