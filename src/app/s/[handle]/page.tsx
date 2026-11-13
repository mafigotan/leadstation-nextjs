import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";
import type { PageContent } from "@/lib/types";

async function load(handle: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (!profile) return null;
  const { data: pages } = await supabase
    .from("pages")
    .select("slug, title, content, created_at")
    .eq("user_id", profile.user_id)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  return { profile, pages: (pages ?? []) as { slug: string; title: string; content: PageContent; created_at: string }[] };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const data = await load((await params).handle);
  return data ? { title: data.profile.display_name || data.profile.handle } : {};
}

export default async function UserHome({ params }: { params: Promise<{ handle: string }> }) {
  const data = await load((await params).handle);
  if (!data) notFound();
  const { profile, pages } = data;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">{profile.display_name || profile.handle}</h1>
        <p className="mt-2 text-slate-500">진행 중인 이벤트와 프로모션</p>
        {pages.length === 0 ? (
          <p className="card mt-10 p-10 text-center text-slate-500">지금 진행 중인 프로모션이 없어요.</p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {pages.map((p) => (
              <Link key={p.slug} href={userUrl(profile.handle, p.slug)} className="card block p-6 transition hover:shadow-md">
                {p.content.badge && <p className="text-xs font-semibold text-indigo-600">{p.content.badge}</p>}
                <h2 className="mt-1 text-lg font-bold">{p.content.headline}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.content.subheadline}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <footer className="pb-8 text-center text-xs text-slate-400">Powered by LEADstation</footer>
    </main>
  );
}
