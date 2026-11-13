"use client";

import { useActionState, useState } from "react";
import { ImageField } from "@/components/image-field";
import { updatePage, type FormState } from "../actions";
import { THEMES, type PageContent } from "@/lib/types";

const THEME_LABELS: Record<string, string> = {
  indigo: "인디고",
  emerald: "에메랄드",
  rose: "로즈",
  amber: "앰버",
  slate: "슬레이트",
};

export function PageEditor({ id, title, content, userId }: { id: string; title: string; content: PageContent; userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePage.bind(null, id), {});
  const [hero, setHero] = useState(content.hero_image ?? "");

  return (
    <form action={action} className="card space-y-5 p-6">
      <Field label="관리용 제목" name="title" defaultValue={title} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="상단 배지" name="badge" defaultValue={content.badge} />
        <div>
          <label className="label" htmlFor="theme">색상</label>
          <select id="theme" name="theme" defaultValue={content.theme} className="input">
            {THEMES.map((t) => (
              <option key={t} value={t}>{THEME_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="label">대표 이미지 (선택)</span>
        <input type="hidden" name="hero_image" value={hero} />
        <ImageField userId={userId} value={hero} onChange={setHero} context={content.headline} ratio="2:1" />
        <p className="mt-1 text-xs text-slate-500">헤드라인 아래에 크게 보여요. 저장을 눌러야 페이지에 반영돼요.</p>
      </div>
      <Field label="헤드라인" name="headline" defaultValue={content.headline} />
      <Field label="서브 헤드라인" name="subheadline" defaultValue={content.subheadline} textarea rows={2} />
      <Field
        label="핵심 혜택 (한 줄에 하나씩, '제목 | 설명' 형식)"
        name="benefits"
        defaultValue={content.benefits.map((b) => `${b.title} | ${b.description}`).join("\n")}
        textarea
        rows={4}
      />
      <Field label="상세 안내" name="details" defaultValue={content.details} textarea rows={3} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="신청 폼 제목" name="form_title" defaultValue={content.form_title} />
        <Field label="버튼 문구" name="cta_label" defaultValue={content.cta_label} />
      </div>
      <Field label="신청 폼 설명" name="form_description" defaultValue={content.form_description} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "저장 중..." : "저장"}</button>
        {state.saved && !pending && <span className="text-sm text-emerald-700">저장했어요.</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  textarea,
  rows,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {textarea ? (
        <textarea id={name} name={name} defaultValue={defaultValue} rows={rows} className="input" />
      ) : (
        <input id={name} name={name} defaultValue={defaultValue} className="input" />
      )}
    </div>
  );
}
