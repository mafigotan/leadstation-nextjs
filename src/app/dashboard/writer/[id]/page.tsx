import { notFound } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { blogUrl, mainDomainUrl } from "@/lib/site";
import type { Article } from "@/lib/writer/types";
import { ArticleEditor } from "./editor";

export const maxDuration = 120;

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, site } = await requireSite();
  const { data: article } = await supabase.from("articles").select("*").eq("id", id).eq("site_id", site.id).single<Article>();
  if (!article) notFound();
  return (
    <ArticleEditor
      article={article}
      userId={user.id}
      publicBase={blogUrl(site.handle, "SLUG")}
      previewBase={mainDomainUrl(site.handle, "blog/SLUG")}
    />
  );
}
