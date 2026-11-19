import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mail links (sign-up confirmation, password reset) land here with a one-time code.
// `next` picks the page to open afterwards; only paths on this site are allowed.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const target = /^\/(?!\/)[\w\-/]*$/.test(next) ? next : "/dashboard";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // An expired or reused reset link: the reset page explains and offers a new mail.
    if (error && target === "/reset-password") return NextResponse.redirect(new URL("/reset-password", request.url));
  }
  return NextResponse.redirect(new URL(target, request.url));
}
