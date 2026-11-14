import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const HANDLE_RE = /^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/;

function subdomainHandle(host: string | null): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  if (!root || !host) return null;
  const h = host.toLowerCase().split(":")[0];
  if (!h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (!sub || sub === "www" || sub.includes(".") || !HANDLE_RE.test(sub)) return null;
  return sub;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const handle = subdomainHandle(request.headers.get("host"));

  if (handle) {
    // handle.leadstation.kr/        -> /s/handle
    // handle.leadstation.kr/event   -> /s/handle/event
    const parts = pathname.split("/").filter(Boolean);
    const appPaths = new Set(["dashboard", "login", "welcome", "auth", "u", "p", "s", "admin", "blocked"]);
    // handle.leadstation.kr/blog[/post] -> /s/handle/blog[/post]
    const isBlog = parts[0] === "blog" && parts.length <= 2;
    if ((isBlog || (parts.length <= 1 && !appPaths.has(parts[0] ?? ""))) && !pathname.startsWith("/_next")) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${handle}${parts.length ? `/${parts.join("/")}` : ""}`;
      return NextResponse.rewrite(url);
    }
    // Everything else (dashboard, login, ...) lives on the main domain.
    const root = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`;
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, root));
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || ["/login", "/welcome", "/blocked"].includes(pathname)) {
    return updateSession(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
