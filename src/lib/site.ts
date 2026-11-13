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
