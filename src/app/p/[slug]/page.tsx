import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";

// Old address (/p/slug): forwards to the owner's subdomain address.
export default async function LegacyPromoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase.from("pages").select("site_id, slug").eq("slug", slug).limit(1).maybeSingle();
  if (!page) notFound();
  const { data: site } = await supabase.from("sites").select("handle").eq("id", page.site_id).maybeSingle();
  if (!site) notFound();
  redirect(userUrl(site.handle, page.slug));
}
