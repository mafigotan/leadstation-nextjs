"use client";

import { useActionState } from "react";
import { changePassword, setNewPassword, type PasswordState } from "@/app/(auth)/reset-password/actions";

function NewPasswordFields() {
  return (
    <>
      <div>
        <label className="label" htmlFor="new_password">새 비밀번호</label>
        <input id="new_password" name="new_password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        <p className="mt-1 text-xs text-slate-500">8자 이상 입력해주세요.</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm_password">새 비밀번호 확인</label>
        <input id="confirm_password" name="confirm_password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
    </>
  );
}

/** 마이 프로필 > 비밀번호 변경 */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    // Clear the fields after a successful change.
    <form key={state.ok ? "done" : "form"} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="current_password">현재 비밀번호</label>
          <input id="current_password" name="current_password" type="password" required autoComplete="current-password" className="input" />
        </div>
        <NewPasswordFields />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "바꾸는 중..." : "비밀번호 변경"}</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-emerald-700">{state.message}</p>}
      </div>
    </form>
  );
}

/** /reset-password: new password after opening the reset link. */
export function SetNewPasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="space-y-4">
      <NewPasswordFields />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "저장 중..." : "새 비밀번호 저장"}</button>
    </form>
  );
}
