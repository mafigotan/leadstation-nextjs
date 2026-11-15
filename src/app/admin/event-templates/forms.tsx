"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EVENT_MESSAGE, GAME_HEIGHT, gameDocument, type EventGame } from "@/lib/event-game";
import { createTemplate, deleteTemplate, reviseTemplate, setTemplatePublic, updateTemplate, type TemplateState } from "./actions";

const Msg = ({ s }: { s: TemplateState }) =>
  s.error ? <p className="text-sm text-red-600">{s.error}</p> : s.message ? <p className="text-sm text-emerald-700">{s.message}</p> : null;

export function NewTemplateForm() {
  const [state, action, pending] = useActionState<TemplateState, FormData>(createTemplate, {});
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        + 새 템플릿 만들기
      </button>
    );
  }
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-semibold">새 템플릿</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">이름 *</label>
          <input id="name" name="name" required maxLength={100} className="input" placeholder="예: 행운의 룰렛" />
        </div>
        <div>
          <label className="label" htmlFor="description">유저에게 보일 설명</label>
          <input id="description" name="description" maxLength={500} className="input" placeholder="예: 경품과 확률을 정할 수 있는 8칸 룰렛" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="prompt">AI에게 줄 게임 설명 *</label>
        <textarea
          id="prompt"
          name="prompt"
          required
          rows={5}
          maxLength={4000}
          className="input"
          placeholder="예: 6~10칸으로 바꿀 수 있는 룰렛. 돌리기 버튼을 누르면 감속하며 멈추고, 당첨 칸이 빛나며 컨페티가 터짐. 꽝도 있음. 각 칸의 문구, 색, 당첨 확률을 설정에서 바꿀 수 있게."
        />
        <p className="mt-1 text-xs text-slate-500">AI를 최고 품질로 설정해서 만들어요. 보통 2~5분 걸리고, 그동안 다른 일을 하셔도 돼요.</p>
      </div>
      <Msg s={state} />
      <div className="flex gap-2">
        <button disabled={pending} className="btn-primary">{pending ? "시작하는 중..." : "AI로 템플릿 만들기"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">취소</button>
      </div>
    </form>
  );
}

/** Reloads the page every few seconds while AI works. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

/** Playable preview that also shows what the game reports. */
export function GamePreview({ game }: { game: EventGame }) {
  const [result, setResult] = useState("");
  const [key, setKey] = useState(0);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { type?: string; result?: unknown } | null;
      if (e.origin === "null" && d?.type === EVENT_MESSAGE) setResult(String(d.result));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);
  return (
    <div className="space-y-2">
      <iframe key={key} title="미리보기" srcDoc={gameDocument(game)} sandbox="allow-scripts" className="w-full rounded-xl border border-slate-200 bg-white" style={{ height: GAME_HEIGHT }} />
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={result ? "font-medium text-emerald-700" : "text-slate-400"}>{result ? `보고된 결과: ${result}` : "게임을 끝내면 신청 폼에 들어갈 결과가 여기 보여요."}</span>
        <button type="button" onClick={() => { setResult(""); setKey((k) => k + 1); }} className="btn-secondary shrink-0 py-1 text-xs">처음부터</button>
      </div>
    </div>
  );
}

export function ReviseForm({ id, failed }: { id: string; failed: boolean }) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(reviseTemplate.bind(null, id), {});
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-semibold">{failed ? "다시 만들기" : "AI에게 수정 요청"}</h2>
      <textarea
        name="feedback"
        rows={4}
        maxLength={4000}
        className="input"
        placeholder={failed ? "(선택) 이번에 덧붙일 요청" : "예: 룰렛 칸 글씨가 작아요. 멈출 때 효과음을 넣고, 결과 화면을 더 화려하게 해주세요."}
      />
      <Msg s={state} />
      <button disabled={pending} className="btn-primary">{pending ? "요청하는 중..." : failed ? "AI로 다시 만들기" : "수정 요청하기"}</button>
      {!failed && <p className="text-xs text-slate-500">수정하는 동안에도 지금 게임은 그대로 쓰여요. 끝나면 이 화면이 자동으로 바뀌어요.</p>}
    </form>
  );
}

export function EditForm({ t }: { t: { id: string; name: string; description: string; sort_order: number; config: unknown } }) {
  const [state, action, pending] = useActionState<TemplateState, FormData>(updateTemplate.bind(null, t.id), {});
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-semibold">정보와 기본 설정</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
        <div>
          <label className="label" htmlFor="name">이름</label>
          <input id="name" name="name" defaultValue={t.name} required maxLength={100} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="sort_order">순서</label>
          <input id="sort_order" name="sort_order" type="number" defaultValue={t.sort_order} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">유저에게 보일 설명</label>
        <input id="description" name="description" defaultValue={t.description} maxLength={500} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="config">기본 설정 (JSON)</label>
        <textarea id="config" name="config" defaultValue={JSON.stringify(t.config, null, 2)} rows={12} className="input font-mono text-xs" spellCheck={false} />
        <p className="mt-1 text-xs text-slate-500">유저가 템플릿을 고르면 이 설정에서 시작하고, AI가 프로모션에 맞게 문구와 경품을 바꿔요.</p>
      </div>
      <Msg s={state} />
      <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "저장"}</button>
    </form>
  );
}

export function PublicToggle({ id, isPublic, disabled }: { id: string; isPublic: boolean; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={() => start(() => setTemplatePublic(id, !isPublic))}
      className={isPublic ? "btn-secondary" : "btn-primary"}
    >
      {pending ? "처리 중..." : isPublic ? "비공개로 바꾸기" : "공개하기"}
    </button>
  );
}

export function DeleteButton({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  return sure ? (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-red-600">정말 삭제할까요?</span>
      <button type="button" disabled={pending} onClick={() => start(() => deleteTemplate(id))} className="rounded-md bg-red-600 px-3 py-1.5 text-white">삭제</button>
      <button type="button" onClick={() => setSure(false)} className="btn-secondary py-1.5">취소</button>
    </span>
  ) : (
    <button type="button" onClick={() => setSure(true)} className="text-sm text-red-600 hover:underline">삭제</button>
  );
}
