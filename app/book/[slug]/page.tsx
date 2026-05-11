"use client";

import { useState, useEffect } from "react";
import { getUser, getPackages } from "@/lib/storage";
import type { User, Package, PackageAddon } from "@/types";
import { usePlatformName } from "@/components/PlatformName";
import StripeDepositModal from "@/components/StripeDepositModal";
import SquareDepositModal from "@/components/SquareDepositModal";
import PublicPhotoGallery, { type PublicPhoto } from "@/components/PublicPhotoGallery";

const TIMES = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

interface StaffMember {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar?: string;
}

interface BookingForm {
  make: string; model: string; year: string; color: string;
  customerName: string; customerEmail: string; customerPhone: string; notes: string;
}
const EMPTY_FORM: BookingForm = {
  make:"",model:"",year:"",color:"",customerName:"",customerEmail:"",customerPhone:"",notes:"",
};

const PLACEHOLDER_REVIEWS = [
  { name: "Sarah M.", rating: 5, quote: "Absolutely amazing work! My car looked brand new after the full detail. Highly recommend!" },
  { name: "James R.", rating: 5, quote: "Professional, punctual, and the results speak for themselves. Best detailer in town." },
  { name: "Maria L.", rating: 5, quote: "They came right to my office and had my car spotless by the end of the day. 10/10 service." },
];

// Mock service packages shown in Demo Mode when the owner views their
// own booking page with zero real services. Cast to Package at the
// render site — these are display-only and never POSTed anywhere.
//
// Demo Mode exists so new signups don't see "No services available"
// on their own preview link (which made the product look broken and
// was the single biggest contributor to drop-off in week-one cohort).
const DEMO_SERVICES: Package[] = [
  { id: "demo-1", name: "Basic Wash & Shine",       description: "Exterior hand wash, tire shine, and a quick interior wipe-down.", price: 45,  duration: 30,  active: true },
  { id: "demo-2", name: "Full Interior Detail",     description: "Deep vacuum, leather conditioning, and crevice cleaning.",        price: 89,  duration: 60,  active: true },
  { id: "demo-3", name: "Complete Detail Package",  description: "Full interior + exterior detail with premium products.",         price: 149, duration: 120, active: true },
  { id: "demo-4", name: "Paint Correction",         description: "Multi-stage polish to remove swirls, scratches and oxidation.",  price: 249, duration: 300, active: true },
  { id: "demo-5", name: "Ceramic Coating",          description: "Long-lasting ceramic protection with paint prep.",               price: 399, duration: 480, active: true },
];

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map((i) => (
          <svg key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? "text-amber-400" : "text-white/20"}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-white font-bold text-sm">{rating.toFixed(1)}</span>
      <span className="text-white/60 text-sm">({count} reviews)</span>
    </div>
  );
}

function MiniStarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function BookingPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const platformName = usePlatformName();
  const [user, setUser] = useState<User | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  // True when the logged-in viewer is the owner of this booking page.
  // We use slug equality from the local storage cache — same machine
  // login that produced the dashboard session.
  const [viewerIsOwner, setViewerIsOwner] = useState(false);
  // Dismissal of the demo-mode banner. Kept in component state only —
  // we want it back on a hard refresh so the message keeps signalling
  // "this is not your real page yet" until they actually fix it.
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  // IDs of the add-ons the customer has currently ticked. Reset whenever
  // the customer picks a different package so options from the previous
  // package don't leak into the booking.
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [serviceType, setServiceType] = useState<"mobile" | "shop" | "both">("mobile");
  const [customerAddress, setCustomerAddress] = useState("");
  const [selectedServiceMode, setSelectedServiceMode] = useState<"mobile" | "shop" | null>(null);
  const [bookedSlots, setBookedSlots] = useState<{ date: string; time: string; staffId: string | null }[]>([]);
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [stripeDepositPaid, setStripeDepositPaid] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  // Customer ticks "I have paid" before submitting a manual-payment booking.
  // Required so we don't accept a manual-payment submission without a confirmation.
  const [manualPaymentConfirmed, setManualPaymentConfirmed] = useState(false);
  // The actual status the API stored for the new booking. "confirmed" for card
  // payments, "pending" for manual / cash / no-deposit. Drives the final screen.
  const [bookingStatusReturned, setBookingStatusReturned] = useState<"confirmed" | "pending" | null>(null);
  // Country code for phone input. Temporary +383 (Kosovo) for testing alongside +1.
  const [phoneCountry, setPhoneCountry] = useState<"+1" | "+383">("+1");
  // Stripe embedded modal state. We hold the booking payload in memory and only
  // create the booking on the server AFTER the customer pays — so closing the
  // modal leaves zero side effects.
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [pendingStripeBookingData, setPendingStripeBookingData] = useState<any>(null);
  // Same pattern for Square — booking is held until payment succeeds.
  const [squareModalOpen, setSquareModalOpen] = useState(false);
  const [pendingSquareBookingData, setPendingSquareBookingData] = useState<any>(null);

  useEffect(() => {
    // Detect whether the visitor is the business owner. Compares the
    // locally cached logged-in user's slug to the URL slug. This is a
    // soft signal (anyone with a matching localStorage key would also
    // see Demo Mode) — fine because Demo Mode is harmless to a
    // non-owner who happens to share the slug.
    const localUser = getUser();
    if (localUser?.slug && localUser.slug === slug) {
      setViewerIsOwner(true);
    }

    // Fetch public business data (staff + serviceType) from API
    fetch(`/api/book/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          if (data.staff && Array.isArray(data.staff)) setStaffList(data.staff);
          if (data.serviceType) setServiceType(data.serviceType);
          if (data.packages) setPackages(data.packages.filter((p: any) => p.active));
          if (data.bookedSlots && Array.isArray(data.bookedSlots)) setBookedSlots(data.bookedSlots);
          if (Array.isArray(data.photos)) setPhotos(data.photos as PublicPhoto[]);
          // Build user object from API response (more up-to-date than localStorage)
          setUser(data);
        } else {
          // Fallback to localStorage
          setUser(getUser());
          setPackages(getPackages().filter((p) => p.active));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Handle Stripe deposit return
  const [pendingStripeReturn, setPendingStripeReturn] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const depositStatus = url.searchParams.get("deposit");
    const returnBookingId = url.searchParams.get("bookingId");
    if (depositStatus === "success" && returnBookingId) {
      setPendingStripeReturn(returnBookingId);
      // Clean up URL params immediately
      url.searchParams.delete("deposit");
      url.searchParams.delete("bookingId");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  // Once user data is loaded AND we have a pending hosted-checkout return,
  // verify the payment server-side before showing success. Stripe is verified
  // by its webhook — Square uses this verify endpoint.
  useEffect(() => {
    if (pendingStripeReturn && user && !loading) {
      const bId = pendingStripeReturn;
      setBookingId(bId);
      setBookingStatusReturned("confirmed");
      setStep(4);
      setPendingStripeReturn(null);
      (async () => {
        try {
          const r = await fetch("/api/deposit/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: bId }),
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j?.paid) {
            setStripeDepositPaid(true);
          } else {
            // Stripe path doesn't need verify — its webhook updates the booking,
            // so optimistically show paid for stripe returns.
            setStripeDepositPaid(true);
          }
        } catch {
          setStripeDepositPaid(true);
        }
      })();
    }
  }, [pendingStripeReturn, user, loading]);

  const isPro = user?.plan === "pro";

  // Check if a time slot is available for the selected date + staff
  const isTimeBooked = (time: string): boolean => {
    if (!selectedDate) return false;
    if (selectedStaff) {
      // Specific staff selected — blocked if that staff has a booking
      return bookedSlots.some((s) => s.date === selectedDate && s.time === time && s.staffId === selectedStaff.id);
    }
    if (staffList.length === 0) {
      // No staff — just check if any booking exists at that time for this business
      return bookedSlots.some((s) => s.date === selectedDate && s.time === time);
    }
    // "Any available" — blocked only if ALL staff members are booked at that time
    const staffWithBooking = bookedSlots.filter((s) => s.date === selectedDate && s.time === time).map((s) => s.staffId);
    return staffList.every((st) => staffWithBooking.includes(st.id));
  };

  // Auto-assign: pick the staff member with fewest bookings on that date
  const autoAssignStaff = (): string | undefined => {
    if (staffList.length === 0 || !selectedDate || !selectedTime) return undefined;
    if (selectedStaff) return selectedStaff.id;
    // Find staff not booked at this time
    const bookedAtTime = bookedSlots
      .filter((s) => s.date === selectedDate && s.time === selectedTime)
      .map((s) => s.staffId);
    const available = staffList.filter((st) => !bookedAtTime.includes(st.id));
    if (available.length === 0) return undefined;
    // Pick one with fewest bookings on that day
    const dayCounts = available.map((st) => ({
      id: st.id,
      count: bookedSlots.filter((s) => s.date === selectedDate && s.staffId === st.id).length,
    }));
    dayCounts.sort((a, b) => a.count - b.count);
    return dayCounts[0].id;
  };

  // Deposit comes from per-package setting, gated by global requireDeposit toggle
  const requireDeposit = (user as any)?.requireDeposit ?? false;
  const depositAmount = (selectedPackage && requireDeposit)
    ? Number((selectedPackage as any).deposit || 0)
    : 0;

  // Reset ticked add-ons whenever the customer switches packages so they
  // don't carry options from the prior package into the new one.
  useEffect(() => {
    setSelectedAddonIds([]);
  }, [selectedPackage?.id]);

  // Add-on derived values. We always recompute from the live package +
  // the ticked ids so changing the selection updates the summary instantly.
  // Add-ons only affect price — appointment duration stays at the
  // package's own duration.
  const availableAddons: PackageAddon[] = (selectedPackage?.addons || []).filter(
    (a) => a && a.name && Number.isFinite(a.price)
  );
  const chosenAddons: PackageAddon[] = availableAddons.filter((a) => selectedAddonIds.includes(a.id));
  const addonsTotal = chosenAddons.reduce((s, a) => s + (a.price || 0), 0);
  const totalPrice = (selectedPackage?.price || 0) + addonsTotal;
  const toggleAddon = (id: string) => {
    setSelectedAddonIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

  // Build list of enabled payment methods for the UI
  const getEnabledPaymentMethods = (pm: any) => {
    const methods: { key: string; label: string; icon: string; detail: string }[] = [];
    if (pm?.stripe?.enabled && pm.stripe.connected) {
      methods.push({ key: "stripe", label: "Card Payment", icon: "💳", detail: "Pay securely with credit/debit card" });
    }
    if (pm?.square?.enabled && pm.square.connected) {
      methods.push({ key: "square", label: "Card Payment (Square)", icon: "💳", detail: "Pay securely with credit/debit card" });
    }
    if (pm?.paypal?.enabled && (pm.paypal.paypalMeLink || pm.paypal.email)) {
      methods.push({ key: "paypal", label: "PayPal", icon: "🅿️", detail: pm.paypal.email || `paypal.me/${pm.paypal.paypalMeLink}` });
    }
    if (pm?.cashapp?.enabled && pm.cashapp.cashtag) {
      methods.push({ key: "cashapp", label: "Cash App", icon: "💵", detail: `$${pm.cashapp.cashtag}` });
    }
    if (pm?.bankTransfer?.enabled && pm.bankTransfer.bankName) {
      methods.push({ key: "bankTransfer", label: "Bank Transfer", icon: "🏦", detail: `${pm.bankTransfer.bankName}` });
    }
    if (pm?.cash?.enabled) {
      methods.push({ key: "cash", label: "Cash on Arrival", icon: "💰", detail: pm.cash.instructions || "Pay in person" });
    }
    return methods;
  };

  // Build the shared booking payload from the current form state. Used by
  // every submit path — step-2 no-deposit submit, manual-payment submit at
  // step 3, and the Stripe/Square modal payloads.
  const buildBookingData = () => {
    const assignedStaffId = selectedStaff?.id || autoAssignStaff();
    const assignedStaffName = selectedStaff?.name || staffList.find((s) => s.id === assignedStaffId)?.name;
    const bookingAddress = (serviceType === "both" && selectedServiceMode === "shop")
      ? `SHOP: ${user?.address || ""}`
      : customerAddress.trim() || undefined;
    return {
      userId: (user as any)?.id,
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      customerPhone: form.customerPhone,
      vehicle: { make: form.make, model: form.model, year: form.year, color: form.color },
      serviceId: selectedPackage!.id,
      serviceName: selectedPackage!.name,
      servicePrice: selectedPackage!.price,
      // Send only ids — the API re-resolves and snapshots the price from
      // the live package so a tampered client can't pay $0 for an add-on.
      selectedAddons: chosenAddons.map((a) => ({ id: a.id })),
      date: selectedDate,
      time: selectedTime,
      depositRequired: depositAmount,
      notes: form.notes,
      address: bookingAddress,
      staffId: assignedStaffId,
      staffName: assignedStaffName,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !selectedDate || !selectedTime) return;
    if (serviceType === "both" && !selectedServiceMode) return;

    // Validate mobile address
    const needsAddress = serviceType === "mobile" || (serviceType === "both" && selectedServiceMode === "mobile");
    if (needsAddress && !customerAddress.trim()) {
      setBookingError("Please enter your service address so we can come to you.");
      return;
    }

    setBookingError(null);

    const pm = (user as any)?.paymentMethods;
    const enabledMethods = getEnabledPaymentMethods(pm);
    const needsPaymentStep = depositAmount > 0 && enabledMethods.length > 0;

    // If there's a deposit AND payment methods configured, the customer picks
    // how to pay on a dedicated screen. Otherwise we submit straight away as
    // a no-deposit pending booking.
    if (needsPaymentStep) {
      setSelectedPaymentMethod(null);
      setManualPaymentConfirmed(false);
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildBookingData(),
          status: "pending",
          depositPaid: 0,
          paymentMethod: depositAmount > 0 ? "cash" : "",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBookingId(created.id);
        setBookingStatusReturned("pending");
        setSubmitting(false);
        setStep(4);
      } else {
        const errData = await res.json().catch(() => ({}));
        setBookingError(errData.error || "Failed to create booking. Please try again.");
        setSubmitting(false);
      }
    } catch {
      setBookingError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  // Manual payment confirmation (PayPal / Cash App / Bank Transfer / Cash)
  // — customer ticks "I have paid" then submits. Booking lands as "pending"
  // and the business owner verifies the payment before confirming.
  const handleManualPaymentSubmit = async () => {
    if (!selectedPackage || !selectedPaymentMethod) return;
    if (selectedPaymentMethod !== "cash" && !manualPaymentConfirmed) return;
    setBookingError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildBookingData(),
          status: "pending",
          depositPaid: 0,
          paymentMethod: selectedPaymentMethod,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBookingId(created.id);
        setBookingStatusReturned("pending");
        setSubmitting(false);
        setStep(4);
      } else {
        const errData = await res.json().catch(() => ({}));
        setBookingError(errData.error || "Failed to create booking. Please try again.");
        setSubmitting(false);
      }
    } catch {
      setBookingError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  // Card payment — opens the embedded modal. Booking is only created
  // after payment succeeds, inside the modal's onSuccess handler.
  const handleCardPaymentStart = () => {
    if (!selectedPackage || !selectedPaymentMethod) return;
    const data = {
      ...buildBookingData(),
      paymentMethod: selectedPaymentMethod,
    };
    if (selectedPaymentMethod === "stripe") {
      setPendingStripeBookingData(data);
      setStripeModalOpen(true);
    } else if (selectedPaymentMethod === "square") {
      setPendingSquareBookingData(data);
      setSquareModalOpen(true);
    }
  };

  // Business timezone (IANA). Falls back to the customer's browser tz, then UTC.
  const bizTz: string = (user as any)?.timezone || (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  })();

  // Build a Y-M-D string for a given Date using its local components (no UTC shift).
  const toLocalYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // "Today" as Y-M-D in the business's timezone — guarantees customers can't book
  // yesterday or any earlier date regardless of their browser tz.
  const todayInBizTz: string = (() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: bizTz, year: "numeric", month: "2-digit", day: "2-digit",
      });
      return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
    } catch {
      return toLocalYMD(new Date());
    }
  })();

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(year, month, d));

  // Convert "8:00 AM" / "14:00" style strings to minutes from midnight
  const timeToMinutes = (t: string): number => {
    const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampm) {
      let h = parseInt(ampm[1]);
      const m = parseInt(ampm[2]);
      if (ampm[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm[3].toUpperCase() === "AM" && h === 12) h = 0;
      return h * 60 + m;
    }
    const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) return parseInt(h24[1]) * 60 + parseInt(h24[2]);
    return 0;
  };

  const isTimeOutsideBusinessHours = (time: string): boolean => {
    if (!selectedDate || !user?.businessHours) return false;
    const date = new Date(selectedDate + "T00:00:00");
    const dayName = DAY_NAMES[date.getDay()];
    const hours = user.businessHours[dayName];
    if (!hours || hours.closed) return true;
    const slotMin = timeToMinutes(time);
    const openMin = timeToMinutes(hours.open);
    const closeMin = timeToMinutes(hours.close);
    return slotMin < openMin || slotMin >= closeMin;
  };

  // Format minutes-from-midnight into the same "8:00 AM" / "6:00 PM" string
  // shape used by businessHours.open/close so the rest of the page stays consistent.
  const minutesToAmPm = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  // Build the visible time-slot list from the business's hours for the selected
  // day. Falls back to the static 8 AM–5 PM range if no hours are configured.
  const availableTimes: string[] = (() => {
    if (!selectedDate || !user?.businessHours) return TIMES;
    const date = new Date(selectedDate + "T00:00:00");
    const dayName = DAY_NAMES[date.getDay()];
    const hours = user.businessHours[dayName];
    if (!hours || hours.closed) return [];
    const openMin = timeToMinutes(hours.open);
    const closeMin = timeToMinutes(hours.close);
    if (closeMin <= openMin) return TIMES;
    const slots: string[] = [];
    for (let m = openMin; m < closeMin; m += 60) {
      slots.push(minutesToAmPm(m));
    }
    return slots;
  })();

  // When the customer picks today, disable time slots earlier than the current
  // time in the business's timezone.
  const isTimeInPast = (time: string): boolean => {
    if (!selectedDate || selectedDate !== todayInBizTz) return false;
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: bizTz, hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(new Date());
      const hh = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
      const mm = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
      const nowMin = hh * 60 + mm;
      return timeToMinutes(time) <= nowMin;
    } catch {
      return false;
    }
  };

  const isDateDisabled = (date: Date) => {
    // Compare as Y-M-D strings so we're not at the mercy of time-of-day or UTC conversion.
    const dateYMD = toLocalYMD(date);
    if (dateYMD < todayInBizTz) return true;
    // Enforce advance booking window
    const advanceDays = (user as any)?.advanceBookingDays ?? 30;
    const [ty, tm, td] = todayInBizTz.split("-").map(Number);
    const maxDate = new Date(ty, tm - 1, td);
    maxDate.setDate(maxDate.getDate() + advanceDays);
    if (toLocalYMD(date) > toLocalYMD(maxDate)) return true;
    // Disable days the business is closed
    if (user?.businessHours) {
      const dayName = DAY_NAMES[date.getDay()];
      if (user.businessHours[dayName]?.closed) return true;
    }
    return false;
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h}h ${m}m`;
  };

  const getTodayHours = () => {
    if (!user?.businessHours) return null;
    const dayName = DAY_NAMES[new Date().getDay()];
    const hours = user.businessHours[dayName];
    if (hours.closed) return "Closed today";
    return `Open today: ${hours.open} – ${hours.close}`;
  };

  const packageIcons: Record<string, string> = {
    "Basic Wash & Shine": "\u{1F4A7}",
    "Full Detail": "\u2728",
    "Interior Detail": "\u{1FA91}",
    "Ceramic Coating": "\u{1F6E1}\uFE0F",
  };

  // Demo Mode kicks in when the owner is previewing their own booking
  // page with zero real services — instead of an empty "no services
  // available" message we show their real business profile with mock
  // services so they can see what the finished page will look like.
  // External visitors hitting the same empty state get a contact-only
  // fallback (rendered separately, further down).
  const isDemoMode = viewerIsOwner && packages.length === 0;
  // The list every layout iterates over. Real packages in the happy
  // path; demo packages when in Demo Mode.
  const displayPackages = isDemoMode ? DEMO_SERVICES : packages;

  // Clicking a service card normally selects + advances. In Demo Mode
  // we short-circuit — the demo packages aren't bookable, so we point
  // the owner at the packages page to add real ones.
  const handlePackageClick = (pkg: Package) => {
    if (isDemoMode) {
      window.alert("Add your real services to enable bookings. Tap '+ Add Your Services' at the top.");
      return;
    }
    setSelectedPackage(pkg);
    setStep(1);
  };

  // Sort packages by price descending to identify "most popular" (most expensive) for Pro badge
  const sortedPackages = [...displayPackages].sort((a, b) => b.price - a.price);
  const mostPopularId = sortedPackages.length > 0 ? sortedPackages[0].id : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-10 text-center max-w-sm">
          <div className="text-5xl mb-4">{"\u{1F50D}"}</div>
          <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
          <p className="text-white/60">The booking page for &quot;{slug}&quot; doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  // ── Success Screen ──────────────────────────────────
  if (step === 4) {
    const fullyConfirmed = bookingStatusReturned === "confirmed";

    const screenTitle = fullyConfirmed ? "Booking Confirmed!" : "Booking Request Sent";
    const screenSubtitle = fullyConfirmed
      ? `${user?.name || "The business"} will see your appointment shortly. Check your email for details.`
      : `${user?.name || "The business"} will review your payment and confirm your booking. You'll get an email once it's approved.`;

    const useAmberIcon = false;
    const useGreenIcon = fullyConfirmed;

    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
        {/* Animated circles */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${useAmberIcon ? "bg-amber-500/10" : useGreenIcon ? "bg-green-500/10" : "bg-blue-500/10"} rounded-full blur-3xl animate-blobFloat`} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-blobFloat delay-300" />
        </div>

        <div className="glass rounded-3xl max-w-md w-full overflow-hidden relative animate-scaleIn">
          {/* ── Brand header ── */}
          <div className={`relative px-8 pt-8 pb-6 text-center border-b border-white/10 overflow-hidden ${
            useAmberIcon ? "bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent"
            : useGreenIcon ? "bg-gradient-to-br from-emerald-500/15 via-green-500/10 to-transparent"
            : "bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent"
          }`}>
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            {/* Business logo / initial */}
            <div className="relative flex items-center justify-center gap-3 mb-6">
              {user?.logo ? (
                <img
                  src={user.logo}
                  alt={user.businessName || "Business"}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/20 shadow-lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-lg ring-2 ring-white/20">
                  {(user?.businessName || "B").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-white text-sm font-bold leading-tight">{user?.businessName || "Booking"}</p>
                <p className="text-white/50 text-xs">Booking receipt</p>
              </div>
            </div>

            {/* Animated status icon */}
            <div className="relative w-20 h-20 mx-auto mb-5">
              {useAmberIcon ? (
                <>
                  <div className="absolute inset-0 bg-amber-500/25 rounded-full animate-ping" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-xl shadow-amber-500/40">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </>
              ) : useGreenIcon ? (
                <>
                  <div className="absolute inset-0 bg-green-500/25 rounded-full animate-ping" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-blue-500/25 rounded-full animate-ping" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/40">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </>
              )}
            </div>

            {/* Status pill */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${
              useAmberIcon ? "bg-amber-500/20 text-amber-300 border border-amber-400/30"
              : useGreenIcon ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
              : "bg-blue-500/20 text-blue-300 border border-blue-400/30"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                useAmberIcon ? "bg-amber-400 animate-pulse"
                : useGreenIcon ? "bg-emerald-400"
                : "bg-blue-400 animate-pulse"
              }`} />
              {useAmberIcon ? "Action Required" : useGreenIcon ? "Confirmed" : "Pending Review"}
            </div>

            <h1 className="text-2xl font-extrabold text-white mb-2 leading-tight">{screenTitle}</h1>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">{screenSubtitle}</p>
          </div>

          <div className="p-6 sm:p-8 text-center">

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 mb-6">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Summary</p>
            {[
              { label: "Booking ID", value: `#${bookingId}`, mono: true },
              ...(selectedPackage ? [{ label: "Service", value: selectedPackage.name }] : []),
              ...(selectedDate ? [{ label: "Date", value: formatDate(selectedDate) }] : []),
              ...(selectedTime ? [{ label: "Time", value: selectedTime }] : []),
              ...(selectedPackage ? [{
                label: chosenAddons.length > 0 ? "Total (incl. add-ons)" : "Total",
                value: `$${totalPrice}`,
              }] : []),
              ...(chosenAddons.length > 0 ? [{
                label: "Add-ons",
                value: chosenAddons.map((a) => `${a.name} ($${a.price})`).join(", "),
              }] : []),
              ...(depositAmount > 0 && fullyConfirmed ? [{ label: "Deposit Paid", value: `$${depositAmount}`, highlight: true }] : []),
              ...(depositAmount > 0 && !fullyConfirmed ? [{ label: "Deposit Due", value: `$${depositAmount}`, highlight: true }] : []),
              ...(selectedStaff ? [{ label: "Detailer", value: selectedStaff.name }] : []),
            ].filter(item => item.value).map(({ label, value, mono, highlight }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-white/50">{label}</span>
                <span className={`font-semibold ${highlight ? "text-blue-400" : "text-white"} ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* ── Payment-specific success content ── */}
          {fullyConfirmed && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-green-400 text-sm font-bold">Deposit Paid Successfully</p>
                <p className="text-white/50 text-xs">Your ${depositAmount} deposit has been processed via card payment.</p>
              </div>
            </div>
          )}

          {/* Manual payment methods: business will verify before confirming */}
          {!fullyConfirmed && depositAmount > 0 && (selectedPaymentMethod === "paypal" || selectedPaymentMethod === "cashapp" || selectedPaymentMethod === "bankTransfer") && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-blue-300 text-sm font-bold">Payment Pending Verification</p>
                <p className="text-white/50 text-xs">Your ${depositAmount} payment is being verified. You&apos;ll get an email once confirmed.</p>
              </div>
            </div>
          )}

          {selectedPaymentMethod === "cash" && depositAmount > 0 && !fullyConfirmed && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💰</span>
                <p className="text-white text-sm font-bold">Cash Deposit Due at Appointment</p>
              </div>
              <p className="text-white/50 text-xs">
                Please bring <strong className="text-white">${depositAmount}</strong> in cash at the time of your appointment.
              </p>
              {(() => {
                const pm = (user as any)?.paymentMethods;
                return pm?.cash?.instructions ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-3">
                    <p className="text-amber-300 text-xs">{pm.cash.instructions}</p>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Enhancement 6: Pro Enhanced Success Screen */}
          {isPro && fullyConfirmed && (
            <>
              {/* Add to Calendar button */}
              <a
                href={(() => {
                  if (!selectedDate || !selectedTime || !selectedPackage) return "#";
                  const [y, mo, d] = selectedDate.split("-").map(Number);
                  const ampm = selectedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                  let h = ampm ? parseInt(ampm[1]) : 0;
                  const m = ampm ? parseInt(ampm[2]) : 0;
                  if (ampm && ampm[3].toUpperCase() === "PM" && h !== 12) h += 12;
                  if (ampm && ampm[3].toUpperCase() === "AM" && h === 12) h = 0;
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const start = new Date(y, mo - 1, d, h, m, 0);
                  const end = new Date(start.getTime() + (selectedPackage.duration || 60) * 60000);
                  const fmt = (dt: Date) => `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
                  const title = encodeURIComponent(`${selectedPackage.name} – ${user.businessName}`);
                  const details = encodeURIComponent(`Booking ID: #${bookingId}\nService: ${selectedPackage.name}\nBusiness: ${user.businessName}${user.phone ? `\nPhone: ${user.phone}` : ""}`);
                  const location = encodeURIComponent(customerAddress || (user as any).address || "");
                  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}&location=${location}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full glass border border-white/20 text-white font-semibold py-3.5 rounded-2xl hover:bg-white/10 transition-all mb-3 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Add to Calendar
              </a>

              {/* What to Expect section */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left mb-6">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-4">What to Expect</p>
                <div className="space-y-4">
                  {[
                    {
                      step: "1",
                      title: "Confirmation SMS/Email sent",
                      description: "You'll receive a confirmation with all your booking details.",
                      icon: (
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      ),
                    },
                    {
                      step: "2",
                      title: "Reminder 2 hours before",
                      description: "We'll send you a reminder 2 hours before your appointment.",
                      icon: (
                        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      ),
                    },
                    {
                      step: "3",
                      title: "Your appointment begins",
                      description: "Your detailer will be ready to transform your vehicle at the scheduled time.",
                      icon: (
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ),
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold">{item.title}</p>
                        <p className="text-white/50 text-xs mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => { setStep(0); setSelectedPackage(null); setSelectedDate(null); setSelectedTime(null); setForm(EMPTY_FORM); setBookingId(null); setBookingError(null); setCustomerAddress(""); setSelectedStaff(null); setSelectedServiceMode(null); setSelectedPaymentMethod(null); setStripeDepositPaid(false); setSmsConsent(false); setManualPaymentConfirmed(false); setBookingStatusReturned(null); }}
            className="w-full glass border border-white/20 text-white font-semibold py-3.5 rounded-2xl hover:bg-white/10 transition-all"
          >
            Book Another Appointment
          </button>

          {/* Footer brand line */}
          <p className="text-white/30 text-[11px] text-center mt-6">
            Powered by <span className="text-white/50 font-semibold">DetailBook</span>
          </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Booking Page ────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Demo Mode banner — only the owner sees this, only when
            their booking page has 0 real services. Visually distinct
            (amber/sticky) so the owner can never mistake their preview
            for the live customer view. Dismissable per-session. ── */}
      {isDemoMode && !demoBannerDismissed && (
        <div className="sticky top-0 z-40 bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-sm">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-lg flex-shrink-0" aria-hidden>👁️</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-900">Preview Mode</p>
                <p className="text-xs text-amber-800/80 leading-snug">
                  This is how your booking page will look. Customers won&apos;t see this — add your own services to make it live.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="/dashboard/packages?newPackage=1"
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                + Add Your Services →
              </a>
              <button
                onClick={() => setDemoBannerDismissed(true)}
                aria-label="Dismiss"
                className="text-amber-800/70 hover:text-amber-900 text-xs font-semibold px-2 py-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden">
        {/* Background: banner image or default gradient */}
        {user.bannerImage ? (
          <>
            <img src={user.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0, 0, 0, ${(user.bannerOverlayOpacity ?? 60) / 100})` }} />
          </>
        ) : (
          <div className="absolute inset-0 bg-mesh" />
        )}
        {/* Background blobs (visible on both) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl animate-blobFloat" />
          <div className="absolute top-10 right-10 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl animate-blobFloat delay-400" />
          <div className="absolute bottom-0 left-1/2 w-96 h-40 bg-blue-800/20 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-2xl mx-auto px-4 pt-10 pb-8 text-center">
          {/* Logo */}
          <div className="relative inline-block mb-5 animate-fadeInUp">
            <div className="absolute inset-0 bg-blue-500/40 rounded-full blur-xl animate-glowPulse" />
            {user.logo ? (
              <img src={user.logo} alt={user.businessName} className="relative w-24 h-24 rounded-full object-cover ring-4 ring-white/20 shadow-2xl" />
            ) : (
              <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center ring-4 ring-white/20 shadow-2xl">
                <span className="text-white text-4xl font-extrabold">{user.businessName.charAt(0)}</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Business name with Pro verified badge */}
          <h1 className="text-3xl font-extrabold text-white mb-2 animate-fadeInUp delay-100 flex items-center justify-center gap-2">
            {user.businessName}
            {/* Enhancement 1: Verified Pro Badge */}
            {isPro && (
              <span className="inline-flex items-center gap-1 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified Business
              </span>
            )}
          </h1>

          {/* Rating */}
          {user.rating && (
            <div className="flex justify-center mb-3 animate-fadeInUp delay-200">
              <StarRating rating={user.rating} count={user.reviewCount ?? 0} />
            </div>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4 animate-fadeInUp delay-300">
            {user.city && (
              <span className="glass flex items-center gap-1.5 text-white/80 text-xs px-3 py-1.5 rounded-full">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {user.city}
              </span>
            )}
            {user.yearsInBusiness && (
              <span className="glass text-white/80 text-xs px-3 py-1.5 rounded-full">
                {user.yearsInBusiness}+ years experience
              </span>
            )}
            <span className="glass text-white/80 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Professional Service
            </span>
          </div>

          {/* Social + contact links */}
          <div className="flex items-center justify-center gap-3 mb-4 animate-fadeInUp delay-400">
            {user.phone && (
              <a href={`tel:${user.phone}`} className="glass flex items-center gap-1.5 text-white/80 hover:text-white text-xs px-3 py-2 rounded-xl transition-all hover:bg-white/10">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {user.phone}
              </a>
            )}
            {user.instagram && (
              <a href={`https://instagram.com/${user.instagram}`} target="_blank" rel="noopener noreferrer"
                className="glass w-9 h-9 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            )}
            {user.facebook && (
              <a href={`https://facebook.com/${user.facebook}`} target="_blank" rel="noopener noreferrer"
                className="glass w-9 h-9 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
            {user.website && (
              <a href={user.website.startsWith("http") ? user.website : `https://${user.website}`} target="_blank" rel="noopener noreferrer"
                className="glass w-9 h-9 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              </a>
            )}
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-white/55 text-sm max-w-md mx-auto leading-relaxed animate-fadeInUp delay-500">
              {user.bio}
            </p>
          )}
        </div>

        {/* Info bar */}
        <div className="relative border-t border-white/10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {/* Today's hours */}
            {getTodayHours() && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {getTodayHours()}
              </span>
            )}
            {/* Service areas */}
            {user.serviceAreas && user.serviceAreas.length > 0 && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {user.serviceAreas.slice(0, 3).join(", ")}
                {user.serviceAreas.length > 3 && ` +${user.serviceAreas.length - 3} more`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gallery — only shown when the business has actual photos */}
      {isPro && (user as any).galleryPhotos && Array.isArray((user as any).galleryPhotos) && (user as any).galleryPhotos.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Gallery
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-x-visible sm:pb-0">
              {(user as any).galleryPhotos.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Gallery ${i + 1}`} className="flex-shrink-0 w-36 h-28 sm:w-full sm:h-32 rounded-xl object-cover" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step Indicator ── */}
      {(() => {
        const pmAvailable = getEnabledPaymentMethods((user as any).paymentMethods).length > 0;
        const showPaymentStep = depositAmount > 0 && pmAvailable;
        const labels = showPaymentStep
          ? ["Choose Service", "Date & Time", "Your Details", "Payment"]
          : ["Choose Service", "Date & Time", "Your Details"];
        const last = labels.length - 1;
        return (
          <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
            <div className="max-w-2xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                {labels.map((label, i) => (
                  <div key={i} className={`flex items-center ${i < last ? "flex-1" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        i < step  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" :
                        i === step ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-4 ring-blue-100" :
                                     "bg-gray-100 text-gray-400"
                      }`}>
                        {i < step ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : i + 1}
                      </div>
                      <span className={`text-xs font-semibold hidden sm:block transition-colors duration-300 ${
                        i === step ? "text-blue-600" : i < step ? "text-blue-400" : "text-gray-400"
                      }`}>{label}</span>
                    </div>
                    {i < last && (
                      <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all duration-500 ${i < step ? "bg-blue-500" : "bg-gray-200"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Photo gallery — sits between the hero/info header and the
          services list. Renders nothing when the business has zero
          photos so unfinished pages don't pick up an empty band. */}
      {step === 0 && photos.length > 0 && (
        <PublicPhotoGallery
          photos={photos}
          layout={(user as any).galleryLayout || "grid"}
          showTitle={(user as any).galleryShowTitle ?? true}
          title={(user as any).galleryTitle || "Our Work"}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* ── Step 0: Choose Service ── */}
        {step === 0 && (
          <div className="animate-fadeInUp">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Choose a Service</h2>
            <p className="text-gray-500 text-sm mb-6">Select the service you&apos;d like to book.</p>

            {packages.length === 0 && !viewerIsOwner ? (
              /* Public visitor hits an unfinished page — give them a
                 way to reach the business directly instead of the old
                 "No services available" dead end. */
              <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-10 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{user.businessName}</h3>
                <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">
                  We&apos;re getting set up. Please contact us directly to book.
                </p>
                <div className="space-y-2 text-sm text-gray-700">
                  {user.phone && (
                    <a href={`tel:${user.phone}`} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl transition-colors">
                      <span aria-hidden>📞</span> {user.phone}
                    </a>
                  )}
                  {(user.serviceAreas?.[0] || user.city || user.address) && (
                    <p className="text-gray-500 flex items-center justify-center gap-2 mt-3">
                      <span aria-hidden>📍</span>
                      {user.serviceAreas?.[0] || user.city || user.address}
                    </p>
                  )}
                </div>
              </div>
            ) : (user.serviceLayout || "cards") === "cards" ? (
              /* ── CARDS LAYOUT (2-column grid) ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayPackages.map((pkg, i) => (
                  <button key={pkg.id} onClick={() => handlePackageClick(pkg)}
                    style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
                    className="relative text-left bg-white border-2 border-gray-100 rounded-2xl p-4 transition-all duration-300 hover:border-blue-400 hover:shadow-xl hover:-translate-y-1.5 hover:scale-[1.02] group animate-fadeInUp overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/10 transition-all duration-500 rounded-2xl" />
                    {isDemoMode && (
                      <div className="absolute top-2 right-2 z-10 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200">Example</div>
                    )}
                    {isPro && pkg.id === mostPopularId && !isDemoMode && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-xl rounded-tr-2xl shadow-md">Popular</div>
                    )}
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center text-xl mb-3 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                        {packageIcons[pkg.name] ?? "\u{1F697}"}
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-blue-600 transition-colors duration-300">{pkg.name}</h3>
                      <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{pkg.description}</p>
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-2xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">${pkg.price}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {formatDuration(pkg.duration)}
                            </span>
                            {pkg.deposit && pkg.deposit > 0 && (
                              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">${pkg.deposit} dep.</span>
                            )}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-blue-600 flex items-center justify-center transition-all duration-300 flex-shrink-0 group-hover:shadow-lg group-hover:shadow-blue-600/30">
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (user.serviceLayout) === "list" ? (
              /* ── LIST LAYOUT (full-width rows) ── */
              <div className="space-y-3">
                {displayPackages.map((pkg, i) => (
                  <button key={pkg.id} onClick={() => handlePackageClick(pkg)}
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                    className="w-full text-left bg-white border-2 border-gray-100 rounded-2xl p-5 transition-all duration-300 hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5 group animate-fadeInUp relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/[0.02] group-hover:to-indigo-500/[0.05] transition-all duration-500" />
                    {isDemoMode && (
                      <div className="absolute top-2 right-2 z-10 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200">Example</div>
                    )}
                    {isPro && pkg.id === mostPopularId && !isDemoMode && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-bl-xl rounded-tr-2xl shadow-md">Popular</div>
                    )}
                    <div className="flex items-center gap-4 relative">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        {packageIcons[pkg.name] ?? "\u{1F697}"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition-colors">{pkg.name}</h3>
                          <p className="text-2xl font-extrabold text-gray-900 flex-shrink-0 group-hover:text-blue-600 transition-colors">${pkg.price}</p>
                        </div>
                        <p className="text-sm text-gray-500 mb-2 leading-relaxed">{pkg.description}</p>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatDuration(pkg.duration)}
                          </span>
                          {pkg.deposit && pkg.deposit > 0 && (
                            <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full">${pkg.deposit} deposit</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-600 flex items-center justify-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-600/30">
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (user.serviceLayout) === "compact" ? (
              /* ── COMPACT LAYOUT (minimal rows) ── */
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {displayPackages.map((pkg, i) => (
                  <button key={pkg.id} onClick={() => handlePackageClick(pkg)}
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
                    className="w-full text-left px-4 py-3.5 transition-all duration-200 hover:bg-blue-50/50 group animate-fadeInUp flex items-center gap-3 relative">
                    {isDemoMode && (
                      <span className="absolute top-1 right-3 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider">Example</span>
                    )}
                    {isPro && pkg.id === mostPopularId && !isDemoMode && (
                      <span className="absolute top-1 right-3 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Popular</span>
                    )}
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center text-base flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                      {packageIcons[pkg.name] ?? "\u{1F697}"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">{pkg.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{formatDuration(pkg.duration)}</span>
                        {pkg.deposit && pkg.deposit > 0 && (
                          <><span className="text-gray-300">·</span><span className="text-blue-500 font-medium">${pkg.deposit} dep.</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-lg font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors">${pkg.price}</span>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            ) : (user.serviceLayout) === "featured" ? (
              /* ── FEATURED LAYOUT (first item large, rest in grid) ── */
              <div className="space-y-3">
                {displayPackages.slice(0, 1).map((pkg) => (
                  <button key={pkg.id} onClick={() => handlePackageClick(pkg)}
                    style={{ animationFillMode: "both" }}
                    className="w-full text-left bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group animate-fadeInUp relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full" />
                    <div className="absolute -left-5 -bottom-5 w-24 h-24 bg-white/5 rounded-full" />
                    {isDemoMode && (
                      <div className="absolute top-3 right-3 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-200">Example</div>
                    )}
                    {isPro && pkg.id === mostPopularId && !isDemoMode && (
                      <div className="absolute top-3 right-3 bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-sm">Popular</div>
                    )}
                    <div className="relative">
                      <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-2xl mb-4 backdrop-blur-sm">
                        {packageIcons[pkg.name] ?? "\u{1F697}"}
                      </div>
                      <h3 className="text-white font-extrabold text-xl mb-1">{pkg.name}</h3>
                      <p className="text-blue-100 text-sm mb-4 leading-relaxed">{pkg.description}</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-extrabold text-white">${pkg.price}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full">{formatDuration(pkg.duration)}</span>
                            {pkg.deposit && pkg.deposit > 0 && (
                              <span className="text-xs text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full">${pkg.deposit} deposit</span>
                            )}
                          </div>
                        </div>
                        <div className="w-10 h-10 bg-white/20 group-hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {displayPackages.length > 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {displayPackages.slice(1).map((pkg, i) => (
                      <button key={pkg.id} onClick={() => handlePackageClick(pkg)}
                        style={{ animationDelay: `${(i + 1) * 100}ms`, animationFillMode: "both" }}
                        className="relative text-left bg-white border-2 border-gray-100 rounded-2xl p-4 transition-all duration-300 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 group animate-fadeInUp">
                        {isDemoMode && (
                          <div className="absolute top-2 right-2 z-10 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200">Example</div>
                        )}
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition-transform duration-300">
                          {packageIcons[pkg.name] ?? "\u{1F697}"}
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm mb-0.5 group-hover:text-blue-600 transition-colors">{pkg.name}</h3>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-1">{pkg.description}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors">${pkg.price}</p>
                          <span className="text-[10px] text-gray-400">{formatDuration(pkg.duration)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── MINIMAL LAYOUT (text only, clean lines) ── */
              <div className="space-y-0">
                {displayPackages.map((pkg, i) => (
                  <button key={pkg.id} onClick={() => handlePackageClick(pkg)}
                    style={{ animationDelay: `${i * 70}ms`, animationFillMode: "both" }}
                    className="w-full text-left py-5 transition-all duration-200 hover:pl-2 group animate-fadeInUp border-b border-gray-100 last:border-b-0 flex items-center justify-between gap-4 relative">
                    {isDemoMode && (
                      <span className="absolute -top-2 right-0 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider">Example</span>
                    )}
                    {isPro && pkg.id === mostPopularId && !isDemoMode && (
                      <span className="absolute -top-2 left-0 text-[9px] font-bold text-amber-600 uppercase tracking-wider">Popular</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition-colors">{pkg.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{pkg.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{formatDuration(pkg.duration)}</span>
                        {pkg.deposit && pkg.deposit > 0 && (
                          <><span className="text-gray-300">·</span><span>${pkg.deposit} deposit</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-2xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors">${pkg.price}</span>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-8 bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl p-5">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Why customers love us</p>
              {/* Enhancement 3: Expanded trust indicators for Pro */}
              {isPro ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: "\u{1F4AF}", label: "100% Satisfaction Guaranteed" },
                    { icon: "\u{1F4DC}", label: "Licensed & Insured" },
                    { icon: "\u2705", label: "Background Checked" },
                    { icon: "\u{1F33F}", label: "Eco-Friendly Products" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-2xl mb-1">{icon}</div>
                      <p className="text-white/70 text-xs font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { icon: "\u{1F6E1}\uFE0F", label: "Fully Insured" },
                    { icon: "\u2B50", label: "5-Star Rated" },
                    { icon: "\u{1F697}", label: "Quality Guaranteed" },
                  ].map(({ icon, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-2xl mb-1">{icon}</div>
                      <p className="text-white/70 text-xs font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enhancement 5: Review Highlights for Pro */}
            {isPro && user.rating && (user.reviewCount ?? 0) > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-extrabold text-gray-900 mb-1">What Customers Say</h3>
                <p className="text-gray-400 text-sm mb-4">Hear from our happy customers</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PLACEHOLDER_REVIEWS.map((review, i) => (
                    <div
                      key={i}
                      className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
                    >
                      <MiniStarRating rating={review.rating} />
                      <p className="text-gray-600 text-sm mt-2.5 leading-relaxed italic">
                        &ldquo;{review.quote}&rdquo;
                      </p>
                      <p className="text-gray-900 text-xs font-bold mt-3">{review.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Date & Time ── */}
        {step === 1 && (
          <div className="animate-fadeInUp">
            {/* Selected service summary */}
            <div className="bg-blue-600 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                  {packageIcons[selectedPackage?.name ?? ""] ?? "\u{1F697}"}
                </div>
                <div>
                  <p className="text-white font-bold">{selectedPackage?.name}</p>
                  <p className="text-blue-200 text-xs">
                    {selectedPackage && formatDuration(selectedPackage.duration)}
                    {chosenAddons.length > 0 && ` · +${chosenAddons.length} add-on${chosenAddons.length === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-extrabold text-xl">${totalPrice}</p>
                {addonsTotal > 0 && (
                  <p className="text-blue-200 text-[11px] leading-tight">${selectedPackage?.price} + ${addonsTotal}</p>
                )}
                <button onClick={() => setStep(0)} className="text-blue-300 text-xs hover:text-white transition-colors">Change</button>
              </div>
            </div>

            {/* Add-ons (only shown when the package has any) */}
            {availableAddons.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-900 text-base">Add-ons</h3>
                  <span className="text-xs text-gray-400">Optional</span>
                </div>
                <p className="text-gray-500 text-xs mb-4">Boost your detail with any of these extras.</p>
                <div className="space-y-2">
                  {availableAddons.map((addon) => {
                    const checked = selectedAddonIds.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.id)}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          checked
                            ? "border-blue-500 bg-blue-50/70 shadow-sm"
                            : "border-gray-100 hover:border-blue-200 hover:bg-blue-50/30"
                        }`}
                      >
                        <span className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                        }`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-gray-900 truncate">{addon.name}</span>
                        </span>
                        <span className={`flex-shrink-0 text-sm font-extrabold ${checked ? "text-blue-700" : "text-gray-700"}`}>
                          +${addon.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {chosenAddons.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{chosenAddons.length} selected</span>
                    <span className="font-bold text-gray-900">+${addonsTotal}</span>
                  </div>
                )}
              </div>
            )}

            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Pick a Date</h2>
            <p className="text-gray-500 text-sm mb-5">Choose when you&apos;d like the service done.</p>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="font-bold text-gray-900">{MONTHS[month]} {year}</h3>
                <button onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 mb-2">
                  {DAYS_SHORT.map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, i) => {
                    if (!date) return <div key={i} />;
                    const dateStr = toLocalYMD(date);
                    const disabled = isDateDisabled(date);
                    const isSelected = dateStr === selectedDate;
                    const isTodayDate = dateStr === todayInBizTz;
                    return (
                      <button key={i} onClick={() => { if (!disabled) { setSelectedDate(dateStr); setSelectedTime(null); setSelectedStaff(null); } }} disabled={disabled}
                        className={`aspect-square w-full rounded-xl text-sm font-medium transition-all duration-200 ${
                          disabled ? "text-gray-300 cursor-not-allowed" :
                          isSelected ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105" :
                          isTodayDate ? "bg-blue-50 text-blue-600 border-2 border-blue-200 hover:bg-blue-100" :
                          "text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                        }`}>
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 animate-fadeInUp">
                <h3 className="font-bold text-gray-900 mb-1 text-sm">
                  Available Times
                </h3>
                <p className="text-gray-400 text-xs mb-4">{formatDate(selectedDate)}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {availableTimes.length === 0 && (
                    <p className="col-span-full text-sm text-gray-500 py-4 text-center">
                      Closed on this day. Please choose another date.
                    </p>
                  )}
                  {availableTimes.map((time) => {
                    const booked = isTimeBooked(time);
                    const outsideHours = isTimeOutsideBusinessHours(time);
                    const past = isTimeInPast(time);
                    const disabled = booked || outsideHours || past;
                    return (
                      <button key={time} onClick={() => !disabled && setSelectedTime(time)} disabled={disabled}
                        className={`py-3 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                          disabled
                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through"
                            : selectedTime === time
                              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30 scale-105"
                              : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                        }`}>
                        {booked ? "Booked" : outsideHours ? "Closed" : past ? "Past" : time}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!selectedDate || !selectedTime}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5">
              {selectedDate && selectedTime
                ? `Continue \u2192 ${selectedTime}`
                : "Select a date and time"}
            </button>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 2 && (
          <div className="animate-fadeInUp">
            {/* Summary bar */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-white font-bold">{selectedPackage?.name}</p>
                  <p className="text-blue-300 text-xs">
                    {selectedDate ? formatDate(selectedDate) : ""} · {selectedTime}
                    {chosenAddons.length > 0 && ` · ${chosenAddons.length} add-on${chosenAddons.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-extrabold text-lg">${totalPrice}</p>
                  <button onClick={() => setStep(1)} className="text-blue-400 text-xs hover:text-white transition-colors">Change</button>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Your Details</h2>
            <p className="text-gray-500 text-sm mb-6">Tell us about yourself and your vehicle.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── "Both" mode: customer chooses mobile or shop ── */}
              {serviceType === "both" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Service Location</h3>
                      <p className="text-xs text-gray-400">Choose how you&apos;d like to be served</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => { setSelectedServiceMode("mobile"); setCustomerAddress(""); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${selectedServiceMode === "mobile" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <svg className={`w-5 h-5 mb-2 ${selectedServiceMode === "mobile" ? "text-blue-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      <p className={`text-sm font-bold ${selectedServiceMode === "mobile" ? "text-blue-700" : "text-gray-800"}`}>We come to you</p>
                      <p className="text-xs text-gray-500 mt-0.5">Mobile service at your location</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedServiceMode("shop"); setCustomerAddress(""); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${selectedServiceMode === "shop" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <svg className={`w-5 h-5 mb-2 ${selectedServiceMode === "shop" ? "text-blue-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className={`text-sm font-bold ${selectedServiceMode === "shop" ? "text-blue-700" : "text-gray-800"}`}>Come to our shop</p>
                      <p className="text-xs text-gray-500 mt-0.5">Drop off at our location</p>
                    </button>
                  </div>
                  {selectedServiceMode === "shop" && user.address && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-blue-800 text-xs font-bold">{user.address}</p>
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(user.address)}`} target="_blank" rel="noreferrer"
                          className="text-blue-500 text-xs font-semibold hover:text-blue-700 transition-colors">
                          Get Directions →
                        </a>
                      </div>
                    </div>
                  )}
                  {selectedServiceMode === "mobile" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Your Address <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        required
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="123 Main Street, City, State ZIP"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300 text-sm transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── Shop only: show shop address ── */}
              {serviceType === "shop" && user.address && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-blue-800 font-bold text-sm">Come to our shop</p>
                    <p className="text-blue-600 text-xs mt-0.5">{user.address}</p>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(user.address)}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 text-xs font-semibold mt-1.5 hover:text-blue-700 transition-colors">
                      Get Directions →
                    </a>
                  </div>
                </div>
              )}

              {/* ── Mobile only: customer address field ── */}
              {serviceType === "mobile" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Service Location</h3>
                      <p className="text-xs text-gray-400">Where should we come to detail your vehicle?</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Your Address <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="123 Main Street, City, State ZIP"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300 text-sm transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Staff Selection — only shown when business has active staff */}
              {staffList.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Choose Your Detailer</h3>
                      <p className="text-xs text-gray-400">Pick a staff member or let us assign one</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* No preference option */}
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                        selectedStaff === null
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-gray-50 hover:border-blue-300"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg">
                        🎲
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-800">No Preference</p>
                        <p className="text-[10px] text-gray-400">We&apos;ll assign the best available</p>
                      </div>
                    </button>
                    {staffList.filter((member) => {
                      // Hide staff who are booked at the selected date+time
                      if (!selectedDate || !selectedTime) return true;
                      return !bookedSlots.some((s) => s.date === selectedDate && s.time === selectedTime && s.staffId === member.id);
                    }).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedStaff(member)}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                          selectedStaff?.id === member.id
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-gray-50 hover:border-blue-300"
                        }`}
                      >
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm"
                            style={{ backgroundColor: member.color || "#3B82F6" }}
                          >
                            {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-gray-800">{member.name.split(" ")[0]}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{member.role}</p>
                        </div>
                        {selectedStaff?.id === member.id && (
                          <div className="absolute top-2 right-2 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Vehicle Information</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "make",  label: "Make",  placeholder: "Toyota" },
                    { key: "model", label: "Model", placeholder: "Camry" },
                    { key: "year",  label: "Year",  placeholder: "2022" },
                    { key: "color", label: "Color", placeholder: "Silver" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input type="text" required value={form[key as keyof BookingForm]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300 text-sm transition-all" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-gray-900">Contact Information</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { key: "customerName",  label: "Full Name",     type: "text",  placeholder: "Your full name" },
                    { key: "customerEmail", label: "Email Address", type: "email", placeholder: "you@example.com" },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                      <input type={type} required value={form[key as keyof BookingForm]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300 text-sm transition-all" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Phone Number</label>
                    <div className="flex items-stretch border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                      <select
                        value={phoneCountry}
                        onChange={(e) => {
                          const next = e.target.value as "+1" | "+383";
                          setPhoneCountry(next);
                          // Reset the phone value so the new format applies cleanly.
                          setForm({ ...form, customerPhone: "" });
                        }}
                        className="bg-gray-50 border-r border-gray-200 text-sm text-gray-700 font-semibold pl-3 pr-2 focus:outline-none cursor-pointer"
                        aria-label="Country code"
                      >
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+383">🇽🇰 +383</option>
                      </select>
                      <input
                        type="tel"
                        required
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={form.customerPhone.replace(new RegExp(`^\\${phoneCountry}\\s?`), "")}
                        onChange={(e) => {
                          const maxDigits = phoneCountry === "+1" ? 10 : 9;
                          const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
                          let local = "";
                          if (digits.length === 0) {
                            local = "";
                          } else if (phoneCountry === "+1") {
                            if (digits.length <= 3) local = `(${digits}`;
                            else if (digits.length <= 6) local = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                            else local = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                          } else {
                            // +383: format as "XX XXX XXX" / "XX XXX XXXX"
                            if (digits.length <= 2) local = digits;
                            else if (digits.length <= 5) local = `${digits.slice(0, 2)} ${digits.slice(2)}`;
                            else local = `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
                          }
                          setForm({ ...form, customerPhone: local ? `${phoneCountry} ${local}` : "" });
                        }}
                        placeholder={phoneCountry === "+1" ? "(555) 123-4567" : "49 384 457"}
                        className="flex-1 px-4 py-3 text-gray-900 focus:outline-none placeholder-gray-300 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
                    <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Any special requests or things we should know..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300 text-sm resize-none transition-all" />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl p-5 text-white">
                <h3 className="font-bold mb-4 text-sm uppercase tracking-widest text-white/50">Order Summary</h3>
                <div className="space-y-2.5 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">{selectedPackage?.name}</span>
                    <span className="font-semibold">${selectedPackage?.price}</span>
                  </div>
                  {chosenAddons.map((addon) => (
                    <div key={addon.id} className="flex justify-between text-sm">
                      <span className="text-white/50 pl-3">+ {addon.name}</span>
                      <span className="font-semibold text-white/80">${addon.price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Date</span>
                    <span className="font-semibold">{selectedDate ? formatDate(selectedDate) : ""}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Time</span>
                    <span className="font-semibold">{selectedTime}</span>
                  </div>
                  {customerAddress && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Location</span>
                      <span className="font-semibold text-right max-w-[180px] text-xs">{customerAddress}</span>
                    </div>
                  )}
                  {selectedStaff && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Detailer</span>
                      <span className="font-semibold">{selectedStaff.name}</span>
                    </div>
                  )}
                </div>

                {chosenAddons.length > 0 && (
                  <div className="flex justify-between items-center pb-3 mb-3 border-b border-white/10">
                    <span className="text-white/70 text-sm font-semibold">Total</span>
                    <span className="text-xl font-extrabold">${totalPrice}</span>
                  </div>
                )}

                {depositAmount > 0 && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 mb-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">Deposit Required</p>
                        <p className="text-white/50 text-xs mt-0.5">Secures your booking</p>
                      </div>
                      <p className="text-3xl font-extrabold text-white">${depositAmount}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-white/10 text-sm">
                  <span className="text-white/50">{depositAmount > 0 ? "Balance due on service day" : "Total due on service day"}</span>
                  <span className="text-lg font-bold">${totalPrice - depositAmount}</span>
                </div>
              </div>

              {bookingError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {bookingError}
                </div>
              )}

              <label className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-blue-600 cursor-pointer"
                />
                <span className="text-gray-700 text-xs leading-relaxed">
                  I agree to receive SMS appointment reminders from this business. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. <span className="text-gray-400">(optional)</span>
                </span>
              </label>

              {(() => {
                const pm = (user as any)?.paymentMethods;
                const needsPayment = depositAmount > 0 && getEnabledPaymentMethods(pm).length > 0;
                const submitLabel = submitting
                  ? (needsPayment ? "Loading..." : "Confirming your booking...")
                  : needsPayment
                    ? `Continue to Payment \u2192`
                    : depositAmount > 0
                      ? `Confirm Booking \u00b7 $${depositAmount} Deposit`
                      : "Confirm Booking";
                return (
              <button type="submit" disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-white font-extrabold text-base py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-3">
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {submitLabel}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={needsPayment ? "M9 5l7 7-7 7" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                    </svg>
                    {submitLabel}
                  </>
                )}
              </button>
                );
              })()}

              <p className="text-center text-gray-400 text-xs leading-relaxed">
                By booking, you agree to our cancellation policy. Deposits are fully refundable up to 24 hours before your appointment.
              </p>
            </form>
          </div>
        )}

        {/* ── Step 3: Payment ── */}
        {step === 3 && selectedPackage && (
          <div className="animate-fadeInUp">
            {/* Summary bar */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-white font-bold">{selectedPackage.name}</p>
                  <p className="text-blue-300 text-xs">
                    {selectedDate ? formatDate(selectedDate) : ""} · {selectedTime}
                    {chosenAddons.length > 0 && ` · ${chosenAddons.length} add-on${chosenAddons.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-extrabold text-lg">${depositAmount}</p>
                  <p className="text-blue-400 text-xs">Deposit · ${totalPrice} total</p>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Choose How to Pay</h2>
            <p className="text-gray-500 text-sm mb-6">Pick a payment method to secure your booking.</p>

            {/* Method picker */}
            {(() => {
              const pm = (user as any)?.paymentMethods;
              const methods = getEnabledPaymentMethods(pm);
              return (
                <div className="space-y-2.5 mb-5">
                  {methods.map((m) => {
                    const selected = selectedPaymentMethod === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setSelectedPaymentMethod(m.key);
                          setManualPaymentConfirmed(false);
                          setBookingError(null);
                        }}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                          selected
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                        }`}
                      >
                        <span className="text-2xl flex-shrink-0">{m.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 text-sm font-bold">{m.label}</p>
                          <p className="text-gray-500 text-xs truncate">{m.detail}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          selected ? "bg-blue-600" : "border-2 border-gray-300"
                        }`}>
                          {selected && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Method-specific action panel */}
            {selectedPaymentMethod && (() => {
              const pm = (user as any)?.paymentMethods;
              const isCard = selectedPaymentMethod === "stripe" || selectedPaymentMethod === "square";

              return (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm animate-fadeInUp">
                  {selectedPaymentMethod === "stripe" && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💳</span>
                        <h3 className="text-gray-900 font-bold text-sm">Pay by Card</h3>
                      </div>
                      <p className="text-gray-500 text-sm mb-4">
                        Pay your <strong className="text-gray-900">${depositAmount}</strong> deposit securely with credit or debit card. Your booking will be confirmed automatically.
                      </p>
                    </>
                  )}

                  {selectedPaymentMethod === "square" && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💳</span>
                        <h3 className="text-gray-900 font-bold text-sm">Pay by Card</h3>
                      </div>
                      <p className="text-gray-500 text-sm mb-4">
                        Pay your <strong className="text-gray-900">${depositAmount}</strong> deposit securely with credit or debit card. Your booking will be confirmed automatically.
                      </p>
                    </>
                  )}

                  {selectedPaymentMethod === "paypal" && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🅿️</span>
                        <h3 className="text-gray-900 font-bold text-sm">Pay with PayPal</h3>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">
                        Send <strong className="text-gray-900">${depositAmount}</strong> to:
                      </p>
                      {pm?.paypal?.email && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between mb-3">
                          <span className="text-gray-900 font-mono text-sm break-all">{pm.paypal.email}</span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(pm.paypal.email)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold ml-2 flex-shrink-0"
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      {pm?.paypal?.paypalMeLink && (
                        <a
                          href={`https://paypal.me/${pm.paypal.paypalMeLink}/${depositAmount}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors mb-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open PayPal
                        </a>
                      )}
                    </>
                  )}

                  {selectedPaymentMethod === "cashapp" && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💵</span>
                        <h3 className="text-gray-900 font-bold text-sm">Pay with Cash App</h3>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">
                        Send <strong className="text-gray-900">${depositAmount}</strong> to:
                      </p>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-gray-900 font-bold text-base">${pm?.cashapp?.cashtag}</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(`$${pm?.cashapp?.cashtag}`)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          Copy
                        </button>
                      </div>
                    </>
                  )}

                  {selectedPaymentMethod === "bankTransfer" && (() => {
                    const bt = pm?.bankTransfer;
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl">🏦</span>
                          <h3 className="text-gray-900 font-bold text-sm">Bank Transfer</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">
                          Transfer <strong className="text-gray-900">${depositAmount}</strong> to:
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                          {bt?.bankName && <div className="flex justify-between text-sm"><span className="text-gray-500">Bank</span><span className="text-gray-900 font-semibold">{bt.bankName}</span></div>}
                          {bt?.accountName && <div className="flex justify-between text-sm"><span className="text-gray-500">Account Name</span><span className="text-gray-900 font-semibold">{bt.accountName}</span></div>}
                          {bt?.iban && <div className="flex justify-between text-sm"><span className="text-gray-500">IBAN</span><span className="text-gray-900 font-mono font-semibold">{bt.iban}</span></div>}
                          {bt?.sortCode && <div className="flex justify-between text-sm"><span className="text-gray-500">Sort Code</span><span className="text-gray-900 font-mono font-semibold">{bt.sortCode}</span></div>}
                          {bt?.accountNumber && <div className="flex justify-between text-sm"><span className="text-gray-500">Account #</span><span className="text-gray-900 font-mono font-semibold">{bt.accountNumber}</span></div>}
                        </div>
                        {bt?.instructions && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                            <p className="text-amber-800 text-xs">{bt.instructions}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {selectedPaymentMethod === "cash" && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">💰</span>
                        <h3 className="text-gray-900 font-bold text-sm">Cash on Arrival</h3>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Bring <strong className="text-gray-900">${depositAmount}</strong> in cash on the day of your appointment. No payment needed now — just confirm to send your request.
                      </p>
                      {pm?.cash?.instructions && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                          <p className="text-amber-800 text-xs">{pm.cash.instructions}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Action area: card vs manual ── */}
                  {isCard ? (
                    <button
                      type="button"
                      onClick={handleCardPaymentStart}
                      className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-base py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay ${depositAmount} Now
                    </button>
                  ) : selectedPaymentMethod === "cash" ? (
                    <button
                      type="button"
                      onClick={handleManualPaymentSubmit}
                      disabled={submitting}
                      className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-extrabold text-base py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Submit Booking Request
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <label className="flex items-start gap-3 bg-gray-50 border-2 border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-100 transition-colors mt-5">
                        <input
                          type="checkbox"
                          checked={manualPaymentConfirmed}
                          onChange={(e) => setManualPaymentConfirmed(e.target.checked)}
                          className="mt-0.5 w-5 h-5 flex-shrink-0 accent-blue-600 cursor-pointer"
                        />
                        <div>
                          <p className="text-gray-900 text-sm font-bold">I have sent the ${depositAmount} payment</p>
                          <p className="text-gray-500 text-xs mt-0.5">Tick this once you&apos;ve completed the transfer. The business will verify and confirm your booking.</p>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={handleManualPaymentSubmit}
                        disabled={submitting || !manualPaymentConfirmed}
                        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold text-base py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Submit Booking Request
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

            {bookingError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl flex items-start gap-2 mb-4">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {bookingError}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full text-gray-500 hover:text-gray-700 text-sm font-semibold py-3 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to your details
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      {/* Enhancement 7: Powered by badge for Starter only (white-label for Pro) */}
      {!isPro ? (
        <div className="border-t border-gray-100 mt-8 py-6 text-center bg-white">
          <p className="text-xs text-gray-400">
            Booking powered by{" "}
            <a href="/" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
              {platformName}
            </a>
          </p>
        </div>
      ) : (
        <div className="mt-8 py-6" />
      )}

      {/* Stripe embedded payment modal — booking is created only after success */}
      {stripeModalOpen && selectedPackage && pendingStripeBookingData && (
        <StripeDepositModal
          open
          publishableKey={(user as any)?.paymentMethods?.stripe?.publishableKey || ""}
          userId={(user as any)?.id || ""}
          amount={depositAmount}
          customerEmail={form.customerEmail}
          serviceName={selectedPackage.name}
          onSuccess={async (paymentIntentId) => {
            try {
              const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...pendingStripeBookingData,
                  depositPaid: depositAmount,
                  paymentProof: `stripe:${paymentIntentId}`,
                  status: "confirmed",
                }),
              });
              if (res.ok) {
                const created = await res.json();
                setBookingId(created.id);
                setStripeDepositPaid(true);
                setBookingStatusReturned("confirmed");
                setStripeModalOpen(false);
                setPendingStripeBookingData(null);
                setStep(4);
              } else {
                setBookingError("Payment succeeded but we couldn't save your booking. Please contact the business — your card was charged.");
                setStripeModalOpen(false);
              }
            } catch {
              setBookingError("Payment succeeded but we couldn't save your booking. Please contact the business — your card was charged.");
              setStripeModalOpen(false);
            }
          }}
          onClose={() => {
            // No booking was created — closing is safe.
            setStripeModalOpen(false);
            setPendingStripeBookingData(null);
          }}
        />
      )}

      {/* Square embedded payment modal — booking is created only after success */}
      {squareModalOpen && selectedPackage && pendingSquareBookingData && (
        <SquareDepositModal
          open
          applicationId={(user as any)?.paymentMethods?.square?.applicationId || ""}
          locationId={(user as any)?.paymentMethods?.square?.locationId || ""}
          sandbox={!!(user as any)?.paymentMethods?.square?.sandbox}
          userId={(user as any)?.id || ""}
          amount={depositAmount}
          customerEmail={form.customerEmail}
          serviceName={selectedPackage.name}
          onSuccess={async (paymentId) => {
            try {
              const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...pendingSquareBookingData,
                  depositPaid: depositAmount,
                  paymentProof: `square:${paymentId}`,
                  status: "confirmed",
                }),
              });
              if (res.ok) {
                const created = await res.json();
                setBookingId(created.id);
                setStripeDepositPaid(true);
                setBookingStatusReturned("confirmed");
                setSquareModalOpen(false);
                setPendingSquareBookingData(null);
                setStep(4);
              } else {
                setBookingError("Payment succeeded but we couldn't save your booking. Please contact the business — your card was charged.");
                setSquareModalOpen(false);
              }
            } catch {
              setBookingError("Payment succeeded but we couldn't save your booking. Please contact the business — your card was charged.");
              setSquareModalOpen(false);
            }
          }}
          onClose={() => {
            setSquareModalOpen(false);
            setPendingSquareBookingData(null);
          }}
        />
      )}
    </div>
  );
}
