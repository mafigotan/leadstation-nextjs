import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { blogUrl, userUrl } from "@/lib/site";
import { ArticleBody } from "@/components/article-view";
import { plain, type Article } from "@/lib/writer/types";

async function load(handle: string, slug: string) {
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("id, handle, name").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!site) return null;
  // RLS: published posts for everyone, drafts only for the site members (preview on the main domain).
  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("site_id", site.id)
    .eq("slug", slug.toLowerCase())
    .maybeSingle<Article>();
  return article ? { site, article } : null;
}

type Params = { params: Promise<{ handle: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, slug } = await params;
  const data = await load(handle, slug);
  if (!data) return {};
  const { article: a, site } = data;
  const url = blogUrl(site.handle, a.slug);
  const images = a.header_image?.url ? [{ url: a.header_image.url, alt: a.header_image.alt }] : undefined;
  return {
    title: a.seo_title || a.title,
    description: a.meta_description,
    keywords: a.tags,
    alternates: { canonical: url },
    robots: a.status === "published" ? undefined : { index: false },
    openGraph: { type: "article", title: a.seo_title || a.title, description: a.meta_description, url, images, publishedTime: a.published_at ?? undefined },
    twitter: { card: images ? "summary_large_image" : "summary", title: a.seo_title || a.title, description: a.meta_description },
  };
}

export default async function BlogPost({ params }: Params) {
  const { handle, slug } = await params;
  const data = await load(handle, slug);
  if (!data) notFound();
  const { article: a, site } = data;
  const name = site.name || site.handle;
  const lang = a.brief?.language === "en" ? "en" : "ko";

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.title,
      description: a.meta_description,
      image: a.header_image?.url || undefined,
      datePublished: a.published_at ?? a.created_at,
      dateModified: a.updated_at,
      author: { "@type": "Organization", name },
      mainEntityOfPage: blogUrl(site.handle, a.slug),
      keywords: a.tags.join(", "),
    },
  ];
  if (a.faq.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faq.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: plain(q.answer) } })),
    });
  }

  return (
    <main className="min-h-screen bg-white" lang={lang}>
      {a.status !== "published" && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">초안 미리보기예요. 발행하기 전에는 다른 사람이 볼 수 없어요.</div>
      )}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={userUrl(site.handle)} className="font-bold">{name}</Link>
          <Link href={blogUrl(site.handle)} className="text-sm text-slate-500 hover:underline">블로그 목록</Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ArticleBody
          title={a.title}
          header={a.header_image ?? {}}
          blocks={a.blocks}
          faq={a.faq}
          lang={lang}
          meta={
            <p className="mt-3 text-sm text-slate-500">
              {name} · {new Date(a.published_at ?? a.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
            </p>
          }
        />
        {a.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {a.tags.map((t) => <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">#{t}</span>)}
          </div>
        )}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <footer className="pb-8 text-center text-xs text-slate-400">Powered by LEADstation</footer>
    </main>
  );
}
