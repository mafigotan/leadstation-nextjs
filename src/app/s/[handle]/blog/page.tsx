import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogUrl } from "@/lib/site";
import { listPosts, loadPublicSite, pageParam } from "@/lib/user-site";
import { Pager, PostGridCard, SiteShell, siteName } from "@/components/user-site";

const PER_PAGE = 12;

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await loadPublicSite((await params).handle);
  if (!site) return {};
  return { title: `${siteName(site)} 블로그`, alternates: { canonical: blogUrl(site.handle) } };
}

export default async function BlogIndex({ params, searchParams }: Props) {
  const site = await loadPublicSite((await params).handle);
  if (!site) notFound();
  const page = pageParam((await searchParams).page);
  const { posts, total } = await listPosts(site.id, (page - 1) * PER_PAGE, PER_PAGE);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <SiteShell site={site} active="blog">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
        <h1 className="text-3xl font-bold">블로그</h1>
        {posts.length === 0 ? (
          <p className="mt-10 rounded-xl bg-slate-50 p-10 text-center text-slate-500">아직 올라온 글이 없어요.</p>
        ) : (
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostGridCard key={p.slug} handle={site.handle} p={p} />)}
          </div>
        )}
        <Pager base={blogUrl(site.handle)} page={page} pages={pages} />
      </div>
    </SiteShell>
  );
}
