"use client";

import { useActionState } from "react";
import { createPage, type FormState } from "../actions";

export function NewPageForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createPage, {});

  return (
    <form action={action} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="product">상품 또는 서비스명 *</label>
        <input id="product" name="product" required maxLength={200} className="input" placeholder="예: 홈트레이닝 PT 앱 '핏메이트'" />
      </div>
      <div>
        <label className="label" htmlFor="description">상품 설명 *</label>
        <textarea id="description" name="description" required rows={4} maxLength={3000} className="input" placeholder="어떤 상품인지, 어떤 문제를 해결하는지 자유롭게 적어주세요." />
      </div>
      <div>
        <label className="label" htmlFor="audience">타깃 고객</label>
        <input id="audience" name="audience" maxLength={500} className="input" placeholder="예: 운동을 시작하고 싶은 30대 직장인" />
      </div>
      <div>
        <label className="label" htmlFor="offer">프로모션 내용</label>
        <textarea id="offer" name="offer" rows={2} maxLength={1000} className="input" placeholder="예: 사전 신청 시 첫 달 50% 할인, 12월 31일까지" />
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
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "AI가 페이지를 만들고 있어요... (보통 10~30초)" : "AI로 페이지 만들기"}
      </button>
    </form>
  );
}
