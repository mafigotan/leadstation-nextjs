import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { blogUrl } from "@/lib/site";

export const metadata = { title: "AI 글쓰기 | LEADstation" };

export default async function WriterPage() {
  const { supabase, profile } = await requireProfile();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, keyword, slug, status, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI 글쓰기</h1>
          <p className="mt-1 text-sm text-slate-500">
            키워드만 넣으면 AI가 SEO에 맞춘 블로그 글을 써요. 발행한 글은{" "}
            <a href={blogUrl(profile.handle)} target="_blank" className="text-indigo-600 hover:underline">
              {blogUrl(profile.handle).replace(/^https?:\/\//, "")}
            </a>
            에 올라가요.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/writer/settings" className="btn-secondary">글쓰기 설정</Link>
          <Link href="/dashboard/writer/new" className="btn-primary">+ 새 글 쓰기</Link>
        </div>
      </div>

      {!articles?.length ? (
        <div className="card p-12 text-center">
          <p className="text-slate-600">아직 쓴 글이 없어요.</p>
          <Link href="/dashboard/writer/new" className="btn-primary mt-4">첫 글 쓰기</Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {articles.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <Link href={`/dashboard/writer/${a.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate font-medium">{a.title || "제목 없는 글"}</p>
                <p className="truncate text-xs text-slate-500">
                  {a.keyword} · {new Date(a.updated_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" })}
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {a.status === "published" ? "발행됨" : "초안"}
                </span>
                {a.status === "published" && (
                  <a href={blogUrl(profile.handle, a.slug)} target="_blank" className="text-sm font-medium text-indigo-600 hover:underline">보기</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
