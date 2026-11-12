"use client";

import { useActionState, useEffect, useRef } from "react";
import { addRecipient } from "./actions";

export function AddRecipient({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addRecipient, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && "ok" in state && state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="card space-y-3 p-5">
      <h2 className="font-semibold">수신자 추가</h2>
      <input name="email" type="email" required placeholder="이메일 *" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="name" placeholder="이름" className="input" />
        <input name="phone" placeholder="연락처" className="input" />
      </div>
      <input name="company" placeholder="회사" className="input" />
      {groups.length > 0 && (
        <div className="max-h-24 space-y-1 overflow-y-auto text-sm">
          {groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2">
              <input type="checkbox" name="groups" value={g.id} /> {g.name}
            </label>
          ))}
        </div>
      )}
      {state && "error" in state && state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state && "ok" in state && state.ok && <p className="text-sm text-emerald-700">추가했어요.</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "추가 중..." : "추가"}</button>
    </form>
  );
}
