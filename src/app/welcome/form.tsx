"use client";

import { useActionState, useState } from "react";
import { completeProfile, type FormState } from "./actions";
import { HandleInput } from "@/components/handle-input";
import { ProfileFields } from "@/components/profile-fields";
import type { Profile } from "@/lib/supabase/server";

export function WelcomeForm({
  profile,
  invitedTo,
  suggestion,
  rootDomain,
}: {
  profile: Partial<Profile> | null;
  invitedTo: string[];
  suggestion: string;
  rootDomain: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeProfile, {});
  const [mode, setMode] = useState<"create" | "join">("create");
  const tab = (m: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === m ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
    >
      {label}
    </button>
  );

  return (
    <form action={action} className="space-y-5">
      <ProfileFields profile={profile} />
      {invitedTo.length ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          초대받은 사이트 <span className="font-semibold">{invitedTo.join(", ")}</span> 에 함께하게 돼요. 사이트 주소는 따로 만들지 않아도 돼요.
        </div>
      ) : (
        <>
          <input type="hidden" name="mode" value={mode} />
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {tab("create", "내 사이트 만들기")}
            {tab("join", "기존 사이트 이용 신청")}
          </div>
          {mode === "create" ? (
            <HandleInput initial={suggestion} rootDomain={rootDomain} />
          ) : (
            <div>
              <label className="label" htmlFor="join-handle">이용할 사이트 주소</label>
              <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
                <span className="pl-3 text-sm text-slate-400">https://</span>
                <input
                  id="join-handle"
                  name="handle"
                  required
                  maxLength={30}
                  autoComplete="off"
                  onChange={(e) => (e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-right text-sm font-semibold focus:outline-none"
                  placeholder="company"
                />
                <span className="pr-3 text-sm text-slate-500">.{rootDomain}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">회사에서 이미 쓰고 있는 사이트 주소를 입력하세요. 사이트 관리자에게 알림이 가고, 승인하면 바로 이용할 수 있어요.</p>
            </div>
          )}
        </>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && state.message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{state.message}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "저장 중..." : mode === "join" && !invitedTo.length ? "이용 신청하기" : "시작하기"}
      </button>
    </form>
  );
}
