export type TemplateRowStatus = { status: string; is_public: boolean; revising_since: string | null; job_batch_id: string | null };

export const isRevising = (t: TemplateRowStatus) => !!t.revising_since && !!t.job_batch_id;

export function TemplateStatus({ t }: { t: TemplateRowStatus }) {
  const [label, cls] =
    t.status === "generating"
      ? t.job_batch_id
        ? ["AI 생성 중", "bg-amber-50 text-amber-700"]
        : ["중단됨", "bg-red-50 text-red-700"]
      : t.status === "failed"
        ? ["생성 실패", "bg-red-50 text-red-700"]
        : isRevising(t)
          ? ["AI 수정 중", "bg-amber-50 text-amber-700"]
          : t.is_public
            ? ["공개", "bg-emerald-50 text-emerald-700"]
            : ["비공개", "bg-slate-100 text-slate-600"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
