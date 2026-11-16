"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TERM_KINDS, termTemplate, type TermKind } from "@/lib/terms";
import { deleteTerm, deleteTermDraft, publishTerm, saveTermDraft, setTermArchived, type TermResult } from "../actions";

export type VersionView = {
  id: string;
  version: number;
  label: string;
  body: string;
  body_hash: string;
  change_note: string;
  published_at: string | null;
  consents: number;
};

type Linked = { id: string; title: string; required: boolean; pinned: number | null };

const when = (s: string) => new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });

export function TermEditor({
  term,
  versions,
  linked,
  owner,
}: {
  term: { id: string; title: string; kind: TermKind; is_default: boolean; current_version_id: string | null; archived: boolean };
  versions: VersionView[];
  linked: Linked[];
  owner: string;
}) {
  const draft = versions.find((v) => !v.published_at);
  const current = versions.find((v) => v.id === term.current_version_id);
  const start = draft ?? current;
  const [title, setTitle] = useState(term.title);
  const [kind, setKind] = useState<TermKind>(term.kind);
  const [label, setLabel] = useState(start?.label ?? "");
  const [body, setBody] = useState(start?.body ?? "");
  const [note, setNote] = useState(draft?.change_note ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start_] = useTransition();

  const nextNo = draft?.version ?? Math.max(0, ...versions.map((v) => v.version)) + 1;
  const unchanged = !draft && !!current && label.trim() === current.label && body.trim() === current.body.trim() && title.trim() === term.title && kind === term.kind;
  const auto = linked.filter((l) => l.pinned == null).length;
  const totalConsents = versions.reduce((n, v) => n + v.consents, 0);
  const input = { title, kind, label, body, change_note: note };

  const run = (fn: () => Promise<TermResult>) =>
    start_(async () => {
      const r = await fn();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.ok ?? "저장했어요." });
    });

  return (
    <div className="mt-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{term.title}</h1>
          {term.is_default && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">기본</span>}
          {term.archived && <span className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">보관됨</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {term.archived ? (
            <button className="btn-secondary" disabled={pending} onClick={() => run(() => setTermArchived(term.id, false))}>보관 해제</button>
          ) : (
            <>
              {totalConsents === 0 && linked.length === 0 && (
                <button className="btn-danger" disabled={pending} onClick={() => run(() => deleteTerm(term.id))}>삭제</button>
              )}
              <button className="btn-secondary" disabled={pending} onClick={() => run(() => setTermArchived(term.id, true))}>보관하기</button>
              <button className="btn-secondary" disabled={pending} onClick={() => run(() => saveTermDraft(term.id, input))}>임시 저장</button>
              <button className="btn-primary" disabled={pending || unchanged} onClick={() => run(() => publishTerm(term.id, input))}>
                {pending ? "처리 중…" : `v${nextNo}로 발행`}
              </button>
            </>
          )}
        </div>
      </div>
      {msg && <p className={`mb-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

      <div className="flex flex-wrap items-start gap-5">
        <section className="card min-w-0 flex-[999_1_560px] space-y-4 p-5">
          {term.archived ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">보관된 약관이에요. 고치려면 보관을 해제해 주세요.</p>
          ) : draft ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              작성 중인 v{draft.version}이에요. {current ? `발행하기 전까지 신청 폼에는 지금 버전 v${current.version}이 보여요.` : "발행해야 프로모션에 연결할 수 있어요."}
              {current && (
                <button className="ml-2 text-xs text-amber-900 underline" disabled={pending} onClick={() => run(() => deleteTermDraft(term.id))}>작성 중인 버전 지우기</button>
              )}
            </p>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">고쳐서 저장하거나 발행하면 새 버전 v{nextNo}이 만들어져요. 발행한 버전은 바뀌지 않아요.</p>
          )}
          <fieldset disabled={term.archived} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="term-title">약관 이름 (관리용)</label>
                <input id="term-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="term-kind">유형</label>
                <select id="term-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as TermKind)}>
                  {TERM_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>{k.label}</option>
                  ))}
                </select>
                {kind === "marketing" && <p className="mt-1 text-xs text-slate-500">이 약관에 동의한 리드는 ‘마케팅 동의’로 집계되고 수신자로 가져올 수 있어요.</p>}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="term-label">신청 폼에 보이는 동의 문구</label>
              <input id="term-label" className="input" value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">폼에는 ‘[필수] {label || "동의 문구"} 보기’처럼 나와요. 필수/선택은 프로모션에서 정해요.</p>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="term-body">약관 전문</label>
                {kind !== "other" && (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      const t = termTemplate(kind, owner);
                      setBody(t.body);
                      if (!label) setLabel(t.label);
                    }}
                  >
                    표준 양식 불러오기
                  </button>
                )}
              </div>
              <textarea id="term-body" className="input min-h-72 font-[inherit] leading-relaxed" value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">줄바꿈은 그대로 보여요. [ ] 안의 예시는 실제 내용으로 바꿔 주세요.</p>
            </div>
            <div>
              <label className="label" htmlFor="term-note">변경 메모 (이 버전에서 바뀐 점)</label>
              <input id="term-note" className="input" value={note} maxLength={300} placeholder="예: 보유 기간 1개월 → 3개월" onChange={(e) => setNote(e.target.value)} />
            </div>
          </fieldset>
          {!term.archived && linked.length > 0 && (
            <p className="text-xs text-slate-500">
              발행하면 ‘최신 버전 자동’으로 연결된 프로모션 {auto}개에 바로 반영돼요.{linked.length - auto > 0 && ` 버전을 고정한 ${linked.length - auto}개는 그대로예요.`}
            </p>
          )}
        </section>

        <aside className="flex flex-[1_1_300px] flex-col gap-4">
          <section className="card space-y-2 p-4">
            <h2 className="font-semibold">버전 이력</h2>
            {versions.length === 0 && <p className="text-sm text-slate-500">아직 버전이 없어요.</p>}
            {versions.map((v) => {
              const isCurrent = v.id === term.current_version_id;
              return (
                <div key={v.id} className={`rounded-lg border p-3 text-sm ${!v.published_at ? "border-dashed border-amber-400" : isCurrent ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
                  <div className="flex justify-between gap-2">
                    <span>
                      <b>v{v.version}</b> {!v.published_at ? "작성 중" : isCurrent ? "현재 버전" : ""}
                    </span>
                    <span className="text-xs text-slate-500">{v.published_at ? `${when(v.published_at)} 발행` : "-"}</span>
                  </div>
                  {v.published_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      동의 {v.consents.toLocaleString()}건{v.change_note && ` · ${v.change_note}`}
                    </p>
                  )}
                  {v.published_at && (
                    <div className="mt-1 flex gap-3 text-xs">
                      <button type="button" className="text-indigo-600 hover:underline" onClick={() => setOpen(open === v.id ? null : v.id)}>
                        {open === v.id ? "전문 접기" : "전문 보기"}
                      </button>
                      {!term.archived && (
                        <button
                          type="button"
                          className="text-indigo-600 hover:underline"
                          onClick={() => {
                            setLabel(v.label);
                            setBody(v.body);
                            setNote(`v${v.version} 내용으로 되돌림`);
                          }}
                        >
                          이 버전으로 새로 작성
                        </button>
                      )}
                    </div>
                  )}
                  {open === v.id && (
                    <div className="mt-2 space-y-1 rounded-md bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
                      <p className="font-medium">{v.label}</p>
                      <p className="whitespace-pre-line">{v.body || "(전문 없음)"}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold">연결된 프로모션</h2>
            {linked.length === 0 && <p className="text-slate-500">아직 이 약관을 쓰는 프로모션이 없어요. 프로모션 편집기에서 신청 폼을 누르고 ‘약관’을 골라 연결해요.</p>}
            {linked.map((p) => (
              <div key={p.id} className="flex justify-between gap-2">
                <Link href={`/dashboard/pages/${p.id}`} className="truncate hover:underline">{p.title}</Link>
                <span className={`shrink-0 text-xs ${p.pinned ? "text-amber-800" : "text-slate-500"}`}>
                  {p.required ? "필수" : "선택"} · {p.pinned ? `v${p.pinned} 고정` : "최신 자동"}
                </span>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
