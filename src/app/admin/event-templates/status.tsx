/** Generation older than this is treated as stopped (the server limit is 5 minutes). */
export const STALE_MS = 6 * 60 * 1000;

export type TemplateRowStatus = { status: string; is_public: boolean; updated_at: string; revising_since: string | null };

export function isStale(t: TemplateRowStatus) {
  return t.status === "generating" && Date.now() - new Date(t.updated_at).getTime() > STALE_MS;
}
export function isRevising(t: TemplateRowStatus) {
  return !!t.revising_since && Date.now() - new Date(t.revising_since).getTime() <= STALE_MS;
}

export function TemplateStatus({ t }: { t: TemplateRowStatus }) {
  const [label, cls] =
    t.status === "generating"
      ? isStale(t)
        ? ["시간 초과", "bg-red-50 text-red-700"]
        : ["AI 생성 중", "bg-amber-50 text-amber-700"]
      : t.status === "failed"
        ? ["생성 실패", "bg-red-50 text-red-700"]
        : isRevising(t)
          ? ["AI 수정 중", "bg-amber-50 text-amber-700"]
          : t.is_public
            ? ["공개", "bg-emerald-50 text-emerald-700"]
            : ["비공개", "bg-slate-100 text-slate-600"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
