// A non-secret "signed in" marker that user sites (handle.leadstation.kr) can read.
// The Supabase session cookie stays on the main domain; this only tells the site footer
// whether to show the admin login or the logout button. It never grants access.
import type { NextResponse } from "next/server";

export const AUTH_HINT_COOKIE = "ls_signed_in";

function hintDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  return root ? `.${root}` : undefined;
}

/** Sets or clears the marker on a response to match whether someone is signed in. */
export function syncAuthHint(response: NextResponse, signedIn: boolean, hasHint: boolean) {
  if (signedIn === hasHint) return;
  const base = { path: "/", domain: hintDomain(), sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  if (signedIn) response.cookies.set(AUTH_HINT_COOKIE, "1", { ...base, maxAge: 60 * 60 * 24 * 30 });
  else response.cookies.set(AUTH_HINT_COOKIE, "", { ...base, maxAge: 0 });
}

/** True when `url` points at the main site or one of its user subdomains (safe to redirect to). */
export function isOwnUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const main = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  if (u.origin === main.origin) return true;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  return !!root && u.protocol === "https:" && (u.hostname === root || u.hostname.endsWith(`.${root}`));
}
