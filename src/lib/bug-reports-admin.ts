/**
 * Comma-separated allowlist in BUG_REPORTS_ADMIN_EMAILS (lowercase match).
 * If unset or empty, no one can access internal bug report UI (safest default).
 */
export function isBugReportsAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email || typeof email !== "string") return false;
  const raw = process.env.BUG_REPORTS_ADMIN_EMAILS?.trim();
  if (!raw) return false;
  const allow = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return allow.has(email.toLowerCase());
}
