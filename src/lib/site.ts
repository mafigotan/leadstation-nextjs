// Address helpers for user subdomains (handle.leadstation.kr).

export const RESERVED_HANDLES = new Set([
  "www", "app", "api", "admin", "mail", "smtp", "ftp", "dashboard", "login", "help",
  "support", "blog", "docs", "status", "static", "assets", "cdn", "dev", "test", "leadstation",
]);

export const HANDLE_RE = /^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/;
export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;

export function rootDomain(): string | null {
  const d = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  return d || null;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Public address of a user's home or page. Uses the subdomain when NEXT_PUBLIC_ROOT_DOMAIN is set. */
export function userUrl(handle: string, slug?: string): string {
  const root = rootDomain();
  const path = slug ? `/${slug}` : "";
  if (root) return `https://${handle}.${root}${path || "/"}`;
  return `${siteUrl()}/s/${handle}${path}`;
}

/** Public address of a user's blog or blog post (handle.leadstation.kr/blog/slug). */
export function blogUrl(handle: string, slug?: string): string {
  return userUrl(handle, slug ? `blog/${slug}` : "blog");
}

/** Same page on the main domain (works before DNS is ready and keeps the owner's login for draft previews). */
export function mainDomainUrl(handle: string, slug?: string): string {
  return `${siteUrl()}/s/${handle}${slug ? `/${slug}` : ""}`;
}

export function validateHandle(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  if (!HANDLE_RE.test(h)) return "영문 소문자, 숫자, 하이픈(-)으로 3~30자, 하이픈으로 시작하거나 끝날 수 없어요.";
  if (RESERVED_HANDLES.has(h)) return "사용할 수 없는 주소예요.";
  return null;
}

/** Today's date in Korea as YYYY-MM-DD. */
export function todayKst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export type SiteStatusFields = { status?: string | null; active_from?: string | null; active_until?: string | null };

/** Why a site is not usable now, or null when it is live (active and inside its period). */
export function siteBlockReason(s: SiteStatusFields): "inactive" | "not_started" | "expired" | null {
  const today = todayKst();
  if (s.status && s.status !== "active") return "inactive";
  if (s.active_from && s.active_from > today) return "not_started";
  if (s.active_until && s.active_until < today) return "expired";
  return null;
}

export function isSiteLive(s: SiteStatusFields) {
  return siteBlockReason(s) === null;
}

/** Days left until the site's period ends (0 on the last day), or null when there is no end date. */
export function daysLeft(activeUntil?: string | null): number | null {
  if (!activeUntil) return null;
  const ms = Date.parse(activeUntil + "T00:00:00Z") - Date.parse(todayKst() + "T00:00:00Z");
  return Math.round(ms / 86400000);
}

/** True when the period ends within two months from today (Korean date). */
export function endsWithinTwoMonths(activeUntil?: string | null): boolean {
  if (!activeUntil) return false;
  const t = new Date(todayKst() + "T00:00:00Z");
  t.setUTCMonth(t.getUTCMonth() + 2);
  return activeUntil <= t.toISOString().slice(0, 10);
}
