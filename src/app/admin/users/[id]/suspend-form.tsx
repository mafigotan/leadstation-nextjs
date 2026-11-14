"use client";

import { useActionState } from "react";
import { setSuspended, type AdminState } from "../../actions";

export function SuspendForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setSuspended.bind(null, userId, !suspended), {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(suspended ? "정지를 풀까요?" : "이 계정의 이용을 정지할까요? 로그인해도 서비스를 쓸 수 없게 돼요.")) e.preventDefault();
      }}
      className="space-y-3"
    >
      {!suspended && <textarea name="reason" rows={2} maxLength={500} placeholder="정지 사유 (유저에게 보여요)" className="input" />}
      <button disabled={pending} className={suspended ? "btn-secondary w-full" : "w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"}>
        {pending ? "처리 중..." : suspended ? "정지 해제" : "이용 정지"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700">{state.message}</p>}
    </form>
  );
}
