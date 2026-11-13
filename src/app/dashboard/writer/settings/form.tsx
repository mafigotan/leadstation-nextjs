"use client";

import { useActionState } from "react";
import { LANGUAGES, LENGTHS, TONES, type WriterSettings } from "@/lib/writer/types";
import { saveWriterSettings } from "../actions";

export function WriterSettingsForm({ settings }: { settings: WriterSettings }) {
  const [state, action, pending] = useActionState(saveWriterSettings, null);
  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="tone">기본 톤</label>
          <select id="tone" name="tone" defaultValue={settings.tone} className="input">
            {Object.entries(TONES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="length">기본 분량</label>
          <select id="length" name="length" defaultValue={settings.length} className="input">
            {Object.entries(LENGTHS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="language">기본 언어</label>
          <select id="language" name="language" defaultValue={settings.language} className="input">
            {Object.entries(LANGUAGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="brand_voice">브랜드 보이스</label>
        <textarea id="brand_voice" name="brand_voice" rows={4} defaultValue={settings.brand_voice} className="input" placeholder="예: 존댓말, 짧은 문장, 전문 용어는 풀어서 설명. 회사 소개나 주요 제품을 적어도 좋아요." />
        <p className="mt-1 text-xs text-slate-500">모든 글 생성 요청에 함께 전달돼요.</p>
      </div>
      <div>
        <label className="label" htmlFor="banned_words">금지어</label>
        <input id="banned_words" name="banned_words" defaultValue={settings.banned_words} className="input" placeholder="쉼표로 구분" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p className="text-sm text-emerald-700">저장했어요.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "저장 중…" : "저장"}</button>
    </form>
  );
}
