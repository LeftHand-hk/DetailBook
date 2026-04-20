const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (typeof password !== "string") return { valid: false, error: "Password is required" };
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters" };
  if (password.length > 128) return { valid: false, error: "Password is too long" };
  return { valid: true };
}

export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
