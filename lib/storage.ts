import type { User, Package, Booking } from "@/types";

// ---------------------------------------------------------------------------
// Hybrid storage layer: localStorage (instant sync reads) + API (MySQL persistence)
//
// Every "get" reads from localStorage synchronously.
// Every "set" writes to localStorage AND fires a background API call.
// `syncFromServer()` pulls fresh data from the API into localStorage.
// `syncToServer()` pushes the current localStorage state up to the API.
// ---------------------------------------------------------------------------

const KEYS = {
  USER: "detailbook_user",
  PACKAGES: "detailbook_packages",
  BOOKINGS: "detailbook_bookings",
  IS_LOGGED_IN: "detailbook_logged_in",
};

// ---------------------------------------------------------------------------
// Default mock / fallback data (kept for backwards-compat exports)
// ---------------------------------------------------------------------------

export const DEFAULT_PACKAGES: Package[] = [
  {
    id: "pkg-1",
    name: "Basic Wash & Shine",
    description: "Exterior hand wash, tire dressing, window cleaning, and interior vacuum.",
    price: 79,
    duration: 90,
    active: true,
  },
  {
    id: "pkg-2",
    name: "Full Detail",
    description: "Complete interior and exterior detail. Clay bar, polish, wax, deep interior clean.",
    price: 199,
    duration: 240,
    active: true,
  },
  {
    id: "pkg-3",
    name: "Interior Detail",
    description: "Deep interior cleaning, steam treatment, leather conditioning, odor elimination.",
    price: 149,
    duration: 180,
    active: true,
  },
  {
    id: "pkg-4",
    name: "Ceramic Coating",
    description: "Professional 9H ceramic coating with 2-year protection warranty. Paint correction included.",
    price: 599,
    duration: 480,
    active: true,
  },
];

export const DEFAULT_BOOKINGS: Booking[] = [
  {
    id: "bk-1",
    customerName: "James Wilson",
    customerEmail: "james.wilson@email.com",
    customerPhone: "555-234-5678",
    vehicle: { make: "Toyota", model: "Camry", year: "2021", color: "Silver" },
    serviceId: "pkg-2",
    serviceName: "Full Detail",
    servicePrice: 199,
    date: "2026-03-25",
    time: "10:00 AM",
    status: "confirmed",
    depositPaid: 50,
    depositRequired: 50,
    notes: "Please focus on the dog hair in the back seats.",
  },
  {
    id: "bk-2",
    customerName: "Sarah Martinez",
    customerEmail: "sarah.m@email.com",
    customerPhone: "555-345-6789",
    vehicle: { make: "BMW", model: "X5", year: "2022", color: "Black" },
    serviceId: "pkg-4",
    serviceName: "Ceramic Coating",
    servicePrice: 599,
    date: "2026-03-27",
    time: "9:00 AM",
    status: "confirmed",
    depositPaid: 150,
    depositRequired: 150,
    notes: "Brand new car, wants maximum protection.",
  },
  {
    id: "bk-3",
    customerName: "David Chen",
    customerEmail: "d.chen@email.com",
    customerPhone: "555-456-7890",
    vehicle: { make: "Ford", model: "F-150", year: "2020", color: "Blue" },
    serviceId: "pkg-1",
    serviceName: "Basic Wash & Shine",
    servicePrice: 79,
    date: "2026-03-22",
    time: "2:00 PM",
    status: "pending",
    depositPaid: 0,
    depositRequired: 20,
    notes: "",
  },
  {
    id: "bk-4",
    customerName: "Emily Rodriguez",
    customerEmail: "emily.r@email.com",
    customerPhone: "555-567-8901",
    vehicle: { make: "Honda", model: "CR-V", year: "2019", color: "White" },
    serviceId: "pkg-3",
    serviceName: "Interior Detail",
    servicePrice: 149,
    date: "2026-03-18",
    time: "11:00 AM",
    status: "completed",
    depositPaid: 37,
    depositRequired: 37,
    notes: "Kids made a mess. Coffee stains on seats.",
  },
  {
    id: "bk-5",
    customerName: "Michael Thompson",
    customerEmail: "m.thompson@email.com",
    customerPhone: "555-678-9012",
    vehicle: { make: "Chevrolet", model: "Silverado", year: "2023", color: "Red" },
    serviceId: "pkg-2",
    serviceName: "Full Detail",
    servicePrice: 199,
    date: "2026-03-15",
    time: "10:00 AM",
    status: "completed",
    depositPaid: 50,
    depositRequired: 50,
    notes: "",
  },
  {
    id: "bk-6",
    customerName: "Ashley Brown",
    customerEmail: "ashley.b@email.com",
    customerPhone: "555-789-0123",
    vehicle: { make: "Audi", model: "A4", year: "2021", color: "Gray" },
    serviceId: "pkg-4",
    serviceName: "Ceramic Coating",
    servicePrice: 599,
    date: "2026-03-10",
    time: "9:00 AM",
    status: "completed",
    depositPaid: 150,
    depositRequired: 150,
    notes: "Repeat customer. Very happy with results.",
  },
  {
    id: "bk-7",
    customerName: "Kevin Park",
    customerEmail: "kevin.p@email.com",
    customerPhone: "555-890-1234",
    vehicle: { make: "Tesla", model: "Model 3", year: "2022", color: "White" },
    serviceId: "pkg-1",
    serviceName: "Basic Wash & Shine",
    servicePrice: 79,
    date: "2026-04-02",
    time: "1:00 PM",
    status: "pending",
    depositPaid: 0,
    depositRequired: 20,
    notes: "",
  },
  {
    id: "bk-8",
    customerName: "Lisa Johnson",
    customerEmail: "lisa.j@email.com",
    customerPhone: "555-901-2345",
    vehicle: { make: "Jeep", model: "Grand Cherokee", year: "2020", color: "Black" },
    serviceId: "pkg-3",
    serviceName: "Interior Detail",
    servicePrice: 149,
    date: "2026-03-05",
    time: "11:00 AM",
    status: "cancelled",
    depositPaid: 0,
    depositRequired: 37,
    notes: "Customer cancelled due to travel.",
  },
  {
    id: "bk-9",
    customerName: "Robert Garcia",
    customerEmail: "robert.g@email.com",
    customerPhone: "555-012-3456",
    vehicle: { make: "Mercedes", model: "C300", year: "2023", color: "Silver" },
    serviceId: "pkg-2",
    serviceName: "Full Detail",
    servicePrice: 199,
    date: "2026-04-05",
    time: "10:00 AM",
    status: "confirmed",
    depositPaid: 50,
    depositRequired: 50,
    notes: "Preparing for car show.",
  },
];

export const DEFAULT_USER: User = {
  id: "user-1",
  businessName: "Mike's Mobile Detailing",
  name: "Mike Anderson",
  email: "mike@mikesmobiledetailing.com",
  phone: "(512) 555-1234",
  city: "Austin, TX",
  slug: "mikes-mobile-detailing",
  plan: "starter",
  trialEndsAt: "2026-04-21",
  bio: "Professional mobile auto detailer with 8+ years of experience. I bring the shine to your driveway using only premium ceramic-grade products. Certified by the International Detailing Association.",
  address: "Austin, TX 78701",
  emailReminders: true,
  customMessage: "Thanks for booking with Mike's Mobile Detailing! I'll arrive on time and use only premium products. Your car will look showroom-fresh.",
  advanceBookingDays: 30,
  rating: 4.9,
  reviewCount: 127,
  yearsInBusiness: 8,
  serviceAreas: ["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown"],
  instagram: "mikesmobiledetailing",
  facebook: "mikesmobiledetailing",
  website: "mikesmobiledetailing.com",
  businessHours: {
    monday:    { open: "8:00 AM", close: "6:00 PM", closed: false },
    tuesday:   { open: "8:00 AM", close: "6:00 PM", closed: false },
    wednesday: { open: "8:00 AM", close: "6:00 PM", closed: false },
    thursday:  { open: "8:00 AM", close: "6:00 PM", closed: false },
    friday:    { open: "8:00 AM", close: "5:00 PM", closed: false },
    saturday:  { open: "9:00 AM", close: "4:00 PM", closed: false },
    sunday:    { open: "10:00 AM", close: "2:00 PM", closed: true },
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Fire-and-forget fetch wrapper. Logs errors but never throws into the caller. */
function apiFire(
  url: string,
  options: RequestInit = {},
): void {
  fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...((options.headers as Record<string, string>) ?? {}) },
    ...options,
  }).catch((err) => {
    console.warn(`[storage] background API call failed (${options.method ?? "GET"} ${url}):`, err);
  });
}

/** Awaitable fetch wrapper with JSON parsing. Returns null on any failure. */
async function apiCall<T>(
  url: string,
  options: RequestInit = {},
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...((options.headers as Record<string, string>) ?? {}) },
      ...options,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[storage] API call failed (${options.method ?? "GET"} ${url}):`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(KEYS.USER);
  if (!data) return null;
  try {
    return JSON.parse(data) as User;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.USER, JSON.stringify(user));

  // Background sync to API
  apiFire("/api/user", {
    method: "PUT",
    body: JSON.stringify(user),
  });
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export function getPackages(): Package[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.PACKAGES);
  if (!data) return [];
  try {
    return JSON.parse(data) as Package[];
  } catch {
    return [];
  }
}

export function setPackages(packages: Package[]): void {
  if (typeof window === "undefined") return;

  // Determine diff against what we had before so we can make granular API calls
  const prev = getPackages();
  localStorage.setItem(KEYS.PACKAGES, JSON.stringify(packages));

  // Build lookup of previous packages by id
  const prevMap = new Map(prev.map((p) => [p.id, p]));
  const newMap = new Map(packages.map((p) => [p.id, p]));

  // Packages that were removed
  for (const old of prev) {
    if (!newMap.has(old.id)) {
      apiFire(`/api/packages/${old.id}`, { method: "DELETE" });
    }
  }

  // Packages that are new or updated
  for (const pkg of packages) {
    const existing = prevMap.get(pkg.id);
    if (!existing) {
      // New package
      apiFire("/api/packages", {
        method: "POST",
        body: JSON.stringify(pkg),
      });
    } else if (JSON.stringify(existing) !== JSON.stringify(pkg)) {
      // Updated package
      apiFire(`/api/packages/${pkg.id}`, {
        method: "PUT",
        body: JSON.stringify(pkg),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export function getBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.BOOKINGS);
  if (!data) return [];
  try {
    return JSON.parse(data) as Booking[];
  } catch {
    return [];
  }
}

export function setBookings(bookings: Booking[]): void {
  if (typeof window === "undefined") return;

  const prev = getBookings();
  localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bookings));

  const prevMap = new Map(prev.map((b) => [b.id, b]));
  const newMap = new Map(bookings.map((b) => [b.id, b]));

  // Deleted bookings
  for (const old of prev) {
    if (!newMap.has(old.id)) {
      apiFire(`/api/bookings/${old.id}`, { method: "DELETE" });
    }
  }

  // New or updated bookings
  for (const booking of bookings) {
    const existing = prevMap.get(booking.id);
    if (!existing) {
      apiFire("/api/bookings", {
        method: "POST",
        body: JSON.stringify(booking),
      });
    } else if (JSON.stringify(existing) !== JSON.stringify(booking)) {
      apiFire(`/api/bookings/${booking.id}`, {
        method: "PUT",
        body: JSON.stringify(booking),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEYS.IS_LOGGED_IN) === "true";
}

/**
 * Mark the user as logged-in in localStorage.
 * The actual API POST /api/auth/login is performed by the login page via fetch;
 * this function only sets the local flag.
 */
export function login(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.IS_LOGGED_IN, "true");
}

/**
 * Log out: clear the local flag AND call the API to clear the auth cookie.
 */
export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.IS_LOGGED_IN, "false");

  // Clear server-side session / cookie
  apiFire("/api/auth/logout", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialise the app. If the user is logged in, pull fresh data from the
 * server into localStorage. Falls back to defaults if the server is
 * unreachable or the user is not authenticated.
 */
export function initializeDemo(): void {
  if (typeof window === "undefined") return;

  // Kick off a server sync in the background. If it succeeds the localStorage
  // values will be replaced with real DB data.
  syncFromServer().catch(() => {
    // If the sync fails (e.g. not logged in, offline), seed defaults so the
    // app still works.
    if (!localStorage.getItem(KEYS.USER)) {
      localStorage.setItem(KEYS.USER, JSON.stringify(DEFAULT_USER));
    }
    if (!localStorage.getItem(KEYS.PACKAGES)) {
      localStorage.setItem(KEYS.PACKAGES, JSON.stringify(DEFAULT_PACKAGES));
    }
    if (!localStorage.getItem(KEYS.BOOKINGS)) {
      localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(DEFAULT_BOOKINGS));
    }
  });
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ---------------------------------------------------------------------------
// Server → localStorage synchronisation
// ---------------------------------------------------------------------------

interface SyncUserResponse {
  user: {
    id: string;
    packages?: any[];
    bookings?: any[];
    [key: string]: unknown;
  };
}

/** Transform a DB booking (flat vehicle fields) to frontend Booking (nested vehicle object) */
function transformBooking(b: any): Booking {
  if (b.vehicle) return b; // already transformed
  return {
    ...b,
    vehicle: {
      make: b.vehicleMake || "",
      model: b.vehicleModel || "",
      year: b.vehicleYear || "",
      color: b.vehicleColor || "",
    },
  };
}

/**
 * Pull data from the API and write it into localStorage.
 * Fetches GET /api/user which returns `{ user: { ...fields, packages?, bookings? } }`.
 * If the user endpoint doesn't include packages/bookings, we fetch them
 * separately from GET /api/packages and GET /api/bookings.
 */
export async function syncFromServer(): Promise<void> {
  if (typeof window === "undefined") return;

  // Fetch the full user record (may include packages & bookings)
  const data = await apiCall<SyncUserResponse>("/api/user");

  if (data?.user) {
    const { packages: userPackages, bookings: userBookings, ...userFields } = data.user;

    localStorage.setItem(KEYS.USER, JSON.stringify(userFields));
    localStorage.setItem(KEYS.IS_LOGGED_IN, "true");

    if (userPackages && Array.isArray(userPackages)) {
      localStorage.setItem(KEYS.PACKAGES, JSON.stringify(userPackages));
    } else {
      // Fetch packages separately
      const pkgs = await apiCall<Package[]>("/api/packages");
      if (pkgs && Array.isArray(pkgs)) {
        localStorage.setItem(KEYS.PACKAGES, JSON.stringify(pkgs));
      }
    }

    if (userBookings && Array.isArray(userBookings)) {
      localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(userBookings.map(transformBooking)));
    } else {
      const bks = await apiCall<any[]>("/api/bookings");
      if (bks && Array.isArray(bks)) {
        localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bks.map(transformBooking)));
      }
    }
  } else {
    const [pkgs, bks] = await Promise.all([
      apiCall<Package[]>("/api/packages"),
      apiCall<any[]>("/api/bookings"),
    ]);

    if (pkgs && Array.isArray(pkgs)) {
      localStorage.setItem(KEYS.PACKAGES, JSON.stringify(pkgs));
    }
    if (bks && Array.isArray(bks)) {
      localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bks.map(transformBooking)));
    }
  }
}

// ---------------------------------------------------------------------------
// localStorage → Server synchronisation (migration helper)
// ---------------------------------------------------------------------------

/**
 * Push the current localStorage state up to the API.
 * Useful for migrating from a localStorage-only setup to a real DB.
 * Sends PUT /api/user, then creates/updates every package and booking.
 */
export async function syncToServer(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // --- User ---
  const user = getUser();
  if (user) {
    const res = await apiCall<User>("/api/user", {
      method: "PUT",
      body: JSON.stringify(user),
    });
    if (!res) errors.push("Failed to sync user to server");
  }

  // --- Packages ---
  const packages = getPackages();
  for (const pkg of packages) {
    // Try PUT first (update); if it fails the server may not know about it yet
    const updated = await apiCall<Package>(`/api/packages/${pkg.id}`, {
      method: "PUT",
      body: JSON.stringify(pkg),
    });
    if (!updated) {
      // Attempt to create it instead
      const created = await apiCall<Package>("/api/packages", {
        method: "POST",
        body: JSON.stringify(pkg),
      });
      if (!created) errors.push(`Failed to sync package "${pkg.name}" (${pkg.id})`);
    }
  }

  // --- Bookings ---
  const bookings = getBookings();
  for (const booking of bookings) {
    const updated = await apiCall<Booking>(`/api/bookings/${booking.id}`, {
      method: "PUT",
      body: JSON.stringify(booking),
    });
    if (!updated) {
      const created = await apiCall<Booking>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(booking),
      });
      if (!created) errors.push(`Failed to sync booking "${booking.customerName}" (${booking.id})`);
    }
  }

  return { success: errors.length === 0, errors };
}
