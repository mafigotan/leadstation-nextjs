import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { blogUrl, userUrl, isSiteLive } from "@/lib/site";
import type { HeaderImage } from "@/lib/writer/types";

async function load(handle: string) {
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("id, handle, name, status, active_from, active_until").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!site || !isSiteLive(site)) return null;
  const { data } = await supabase
    .from("articles")
    .select("slug, title, meta_description, header_image, published_at, tags")
    .eq("site_id", site.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);
  return { site, posts: (data ?? []) as { slug: string; title: string; meta_description: string; header_image: Partial<HeaderImage>; published_at: string; tags: string[] }[] };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const data = await load((await params).handle);
  if (!data) return {};
  const name = data.site.name || data.site.handle;
  return { title: `${name} 블로그`, alternates: { canonical: blogUrl(data.site.handle) } };
}

export default async function BlogIndex({ params }: { params: Promise<{ handle: string }> }) {
  const data = await load((await params).handle);
  if (!data) notFound();
  const { site, posts } = data;
  const name = site.name || site.handle;

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href={userUrl(site.handle)} className="font-bold">{name}</Link>
          <span className="text-sm text-slate-500">블로그</span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold">{name} 블로그</h1>
        {posts.length === 0 ? (
          <p className="mt-10 text-slate-500">아직 올라온 글이 없어요.</p>
        ) : (
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {posts.map((p) => (
              <Link key={p.slug} href={blogUrl(site.handle, p.slug)} className="group block">
                {p.header_image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.header_image.url} alt={p.header_image.alt ?? ""} className="aspect-[3/2] w-full rounded-xl object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-[3/2] w-full rounded-xl bg-gradient-to-br from-indigo-100 to-slate-100" />
                )}
                <h2 className="mt-3 text-lg font-bold leading-snug group-hover:underline">{p.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.meta_description}</p>
                <p className="mt-2 text-xs text-slate-400">{new Date(p.published_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <footer className="pb-8 text-center text-xs text-slate-400">Powered by LEADstation</footer>
    </main>
  );
}
