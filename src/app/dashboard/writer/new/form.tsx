"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LANGUAGES, LENGTHS, POST_TYPES, TONES, type Brief, type Outline, type WriterSettings } from "@/lib/writer/types";
import { createArticle, createOutline } from "../actions";

export function NewArticleForm({ settings, keyword }: { settings: WriterSettings; keyword: string }) {
  const [brief, setBrief] = useState<Brief>({
    topic: "",
    keyword,
    subkw: "",
    type: "info",
    tone: settings.tone,
    length: settings.length,
    language: settings.language,
    audience: "",
    extra: "",
  });
  const [outline, setOutline] = useState<Outline | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, startTransition] = useTransition();

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  function run(label: string, fn: () => Promise<void>) {
    if (!brief.keyword.trim()) return setError("포커스 키워드를 입력해 주세요.");
    setError("");
    setBusy(label);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusy("");
      }
    });
  }

  const makeOutline = () =>
    run("개요를 만들고 있어요… (10~30초)", async () => {
      const r = await createOutline(brief);
      if (r.error) setError(r.error);
      else if (r.outline) setOutline(r.outline);
    });

  const makeArticle = (withOutline: boolean) =>
    run("본문을 쓰고 있어요… 1~3분 정도 걸려요. 이 화면을 닫지 마세요.", async () => {
      const r = await createArticle(brief, withOutline ? outline : null);
      if (r?.error) setError(r.error);
    });

  const setPara = (i: number, v: string) => setOutline((o) => o && { ...o, paragraphs: o.paragraphs.map((p, j) => (j === i ? v : p)) });
  const movePara = (i: number, d: number) =>
    setOutline((o) => {
      if (!o) return o;
      const p = [...o.paragraphs];
      const j = i + d;
      if (j < 0 || j >= p.length) return o;
      [p[i], p[j]] = [p[j], p[i]];
      return { ...o, paragraphs: p };
    });

  const step = outline ? 2 : 1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/writer" className="text-sm text-slate-500 hover:underline">← AI 글쓰기</Link>
          <h1 className="mt-1 text-2xl font-bold">새 글 쓰기</h1>
        </div>
        <ol className="flex gap-2 text-xs font-medium">
          {["주제 입력", "개요 확인", "본문 생성 후 편집"].map((t, i) => (
            <li key={t} className={`rounded-full px-3 py-1 ${i + 1 <= step ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>
              {i + 1} {t}
            </li>
          ))}
        </ol>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-6">
          <h2 className="font-bold">무엇에 대해 쓸까요?</h2>
          <div>
            <label className="label">주제 또는 제목 아이디어</label>
            <input className="input" value={brief.topic} onChange={(e) => set("topic", e.target.value)} placeholder="예: 초보자를 위한 홈카페 원두 고르는 법" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">포커스 키워드 (필수)</label>
              <input className="input" value={brief.keyword} onChange={(e) => set("keyword", e.target.value)} placeholder="예: 홈카페 원두" />
            </div>
            <div>
              <label className="label">보조 키워드 (쉼표로 구분)</label>
              <input className="input" value={brief.subkw} onChange={(e) => set("subkw", e.target.value)} placeholder="예: 원두 추천, 로스팅 단계" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">글 유형</label>
              <select className="input" value={brief.type} onChange={(e) => set("type", e.target.value as Brief["type"])}>
                {Object.entries(POST_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">톤</label>
              <select className="input" value={brief.tone} onChange={(e) => set("tone", e.target.value as Brief["tone"])}>
                {Object.entries(TONES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">언어</label>
              <select className="input" value={brief.language} onChange={(e) => set("language", e.target.value as Brief["language"])}>
                {Object.entries(LANGUAGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <span className="label">분량</span>
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(LENGTHS).map(([v, [l]]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" checked={brief.length === v} onChange={() => set("length", v as Brief["length"])} /> {l}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">대상 독자</label>
            <input className="input" value={brief.audience} onChange={(e) => set("audience", e.target.value)} placeholder="예: 홈카페를 막 시작한 20~30대" />
          </div>
          <div>
            <label className="label">추가 지시사항 (선택)</label>
            <textarea className="input" rows={3} value={brief.extra} onChange={(e) => set("extra", e.target.value)} placeholder="예: 마지막에 우리 매장 방문을 권하는 문장을 넣어줘" />
          </div>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            SEO 제목, 메타 설명, 주소(slug), 태그, 자주 묻는 질문은 자동으로 만들어지고 편집 화면에서 고칠 수 있어요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!!busy} onClick={makeOutline}>{outline ? "개요 다시 생성" : "개요 먼저 생성"}</button>
            <button className="btn-secondary" disabled={!!busy} onClick={() => makeArticle(false)}>바로 본문 생성</button>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-bold">개요 미리보기</h2>
          {!outline ? (
            <p className="mt-10 text-center text-sm leading-6 text-slate-400">
              &lsquo;개요 먼저 생성&rsquo;을 누르면 여기에<br />글 제목, 문단, 맺음말 형식의 개요가 나타나요.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">글 제목</label>
                <input className="input font-semibold" value={outline.title} onChange={(e) => setOutline({ ...outline, title: e.target.value })} />
              </div>
              {outline.paragraphs.map((p, i) => (
                <div key={i}>
                  <label className="label">문단 {i + 1}</label>
                  <div className="flex gap-1">
                    <input className="input" value={p} onChange={(e) => setPara(i, e.target.value)} />
                    <button className="btn-secondary px-2" title="위로" onClick={() => movePara(i, -1)}>↑</button>
                    <button className="btn-secondary px-2" title="아래로" onClick={() => movePara(i, 1)}>↓</button>
                    <button
                      className="btn-secondary px-2"
                      title="삭제"
                      onClick={() => setOutline({ ...outline, paragraphs: outline.paragraphs.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => setOutline({ ...outline, paragraphs: [...outline.paragraphs, ""] })}>
                + 문단 추가
              </button>
              <div>
                <label className="label">맺음말</label>
                <input className="input" value={outline.closing} onChange={(e) => setOutline({ ...outline, closing: e.target.value })} />
              </div>
              <button className="btn-primary w-full" disabled={!!busy} onClick={() => makeArticle(true)}>이 개요로 본문 생성</button>
              <p className="text-center text-xs text-slate-500">생성이 끝나면 초안으로 저장되고 편집 화면이 열려요.</p>
            </div>
          )}
        </section>
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="status" aria-live="polite">
          <div className="card flex items-center gap-3 px-6 py-5">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-sm font-medium">{busy}</span>
          </div>
        </div>
      )}
    </div>
  );
}
