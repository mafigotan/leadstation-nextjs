"use client";

import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/welcome/actions";
import type { Profile, Site } from "@/lib/supabase/server";
import { ProfileFields } from "@/components/profile-fields";
import { HandleInput } from "@/components/handle-input";
import { ImageField } from "@/components/image-field";
import { addMember, cancelHandleRequest, cancelInvite, removeMember, requestHandleChange, saveMyInfo, saveSite, saveSiteInfo, setMemberRole, switchSite, type SiteInfo } from "./actions";

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

export function SiteForm({ site }: { site: Site }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSite, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="site-name">사이트 이름</label>
        <input id="site-name" name="name" defaultValue={site.name} maxLength={100} className="input" placeholder="예: 네오엠씨" />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "사이트 이름 저장"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export type HandleRequest = {
  id: string;
  current_handle: string;
  new_handle: string;
  reason: string;
  status: "pending" | "done" | "rejected" | "canceled";
  admin_note: string;
  created_at: string;
  handled_at: string | null;
};

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

/** Read-only site address with a change request to the super admins. */
export function HandleRequestPanel({
  site,
  rootDomain,
  isAdmin,
  latest,
}: {
  site: Site;
  rootDomain: string;
  isAdmin: boolean;
  latest: HandleRequest | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(requestHandleChange, {});
  const [cancelState, setCancelState] = useState<FormState>({});
  const [canceling, startCancel] = useTransition();
  const open_ = latest?.status === "pending" ? latest : null;
  const answered = latest && (latest.status === "rejected" || latest.status === "done") ? latest : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="label">사이트 주소</p>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-400">https://</span>
          <span className="font-semibold text-slate-700">{site.handle}</span>
          <span className="text-slate-500">.{rootDomain}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">사이트 주소는 LEADstation 운영팀에 요청해서 바꿀 수 있어요.</p>
      </div>

      {open_ ? (
        <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
          <p>
            <span className="font-semibold">{open_.new_handle}</span> 주소로 변경을 요청했어요. ({fmt(open_.created_at)})
          </p>
          {open_.reason && <p className="mt-1 text-xs opacity-80">요청 사유: {open_.reason}</p>}
          <p className="mt-1 text-xs opacity-80">운영팀이 확인 후 바꿔드리고, 대시보드 알림으로 알려드릴게요.</p>
          {isAdmin && (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={canceling}
                onClick={() => startCancel(async () => setCancelState(await cancelHandleRequest(open_.id)))}
                className="text-xs font-medium text-slate-600 underline hover:text-red-600"
              >
                {canceling ? "취소 중..." : "요청 취소"}
              </button>
              <Status state={cancelState} />
            </div>
          )}
        </div>
      ) : (
        <>
          {answered?.status === "rejected" && (
            <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              <p><span className="font-semibold">{answered.new_handle}</span> 주소로의 변경 요청이 반려됐어요.</p>
              {answered.admin_note && <p className="mt-1 text-xs">운영팀 답변: {answered.admin_note}</p>}
            </div>
          )}
          {!isAdmin ? (
            <p className="text-sm text-slate-500">주소 변경 요청은 사이트 관리자만 할 수 있어요.</p>
          ) : !open ? (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setOpen(true)} className="btn-secondary">주소 변경 요청</button>
              {state.ok && <Status state={state} />}
            </div>
          ) : (
            <form action={action} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <HandleInput rootDomain={rootDomain} currentSiteId={site.id} label="바꾸고 싶은 사이트 주소" notice="주소로 변경을 요청해요" />
              <div>
                <label className="label" htmlFor="handle-reason">요청 사유 <span className="font-normal text-slate-400">(선택)</span></label>
                <textarea id="handle-reason" name="reason" rows={2} maxLength={1000} className="input" placeholder="예: 회사 이름이 바뀌었어요." />
              </div>
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">주소가 바뀌면 이미 공유한 페이지와 블로그 링크가 더 이상 열리지 않아요.</p>
              <div className="flex items-center gap-3">
                <button disabled={pending} className="btn-primary">{pending ? "요청 중..." : "변경 요청 보내기"}</button>
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:underline">닫기</button>
                <Status state={state} />
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function SiteInfoForm({ userId, info }: { userId: string; info: SiteInfo }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSiteInfo, {});
  const [logo, setLogo] = useState(info.logo_url);
  const field = (name: keyof SiteInfo, label: string, placeholder: string, max: number, type = "text", wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={`si-${name}`}>{label}</label>
      <input id={`si-${name}`} name={name} type={type} defaultValue={info[name]} maxLength={max} className="input" placeholder={placeholder} />
    </div>
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <p className="label">로고</p>
        <p className="mb-2 text-xs text-slate-500">사이트 헤더 왼쪽에 보여요. 가로로 긴 이미지가 잘 어울리고, 없으면 사이트 이름이 글자로 보여요.</p>
        <input type="hidden" name="logo_url" value={logo} />
        <ImageField userId={userId} value={logo} onChange={setLogo} compact ratio="1:1" context="회사 로고" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("company_name", "상호", "예: 주식회사 네오엠씨", 100)}
        {field("ceo_name", "대표자", "예: 홍길동", 50)}
        {field("business_no", "사업자등록번호", "예: 123-45-67890", 30)}
        {field("contact_phone", "연락처", "예: 02-123-4567", 30, "tel")}
        {field("contact_email", "이메일", "예: hello@example.com", 200, "email", true)}
        {field("address", "주소", "예: 서울시 강남구 테헤란로 123", 300, "text", true)}
      </div>
      <p className="text-xs text-slate-500">입력한 항목만 사이트 푸터에 보여요.</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "표시 정보 저장"}</button>
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
