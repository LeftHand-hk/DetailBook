const ADMIN_KEY = "detailbook_admin";
const PLATFORM_KEY = "detailbook_platform";

export function isAdminLoggedIn(): boolean {
  try {
    const data = JSON.parse(localStorage.getItem(ADMIN_KEY) || "{}");
    return data.loggedIn === true;
  } catch { return false; }
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_KEY);
  // Also clear the httpOnly cookie via API
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

// Platform settings (payment config, domain config, etc.)
export interface PlatformSettings {
  stripe?: { enabled: boolean; publishableKey: string; secretKey: string; webhookSecret: string };
  crypto?: { enabled: boolean; walletAddress: string; network: string; acceptedCoins: string[] };

  starterPrice: number;
  proPrice: number;
  trialDays: number;

  defaultDomain: string;
  customDomainsEnabled: boolean;

  platformName: string;
  supportEmail: string;

  maintenanceMode: boolean;
  maintenanceMessage: string;

  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

const DEFAULT_PLATFORM: PlatformSettings = {
  starterPrice: 29,
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

export function getPlatformName(): string {
  return getPlatformSettings().platformName;
}

export function getDefaultDomain(): string {
  return getPlatformSettings().defaultDomain;
}

// Legacy stubs — real data should be fetched from /api/admin/* endpoints
export function getAllUsers(): any[] { return []; }
export function getAllBookings(): any[] { return []; }
export function getAllPackages(): any[] { return []; }
