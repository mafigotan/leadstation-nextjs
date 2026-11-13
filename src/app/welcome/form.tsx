"use client";

import { useActionState } from "react";
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
  return (
    <form action={action} className="space-y-5">
      <ProfileFields profile={profile} />
      {invitedTo.length ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          초대받은 사이트 <span className="font-semibold">{invitedTo.join(", ")}</span> 에 함께하게 돼요. 사이트 주소는 따로 만들지 않아도 돼요.
        </div>
      ) : (
        <HandleInput initial={suggestion} rootDomain={rootDomain} />
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "저장 중..." : "시작하기"}</button>
    </form>
  );
}
