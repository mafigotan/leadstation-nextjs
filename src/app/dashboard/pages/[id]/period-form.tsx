"use client";

import { useActionState } from "react";
import { updatePeriod, type FormState } from "../actions";

/** Start and end dates of the promotion, used for the 진행 중 / 종료 badge on the user site. */
export function PeriodForm({ id, startsOn, endsOn }: { id: string; startsOn: string | null; endsOn: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePeriod.bind(null, id), {});
  return (
    <form action={action} className="card space-y-3 p-5">
      <div>
        <p className="text-sm font-medium">프로모션 기간</p>
        <p className="mt-0.5 text-xs text-slate-500">사이트 메인과 프로모션 목록에 ‘진행 중’, ‘종료’로 표시돼요. 비워 두면 기간 제한이 없어요.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600" htmlFor="starts_on">시작일</label>
          <input id="starts_on" name="starts_on" type="date" defaultValue={startsOn ?? ""} className="input py-1.5" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600" htmlFor="ends_on">종료일</label>
          <input id="ends_on" name="ends_on" type="date" defaultValue={endsOn ?? ""} className="input py-1.5" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-secondary px-3 py-1.5">{pending ? "저장 중..." : "기간 저장"}</button>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state.saved && <p className="text-xs text-emerald-700">저장했어요.</p>}
      </div>
    </form>
  );
}
