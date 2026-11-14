import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSiteLive } from "@/lib/site";
import { PromoPage } from "@/components/promo-page";
import type { PageRow } from "@/lib/types";
import { LeadForm } from "@/app/p/[slug]/lead-form";

async function getPage(handle: string, slug: string) {
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("id, handle, name, status, active_from, active_until").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!site || !isSiteLive(site)) return null;
  // RLS returns published pages to everyone, and drafts only to the site members (preview).
  const { data } = await supabase
    .from("pages")
    .select("*")
    .eq("site_id", site.id)
    .eq("slug", slug.toLowerCase())
    .maybeSingle<PageRow>();
  return data;
}

type Params = { params: Promise<{ handle: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, slug } = await params;
  const page = await getPage(handle, slug);
  if (!page) return {};
  return { title: page.content.headline, description: page.content.subheadline };
}

export default async function UserPromoPage({ params }: Params) {
  const { handle, slug } = await params;
  const page = await getPage(handle, slug);
  if (!page) notFound();

  return (
    <>
      {page.status !== "published" && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          초안 미리보기예요. 공개하기 전에는 신청을 받을 수 없어요.
        </div>
      )}
      <PromoPage
        content={page.content}
        form={(s) => <LeadForm pageId={page.id} ctaLabel={s?.label || page.content.cta_label} theme={page.content.theme} />}
      />
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">Powered by LEADstation</footer>
    </>
  );
}
