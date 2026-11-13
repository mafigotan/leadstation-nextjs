import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";

// Old address (/p/slug): forwards to the owner's subdomain address.
export default async function LegacyPromoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase.from("pages").select("user_id, slug").eq("slug", slug).limit(1).maybeSingle();
  if (!page) notFound();
  const { data: profile } = await supabase.from("profiles").select("handle").eq("user_id", page.user_id).maybeSingle();
  if (!profile) notFound();
  redirect(userUrl(profile.handle, page.slug));
}
