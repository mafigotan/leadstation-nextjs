import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PromoPage } from "@/components/promo-page";
import type { PageRow } from "@/lib/types";
import { LeadForm } from "./lead-form";

async function getPage(slug: string) {
  const supabase = await createClient();
  // RLS returns published pages to everyone, and drafts only to their owner (preview).
  const { data } = await supabase.from("pages").select("*").eq("slug", slug).maybeSingle<PageRow>();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPage((await params).slug);
  if (!page) return {};
  return { title: page.content.headline, description: page.content.subheadline };
}

export default async function PublicPromoPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getPage((await params).slug);
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
        form={<LeadForm pageId={page.id} ctaLabel={page.content.cta_label} theme={page.content.theme} />}
      />
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Powered by LEADstation
      </footer>
    </>
  );
}
