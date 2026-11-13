import { requireUser } from "@/lib/supabase/server";
import { loadWriterSettings } from "@/lib/writer/settings";
import { NewArticleForm } from "./form";

export const maxDuration = 300;
export const metadata = { title: "새 글 쓰기 | LEADstation" };

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ keyword?: string }> }) {
  const { supabase, user } = await requireUser();
  const settings = await loadWriterSettings(supabase, user.id);
  const { keyword } = await searchParams;
  return <NewArticleForm settings={settings} keyword={keyword ?? ""} />;
}
