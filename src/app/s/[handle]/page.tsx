import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogUrl } from "@/lib/site";
import { featuredPromotion, listPosts, listPromotions, loadPublicSite } from "@/lib/user-site";
import { FeaturedPromo, PostGridCard, SiteShell, siteName } from "@/components/user-site";

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const site = await loadPublicSite((await params).handle);
  return site ? { title: siteName(site) } : {};
}

export default async function UserHome({ params }: Params) {
  const site = await loadPublicSite((await params).handle);
  if (!site) notFound();
  const [promos, { posts }] = await Promise.all([listPromotions(site.id), listPosts(site.id, 0, 6)]);
  const featured = featuredPromotion(promos);

  return (
    <SiteShell site={site}>
      {featured ? (
        <FeaturedPromo handle={site.handle} p={featured} />
      ) : (
        <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          <h1 className="text-3xl font-bold">{siteName(site)}</h1>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">블로그</h2>
          <Link href={blogUrl(site.handle)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
            더보기 →
          </Link>
        </div>
        {posts.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-10 text-center text-slate-500">아직 올라온 글이 없어요.</p>
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostGridCard key={p.slug} handle={site.handle} p={p} />)}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
