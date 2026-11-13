import Link from "next/link";
import { requireSite } from "@/lib/supabase/server";
import { createNewsletter } from "./actions";

export const metadata = { title: "AI 뉴스레터 | LEADstation" };

const STATUS: Record<string, [string, string]> = {
  draft: ["초안", "bg-slate-100 text-slate-600"],
  scheduled: ["예약됨", "bg-amber-50 text-amber-700"],
  sending: ["발송 중", "bg-indigo-50 text-indigo-700"],
  sent: ["발송 완료", "bg-emerald-50 text-emerald-700"],
  failed: ["발송 실패", "bg-red-50 text-red-700"],
};

export default async function NewslettersPage() {
  const { supabase } = await requireSite();
  const [{ data: newsletters }, { count: subscribers }] = await Promise.all([
    supabase.from("newsletters").select("id, title, subject, status, updated_at, sent_at").order("updated_at", { ascending: false }),
    supabase.from("recipients").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI 뉴스레터</h1>
          <p className="mt-1 text-sm text-slate-500">AI로 뉴스레터를 만들고 수신자에게 바로 또는 예약해서 보내요. 구독 중인 수신자 {subscribers ?? 0}명</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/newsletters/settings" className="btn-secondary">발신 정보</Link>
          <form action={createNewsletter}>
            <button className="btn-primary">+ 새 뉴스레터</button>
          </form>
        </div>
      </div>

      {!newsletters?.length ? (
        <div className="card p-12 text-center">
          <p className="text-slate-600">아직 만든 뉴스레터가 없어요.</p>
          <p className="mt-1 text-sm text-slate-500">시작 전에 발신 정보와 수신자를 먼저 등록해 두면 편해요.</p>
          <form action={createNewsletter} className="mt-4">
            <button className="btn-primary">첫 뉴스레터 만들기</button>
          </form>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {newsletters.map((n) => {
            const [label, cls] = STATUS[n.status] ?? STATUS.draft;
            return (
              <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <Link href={`/dashboard/newsletters/${n.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate font-medium">{n.title || "제목 없는 뉴스레터"}</p>
                  <p className="truncate text-xs text-slate-500">
                    {n.subject || "제목 미입력"} · {new Date(n.sent_at ?? n.updated_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" })}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
                  <Link href={`/dashboard/newsletters/${n.id}/send`} className="text-sm font-medium text-indigo-600 hover:underline">
                    {n.status === "draft" ? "발송" : "발송 현황"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
