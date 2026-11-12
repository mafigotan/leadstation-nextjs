import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getSettings } from "@/lib/newsletter/queue";
import { siteUrl } from "@/lib/slug";
import type { Newsletter } from "@/lib/newsletter/types";
import { NewsletterEditor } from "./editor";

export const maxDuration = 180;

export default async function EditNewsletterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: nl } = await supabase.from("newsletters").select("*").eq("id", id).single<Newsletter>();
  if (!nl) notFound();
  const settings = await getSettings(supabase, user.id);
  return <NewsletterEditor newsletter={nl} settings={settings} userId={user.id} siteUrl={siteUrl()} />;
}
