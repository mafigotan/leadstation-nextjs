"use client";

import { useActionState } from "react";
import { saveSettings } from "../actions";
import type { SenderSettings } from "@/lib/newsletter/types";

export function SettingsForm({ settings, defaultReplyTo }: { settings: SenderSettings; defaultReplyTo: string }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  return (
    <form action={action} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="from_name">보내는 사람 이름 *</label>
        <input id="from_name" name="from_name" required defaultValue={settings.from_name} maxLength={80} className="input" placeholder="예: 네오엠씨" />
      </div>
      <div>
        <label className="label" htmlFor="reply_to">회신 받을 이메일</label>
        <input id="reply_to" name="reply_to" type="email" defaultValue={settings.reply_to || defaultReplyTo} className="input" />
        <p className="mt-1 text-xs text-slate-500">받는 사람이 &apos;답장&apos;을 누르면 이 주소로 가요.</p>
      </div>
      <div>
        <label className="label" htmlFor="footer_text">푸터 문구</label>
        <textarea id="footer_text" name="footer_text" rows={3} defaultValue={settings.footer_text} className="input" placeholder="회사명, 주소, 연락처 등 (정보통신망법상 광고성 메일에는 발신자 정보가 필요해요)" />
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="logo_url">로고 이미지 주소</label>
          <input id="logo_url" name="logo_url" defaultValue={settings.logo_url} className="input" placeholder="https://..." />
        </div>
        <div>
          <label className="label" htmlFor="accent_color">강조 색상</label>
          <input id="accent_color" name="accent_color" type="color" defaultValue={settings.accent_color} className="h-10 w-20 rounded border border-slate-300" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="brand_context">브랜드 정보 (AI 참고용)</label>
        <textarea id="brand_context" name="brand_context" rows={4} defaultValue={settings.brand_context} className="input" placeholder="회사 소개, 주요 제품, 자주 쓰는 표현 등을 적어두면 AI가 뉴스레터를 쓸 때 참고해요." />
      </div>
      {state && "error" in state && state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state && "ok" in state && state.ok && <p className="text-sm text-emerald-700">저장했어요.</p>}
      <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "저장"}</button>
    </form>
  );
}
