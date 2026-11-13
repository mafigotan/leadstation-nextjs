"use client";

import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/welcome/actions";
import type { Profile, Site } from "@/lib/supabase/server";
import { ProfileFields } from "@/components/profile-fields";
import { HandleInput } from "@/components/handle-input";
import { addMember, cancelInvite, removeMember, saveMyInfo, saveSite, setMemberRole, switchSite } from "./actions";

export type Member = { user_id: string; email: string; full_name: string; phone: string; role: "admin" | "member" };
export type Invite = { id: string; email: string; role: "admin" | "member" };

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok && state.message) return <p className="text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function MyInfoForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMyInfo, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <ProfileFields profile={profile} />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "저장"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function SiteForm({ site, rootDomain }: { site: Site; rootDomain: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSite, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="site-name">사이트 이름</label>
        <input id="site-name" name="name" defaultValue={site.name} maxLength={100} className="input" placeholder="예: 네오엠씨" />
      </div>
      <HandleInput initial={site.handle} rootDomain={rootDomain} currentSiteId={site.id} notice="주소로 사이트가 공개돼요" />
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">주소를 바꾸면 이미 공유한 페이지와 블로그 링크가 더 이상 열리지 않아요.</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "사이트 저장"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function SiteSwitcher({ current, sites }: { current: string; sites: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <label className="text-sm font-medium" htmlFor="site-switch">작업할 사이트</label>
      <select
        id="site-switch"
        className="input w-auto"
        value={current}
        disabled={pending}
        onChange={(e) => start(async () => { await switchSite(e.target.value); router.refresh(); })}
      >
        {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );
}

const roleLabel = { admin: "관리자", member: "사용자" } as const;

export function MembersPanel({ me, isAdmin, members, invites }: { me: string; isAdmin: boolean; members: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(addMember, {});
  const [rowState, setRowState] = useState<FormState>({});
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<FormState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => { setRowState(await fn()); router.refresh(); });
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="px-3 py-2 font-medium">이메일</th>
              <th className="px-3 py-2 font-medium">권한</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className="px-3 py-2">{m.full_name || "-"}{m.user_id === me && <span className="ml-1 text-xs text-slate-400">(나)</span>}</td>
                <td className="px-3 py-2 text-slate-600">{m.email}</td>
                <td className="px-3 py-2">
                  {isAdmin && m.user_id !== me ? (
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => run(() => setMemberRole(m.user_id, e.target.value as Member["role"]))}
                    >
                      <option value="admin">관리자</option>
                      <option value="member">사용자</option>
                    </select>
                  ) : (
                    roleLabel[m.role]
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {m.user_id === me ? (
                    <button disabled={busy} className="text-xs text-slate-500 hover:text-red-600" onClick={() => run(() => removeMember(m.user_id), "이 사이트에서 나갈까요?")}>나가기</button>
                  ) : isAdmin ? (
                    <button disabled={busy} className="text-xs text-red-600 hover:underline" onClick={() => run(() => removeMember(m.user_id), `${m.email} 님을 사이트에서 삭제할까요?`)}>삭제</button>
                  ) : null}
                </td>
              </tr>
            ))}
            {invites.map((i) => (
              <tr key={i.id} className="bg-amber-50/40">
                <td className="px-3 py-2 text-slate-400">가입 대기</td>
                <td className="px-3 py-2 text-slate-600">{i.email}</td>
                <td className="px-3 py-2">{roleLabel[i.role]}</td>
                <td className="px-3 py-2 text-right">
                  <button disabled={busy} className="text-xs text-slate-500 hover:text-red-600" onClick={() => run(() => cancelInvite(i.id))}>초대 취소</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Status state={rowState} />

      {isAdmin && (
        <form action={action} className="space-y-2 rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-medium">사이트 이용자 추가</p>
          <div className="flex flex-wrap gap-2">
            <input name="email" type="email" required placeholder="추가할 사람의 이메일" className="input min-w-0 flex-1" />
            <select name="role" defaultValue="member" className="input w-auto">
              <option value="member">사용자</option>
              <option value="admin">관리자</option>
            </select>
            <button disabled={pending} className="btn-primary">{pending ? "추가 중..." : "추가"}</button>
          </div>
          <p className="text-xs text-slate-500">이미 가입한 사람은 바로 추가돼요. 아직 가입하지 않았다면 이 이메일로 가입할 때 자동으로 추가돼요.</p>
          <Status state={state} />
        </form>
      )}
    </div>
  );
}
