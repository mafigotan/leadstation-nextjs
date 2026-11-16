import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { userUrl } from "@/lib/site";
import { listPromotions, loadPublicSite, pageParam } from "@/lib/user-site";
import { Pager, PromoGridCard, SiteShell, siteName } from "@/components/user-site";

const PER_PAGE = 12;

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await loadPublicSite((await params).handle);
  return site ? { title: `${siteName(site)} 프로모션`, alternates: { canonical: userUrl(site.handle, "promotions") } } : {};
}

export default async function PromotionList({ params, searchParams }: Props) {
  const site = await loadPublicSite((await params).handle);
  if (!site) notFound();
  const page = pageParam((await searchParams).page);
  const all = await listPromotions(site.id);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const items = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <SiteShell site={site} active="promotions">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
        <h1 className="text-3xl font-bold">프로모션</h1>
        <p className="mt-2 text-slate-500">진행 중인 프로모션이 먼저, 종료된 프로모션은 그 뒤에 보여요.</p>
        {items.length === 0 ? (
          <p className="mt-10 rounded-xl bg-slate-50 p-10 text-center text-slate-500">아직 공개된 프로모션이 없어요.</p>
        ) : (
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => <PromoGridCard key={p.slug} handle={site.handle} p={p} />)}
          </div>
        )}
        <Pager base={userUrl(site.handle, "promotions")} page={page} pages={pages} />
      </div>
    </SiteShell>
  );
}
