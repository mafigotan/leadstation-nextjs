import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { loadWriterSettings } from "@/lib/writer/settings";
import { WriterSettingsForm } from "./form";

export const metadata = { title: "글쓰기 설정 | LEADstation" };

export default async function WriterSettingsPage() {
  const { supabase, user } = await requireUser();
  const settings = await loadWriterSettings(supabase, user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/writer" className="text-sm text-slate-500 hover:underline">← AI 글쓰기</Link>
      <h1 className="mt-1 text-2xl font-bold">글쓰기 설정</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">모든 AI 글 생성에 함께 쓰이는 기본값이에요.</p>
      <WriterSettingsForm settings={settings} />
    </div>
  );
}
