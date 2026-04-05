/**
 * API client for DetailBook.
 * Replaces localStorage calls with real API requests.
 * Falls back to localStorage if API is unavailable (offline/demo mode).
 */

const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Auth ──

export async function apiLogin(email: string, password: string) {
  return request<{ user: any }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(data: {
  email: string; password: string; businessName: string; name: string; phone?: string; city?: string;
}) {
  return request<{ user: any }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiLogout() {
  return request("/auth/logout", { method: "POST" });
}

export async function apiGetMe() {
  return request<any>("/auth/me");
}

// ── User ──

export async function apiGetUser() {
  return request<any>("/user");
}

export async function apiUpdateUser(data: any) {
  return request<any>("/user", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ── Packages ──

export async function apiGetPackages(userId?: string) {
  const q = userId ? `?userId=${userId}` : "";
  return request<any[]>(`/packages${q}`);
}

export async function apiCreatePackage(data: any) {
  return request<any>("/packages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdatePackage(id: string, data: any) {
  return request<any>(`/packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiDeletePackage(id: string) {
  return request<any>(`/packages/${id}`, { method: "DELETE" });
}

// ── Bookings ──

export async function apiGetBookings() {
  return request<any[]>("/bookings");
}

export async function apiCreateBooking(data: any) {
  return request<any>("/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateBooking(id: string, data: any) {
  return request<any>(`/bookings/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteBooking(id: string) {
  return request<any>(`/bookings/${id}`, { method: "DELETE" });
}

// ── Public booking page ──

export async function apiGetBookingPage(slug: string) {
  return request<{ user: any; packages: any[] }>(`/book/${slug}`);
}

// ── Admin ──

export async function apiAdminLogin(email: string, password: string) {
  return request<{ admin: any }>("/admin/auth", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiAdminGetUsers() {
  return request<any[]>("/admin/users");
}

export async function apiAdminUpdateUser(userId: string, data: any) {
  return request<any>("/admin/users", {
    method: "PUT",
    body: JSON.stringify({ userId, ...data }),
  });
}

export async function apiAdminGetSettings() {
  return request<any>("/admin/settings");
}

export async function apiAdminUpdateSettings(data: any) {
  return request<any>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
