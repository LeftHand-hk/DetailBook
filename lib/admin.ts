const ADMIN_EMAIL = "admin@detailbook.com";
const ADMIN_PASSWORD = "admin123!"; // For demo purposes
const ADMIN_KEY = "detailbook_admin";
const PLATFORM_KEY = "detailbook_platform";

export function adminLogin(email: string, password: string): boolean {
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify({ email, loggedIn: true, loginAt: new Date().toISOString() }));
    return true;
  }
  return false;
}

export function isAdminLoggedIn(): boolean {
  try {
    const data = JSON.parse(localStorage.getItem(ADMIN_KEY) || "{}");
    return data.loggedIn === true;
  } catch { return false; }
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_KEY);
}

// Platform settings (payment config, domain config, etc.)
export interface PlatformSettings {
  // Payment providers for subscriptions
  stripe?: { enabled: boolean; publishableKey: string; secretKey: string; webhookSecret: string };
  crypto?: { enabled: boolean; walletAddress: string; network: string; acceptedCoins: string[] };

  // Pricing
  starterPrice: number;
  proPrice: number;
  trialDays: number;

  // Domain settings
  defaultDomain: string;
  customDomainsEnabled: boolean;

  // Platform info
  platformName: string;
  supportEmail: string;

  // Maintenance
  maintenanceMode: boolean;
  maintenanceMessage: string;

  // Database
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

const DEFAULT_PLATFORM: PlatformSettings = {
  starterPrice: 25,
  proPrice: 49,
  trialDays: 30,
  defaultDomain: "detailbook.app",
  customDomainsEnabled: true,
  platformName: "DetailBook",
  supportEmail: "support@detailbook.com",
  maintenanceMode: false,
  maintenanceMessage: "We are currently performing maintenance. Please check back soon.",
  dbHost: "localhost",
  dbPort: 3306,
  dbName: "detailbook",
  dbUser: "root",
  dbPassword: "",
};

export function getPlatformSettings(): PlatformSettings {
  try {
    const data = JSON.parse(localStorage.getItem(PLATFORM_KEY) || "{}");
    return { ...DEFAULT_PLATFORM, ...data };
  } catch { return DEFAULT_PLATFORM; }
}

export function setPlatformSettings(settings: PlatformSettings) {
  localStorage.setItem(PLATFORM_KEY, JSON.stringify(settings));
}

// Get platform name (used across the site)
export function getPlatformName(): string {
  return getPlatformSettings().platformName;
}

// Get default domain
export function getDefaultDomain(): string {
  return getPlatformSettings().defaultDomain;
}

// Get all users (reads from the detailbook_user key - in real app this would be a DB query)
export function getAllUsers(): any[] {
  try {
    const user = JSON.parse(localStorage.getItem("detailbook_user") || "null");
    return user ? [user] : [];
  } catch { return []; }
}

// Get all bookings
export function getAllBookings(): any[] {
  try {
    return JSON.parse(localStorage.getItem("detailbook_bookings") || "[]");
  } catch { return []; }
}

// Get all packages
export function getAllPackages(): any[] {
  try {
    return JSON.parse(localStorage.getItem("detailbook_packages") || "[]");
  } catch { return []; }
}
