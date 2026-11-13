"use client";

import { useActionState, useState } from "react";
import { checkHandle, saveProfile, type HandleState } from "@/app/welcome/actions";

export function HandleForm({
  initialHandle = "",
  initialName = "",
  rootDomain,
  submitLabel,
}: {
  initialHandle?: string;
  initialName?: string;
  rootDomain: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<HandleState, FormData>(saveProfile, {});
  const [handle, setHandle] = useState(initialHandle);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="handle">내 주소</label>
        <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
          <span className="pl-3 text-sm text-slate-400">https://</span>
          <input
            id="handle"
            name="handle"
            required
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              setCheck(null);
            }}
            onBlur={async () => handle && setCheck(await checkHandle(handle))}
            maxLength={30}
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-right text-sm font-semibold focus:outline-none"
            placeholder="mycompany"
          />
          <span className="pr-3 text-sm text-slate-500">.{rootDomain}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">영문 소문자, 숫자, 하이픈(-) 3~30자. 프로모션 페이지가 이 주소 아래에 만들어져요.</p>
        {check && <p className={`mt-1 text-xs ${check.ok ? "text-emerald-700" : "text-red-600"}`}>{check.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="display_name">회사 또는 브랜드 이름</label>
        <input id="display_name" name="display_name" defaultValue={initialName} maxLength={80} className="input" placeholder="예: 네오엠씨" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700">저장했어요.</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "저장 중..." : submitLabel}</button>
    </form>
  );
}
