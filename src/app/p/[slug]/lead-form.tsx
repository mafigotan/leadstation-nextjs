"use client";

import { useActionState } from "react";
import { submitLead, type LeadState } from "./actions";
import { THEME_CLASSES, type Theme } from "@/lib/types";

export function LeadForm({ pageId, ctaLabel, theme }: { pageId: string; ctaLabel: string; theme: Theme }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead.bind(null, pageId), {});
  const t = THEME_CLASSES[theme] ?? THEME_CLASSES.indigo;

  if (state.done) {
    return (
      <div className={`rounded-xl p-8 text-center ${t.soft}`}>
        <p className="text-lg font-semibold">신청이 완료되었어요!</p>
        <p className="mt-2 text-sm text-slate-600">곧 안내 드릴게요. 감사합니다.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <label className="label" htmlFor="name">이름 *</label>
        <input id="name" name="name" required maxLength={100} className="input" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">이메일 *</label>
        <input id="email" name="email" type="email" required maxLength={200} className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="phone">연락처</label>
        <input id="phone" name="phone" type="tel" maxLength={50} className="input" autoComplete="tel" placeholder="010-0000-0000" />
      </div>
      <div>
        <label className="label" htmlFor="message">문의 내용</label>
        <textarea id="message" name="message" rows={3} maxLength={2000} className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="privacy" required className="mt-1" />
        <span>[필수] 개인정보(이름, 이메일, 연락처) 수집 및 이용에 동의합니다.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="marketing" className="mt-1" />
        <span>[선택] 이벤트 및 마케팅 정보 수신에 동의합니다.</span>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={`w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-60 ${t.bg}`}>
        {pending ? "신청 중..." : ctaLabel}
      </button>
    </form>
  );
}
