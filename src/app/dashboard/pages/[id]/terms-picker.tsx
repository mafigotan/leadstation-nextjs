"use client";

import { TERM_KIND_LABEL, type FormTerm, type TermOption } from "@/lib/terms";
import type { Section } from "@/lib/page-sections";

/** The form's terms as saved, or the site's default terms for forms saved before terms existed. */
export function formTermsOf(s: Section, options: TermOption[]): FormTerm[] {
  if (s.terms) return s.terms;
  return options
    .filter((o) => o.is_default && (o.kind === "privacy" || o.kind === "marketing"))
    .sort((a, b) => (a.kind === "privacy" ? 0 : 1) - (b.kind === "privacy" ? 0 : 1))
    .map((o) => ({ term_id: o.id, version_id: null, required: o.kind === "privacy" }));
}

/** What the form will show: the label and version of each linked term. */
export function previewTerms(s: Section, options: TermOption[]) {
  const byId = new Map(options.map((o) => [o.id, o]));
  return formTermsOf(s, options).flatMap((t) => {
    const o = byId.get(t.term_id);
    const v = o?.versions.find((x) => x.id === (t.version_id ?? o.current_version_id));
    return o && v ? [{ key: t.term_id, label: v.label, required: t.required, version: v.version, pinned: !!t.version_id }] : [];
  });
}

export function termsProblem(s: Section, options: TermOption[]): string | null {
  const byId = new Map(options.map((o) => [o.id, o]));
  const list = formTermsOf(s, options);
  if (list.some((t) => !byId.has(t.term_id))) return "찾을 수 없는 약관이 있어요 (보관했거나 삭제한 약관). 빼거나 다른 약관으로 바꿔 주세요.";
  if (!list.some((t) => t.required && byId.get(t.term_id)?.kind === "privacy")) return "필수 ‘개인정보 수집·이용’ 약관이 하나 이상 있어야 해요.";
  return null;
}

const date = (s: string) => new Date(s).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

export function TermsPicker({ s, update, options }: { s: Section; update: (p: Partial<Section>) => void; options: TermOption[] }) {
  const list = formTermsOf(s, options);
  const agreeAll = s.terms ? !!s.agree_all : false;
  const byId = new Map(options.map((o) => [o.id, o]));
  const set = (terms: FormTerm[], agree = agreeAll) => update({ terms, agree_all: agree });
  const change = (i: number, patch: Partial<FormTerm>) => set(list.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const unused = options.filter((o) => !list.some((t) => t.term_id === o.id));
  const problem = termsProblem(s, options);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-600">신청 폼에 보일 약관과 순서를 정해요. 기본은 ‘최신 버전 자동’이고, 다른 버전을 고르면 그 버전으로 고정돼요.</p>
        <a href="/dashboard/terms" target="_blank" className="text-xs text-indigo-600 hover:underline">약관 관리 열기 ↗</a>
      </div>
      {!s.terms && list.length > 0 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">지금은 사이트 기본 약관을 쓰고 있어요. 바꾸면 이 프로모션만의 설정으로 저장돼요.</p>}
      {list.map((t, i) => {
        const o = byId.get(t.term_id);
        const current = o?.versions.find((v) => v.id === o.current_version_id);
        return (
          <div key={t.term_id} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <select
                aria-label="약관"
                className="input flex-1"
                value={t.term_id}
                onChange={(e) => change(i, { term_id: e.target.value, version_id: null })}
              >
                {!o && <option value={t.term_id}>찾을 수 없는 약관 (보관 또는 삭제됨)</option>}
                {options
                  .filter((x) => x.id === t.term_id || !list.some((y) => y.term_id === x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title} · {TERM_KIND_LABEL[x.kind]}
                    </option>
                  ))}
              </select>
              <button type="button" aria-label="위로" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="아래로" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label="약관 빼기" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
                <button type="button" className={`px-3 py-1.5 ${t.required ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => change(i, { required: true })}>필수</button>
                <button type="button" className={`px-3 py-1.5 ${!t.required ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => change(i, { required: false })}>선택</button>
              </div>
              {o && (
                <select
                  aria-label="버전"
                  className={`input w-auto flex-1 py-1.5 text-xs ${t.version_id ? "border-amber-400 bg-amber-50" : ""}`}
                  value={t.version_id ?? ""}
                  onChange={(e) => change(i, { version_id: e.target.value || null })}
                >
                  <option value="">최신 버전 자동 (지금 v{current?.version ?? "-"})</option>
                  {o.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version}로 고정 · {date(v.published_at)} 발행
                    </option>
                  ))}
                </select>
              )}
            </div>
            {o && t.version_id && current && t.version_id !== current.id && (
              <p className="text-xs text-amber-800">고정됨 · 새 버전 v{current.version}이 있지만 이 프로모션은 고른 버전을 계속 보여줘요.</p>
            )}
            {o?.kind === "marketing" && <p className="text-xs text-slate-500">동의하면 ‘마케팅 동의’로 집계돼 수신자로 가져올 수 있어요.</p>}
          </div>
        );
      })}
      {unused.length > 0 ? (
        <button
          type="button"
          className="w-full rounded-lg border border-dashed border-slate-400 px-3 py-2.5 text-slate-600 hover:bg-slate-50"
          onClick={() => set([...list, { term_id: unused[0].id, version_id: null, required: unused[0].kind !== "marketing" }])}
        >
          + 약관 추가
        </button>
      ) : (
        <p className="text-xs text-slate-500">더 넣을 약관이 없어요. 약관 관리에서 새 약관을 만들고 발행한 뒤 이 페이지를 새로고침해 주세요.</p>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={agreeAll} onChange={(e) => set(list, e.target.checked)} /> ‘약관 전체 동의’ 체크박스 보이기
      </label>
      {problem && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {problem}</p>}
      <p className="text-xs text-slate-500">저장해야 페이지에 반영돼요.</p>
    </div>
  );
}
