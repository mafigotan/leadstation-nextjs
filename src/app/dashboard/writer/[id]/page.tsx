import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/server";
import { blogUrl, mainDomainUrl } from "@/lib/site";
import type { Article } from "@/lib/writer/types";
import { ArticleEditor } from "./editor";

export const maxDuration = 120;

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile();
  const { data: article } = await supabase.from("articles").select("*").eq("id", id).single<Article>();
  if (!article) notFound();
  return (
    <ArticleEditor
      article={article}
      userId={user.id}
      publicBase={blogUrl(profile.handle, "SLUG")}
      previewBase={mainDomainUrl(profile.handle, "blog/SLUG")}
    />
  );
}
