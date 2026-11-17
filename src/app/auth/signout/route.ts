import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwnUrl, syncAuthHint } from "@/lib/auth-hint";
import { siteUrl } from "@/lib/site";

// Logout button on the user site footer: sign out, then go back to the page it was pressed on.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const next = String(form?.get("next") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(isOwnUrl(next) ? next : `${siteUrl()}/login`, 303);
  syncAuthHint(response, false, true);
  return response;
}
