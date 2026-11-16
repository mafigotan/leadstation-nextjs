"use client";

import { useActionState, useState } from "react";
import { createPage, type FormState } from "../actions";
import { LEAD_FIELDS, LEGACY_FIELDS, type LeadField } from "@/lib/lead-fields";

export function NewPageForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createPage, {});
  const [withForm, setWithForm] = useState(true);
  const [chosen, setChosen] = useState<LeadField[]>(LEGACY_FIELDS.filter((f) => f !== "message"));
  const [required, setRequired] = useState<LeadField[]>(LEGACY_FIELDS.filter((f) => f !== "message"));
  const toggle = (list: LeadField[], k: LeadField, on: boolean) => (on ? [...list.filter((x) => x !== k), k] : list.filter((x) => x !== k));

  return (
    <form action={action} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="product">프로모션 제목*</label>
        <input id="product" name="product" required maxLength={200} className="input" placeholder="예: 홈트레이닝 PT 앱 '핏메이트' 사전 신청 이벤트" />
      </div>
      <div>
        <label className="label" htmlFor="description">상품 및 서비스 설명*</label>
        <textarea id="description" name="description" required rows={4} maxLength={3000} className="input" placeholder="상품 및 서비스에 대한 설명을 적어주세요." />
      </div>
      <div>
        <label className="label" htmlFor="audience">타깃 고객</label>
        <input id="audience" name="audience" maxLength={500} className="input" placeholder="예: 운동을 시작하고 싶은 30대 직장인" />
      </div>
      <div>
        <label className="label" htmlFor="offer">지시 사항</label>
        <textarea id="offer" name="offer" rows={3} maxLength={1000} className="input" placeholder="프로모션 페이지에 어떤 추가 사항이 있는지 AI에게 지시할 내용을 적어주세요." />
      </div>
      <div>
        <label className="label" htmlFor="tone">톤</label>
        <select id="tone" name="tone" className="input" defaultValue="신뢰감 있고 친근한">
          <option>신뢰감 있고 친근한</option>
          <option>전문적이고 차분한</option>
          <option>활기차고 유쾌한</option>
          <option>고급스럽고 세련된</option>
          <option>긴급하고 강렬한</option>
        </select>
      </div>
      <div>
        <span className="label">신청 폼 삽입</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="lead_form" value="on" checked={withForm} onChange={() => setWithForm(true)} /> 삽입
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="lead_form" value="off" checked={!withForm} onChange={() => setWithForm(false)} /> 삽입 안 함
          </label>
        </div>
      </div>
      {withForm && (
        <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">신청 폼 필드 선택</legend>
          <p className="mb-3 text-xs text-slate-500">선택한 필드로 프로모션 페이지에 신청 폼을 넣어요. 필드마다 꼭 입력해야 하는지(필수) 정할 수 있고, 나중에 편집기에서도 바꿀 수 있어요.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEAD_FIELDS.map((f) => {
              const on = chosen.includes(f.key);
              return (
                <div key={f.key} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="lead_fields"
                      value={f.key}
                      checked={on}
                      onChange={(e) => {
                        setChosen(toggle(chosen, f.key, e.target.checked));
                        setRequired(toggle(required, f.key, e.target.checked && f.key !== "message"));
                      }}
                    />
                    {f.label}
                  </label>
                  {on && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" name="lead_required" value={f.key} checked={required.includes(f.key)} onChange={(e) => setRequired(toggle(required, f.key, e.target.checked))} />
                      필수
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "AI가 프로모션을 만들고 있어요... (보통 10~30초)" : "AI로 프로모션 만들기"}
      </button>
    </form>
  );
}
