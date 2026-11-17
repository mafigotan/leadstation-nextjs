import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HANDLE_RE } from "@/lib/site";

// "관리자 로그인" on a user site footer: open the dashboard for that site, signing in first if needed.
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("site") ?? "").toLowerCase();
  const handle = HANDLE_RE.test(raw) ? raw : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    if (handle) login.searchParams.set("site", handle);
    return NextResponse.redirect(login);
  }
  if (handle) {
    // Make this site the one the dashboard shows, when the person belongs to it.
    const { data: site } = await supabase.from("sites").select("id").eq("handle", handle).maybeSingle<{ id: string }>();
    if (site) {
      const { data: member } = await supabase.from("site_members").select("site_id").eq("site_id", site.id).eq("user_id", user.id).maybeSingle();
      if (member) await supabase.from("profiles").update({ active_site_id: site.id }).eq("user_id", user.id);
    }
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
