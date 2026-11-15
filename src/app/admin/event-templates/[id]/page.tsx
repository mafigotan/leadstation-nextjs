import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { fmtDateTime } from "../../ui";
import { TemplateStatus, isRevising } from "../status";
import { JobWatcher, DeleteButton, EditForm, GamePreview, PublicToggle, ReviseForm } from "../forms";

export const metadata = { title: "이벤트 템플릿 | 슈퍼 관리자" };

export default async function EventTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSuperAdmin();
  const { data: t } = await supabase.from("event_templates").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const generating = t.status === "generating" && !!t.job_batch_id;
  const stopped = t.status === "generating" && !t.job_batch_id;
  const revising = isRevising(t);
  const ready = t.status === "ready";

  return (
    <div className="space-y-6">
      {t.job_batch_id && <JobWatcher id={t.id} />}
      <Link href="/admin/event-templates" className="text-sm text-slate-500 hover:underline">← 목록으로</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <TemplateStatus t={t} />
          <span className="text-xs text-slate-400">수정 {fmtDateTime(t.updated_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <DeleteButton id={t.id} />
          <PublicToggle id={t.id} isPublic={t.is_public} disabled={!ready} />
        </div>
      </div>

      {stopped && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">이전 방식으로 시작된 작업이 서버 시간 제한(5분)에 걸려 중단됐어요. 오른쪽에서 다시 만들어 주세요.</p>}
      {t.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{t.error}</p>}

      {generating ? (
        <div className="card flex flex-col items-center gap-3 p-16 text-center text-slate-600">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="font-medium">AI가 템플릿 게임을 만들고 있어요.</p>
          <p className="text-sm text-slate-500">최고 품질로 만들어서 보통 5~15분 걸려요. 이 화면을 닫아도 작업은 계속되고, 다시 열면 결과를 가져와요.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {ready && <GamePreview game={{ css: t.css, html: t.html, js: t.js, config: t.config }} />}
            {revising && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">AI가 수정 요청을 반영하고 있어요. 끝나면 미리보기가 바뀌어요.</p>}
            <details className="card p-4 text-sm">
              <summary className="cursor-pointer font-medium">AI에게 준 설명</summary>
              <p className="mt-2 whitespace-pre-line text-slate-600">{t.prompt}</p>
            </details>
            {t.config_guide && (
              <details className="card p-4 text-sm" open>
                <summary className="cursor-pointer font-medium">설정 항목 설명</summary>
                <p className="mt-2 whitespace-pre-line text-slate-600">{t.config_guide}</p>
              </details>
            )}
          </div>
          <div className="space-y-4">
            {!revising && <ReviseForm id={t.id} failed={!ready} />}
            {ready && <EditForm t={t} />}
          </div>
        </div>
      )}
    </div>
  );
}
