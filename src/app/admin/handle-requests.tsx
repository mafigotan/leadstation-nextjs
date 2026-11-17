"use client";

import Link from "next/link";
import { useActionState } from "react";
import { HandleInput } from "@/components/handle-input";
import { rejectHandleRequest, setSiteHandle, type AdminState } from "./actions";

export type HandleRequest = {
  id: string;
  site_id: string;
  current_handle: string;
  new_handle: string;
  reason: string;
  status: string;
  admin_note: string;
  created_at: string;
  handled_at: string | null;
  sites?: { handle: string; name: string } | null;
};

const STATUS: Record<string, [string, string]> = {
  pending: ["대기", "bg-amber-50 text-amber-700"],
  done: ["변경 완료", "bg-emerald-50 text-emerald-700"],
  rejected: ["반려", "bg-slate-100 text-slate-600"],
  canceled: ["요청 취소", "bg-slate-100 text-slate-400"],
};

const fmt = (d: string) => new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

function Status({ state }: { state: AdminState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function HandleStatusBadge({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? STATUS.pending;
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** Super admin form: set any address for the site. */
export function SiteHandleForm({ siteId, handle, rootDomain }: { siteId: string; handle: string; rootDomain: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setSiteHandle.bind(null, siteId), {});
  return (
    <form action={action} className="space-y-3">
      <HandleInput key={handle} initial={handle} rootDomain={rootDomain} currentSiteId={siteId} label="사이트 주소" notice="주소로 사이트가 공개돼요" />
      <div>
        <label className="label" htmlFor="handle-note">유저에게 보낼 메모 <span className="font-normal text-slate-400">(선택, 변경 요청이 있을 때 알림에 함께 가요)</span></label>
        <input id="handle-note" name="note" maxLength={1000} className="input" />
      </div>
      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">주소를 바꾸면 이 사이트의 기존 페이지와 블로그 링크가 더 이상 열리지 않아요.</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "바꾸는 중..." : "주소 변경"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** One open request with approve (change to the requested address) and reject. */
export function PendingHandleRequest({ request, showSite }: { request: HandleRequest; showSite?: boolean }) {
  const [approveState, approve, approving] = useActionState<AdminState, FormData>(setSiteHandle.bind(null, request.site_id), {});
  const [rejectState, reject, rejecting] = useActionState<AdminState, FormData>(rejectHandleRequest.bind(null, request.id), {});
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <HandleStatusBadge status={request.status} />
        {showSite && (
          <Link href={`/admin/sites/${request.site_id}`} className="font-medium text-indigo-600 hover:underline">
            {request.sites?.name || request.sites?.handle || request.current_handle}
          </Link>
        )}
        <span className="font-mono text-slate-500">{request.current_handle}</span>
        <span className="text-slate-400">→</span>
        <span className="font-mono font-semibold">{request.new_handle}</span>
        <span className="ml-auto text-xs text-slate-400">{fmt(request.created_at)}</span>
      </div>
      {request.reason && <p className="text-sm text-slate-600">요청 사유: {request.reason}</p>}
      <div className="flex flex-wrap items-start gap-3">
        <form action={approve} className="flex items-center gap-2">
          <input type="hidden" name="handle" value={request.new_handle} />
          <button disabled={approving || rejecting} className="btn-primary">{approving ? "바꾸는 중..." : "요청한 주소로 변경"}</button>
        </form>
        <form action={reject} className="flex flex-1 flex-wrap items-center gap-2">
          <input name="note" maxLength={1000} placeholder="반려 사유 (유저에게 알림으로 가요)" className="input min-w-48 flex-1" />
          <button disabled={approving || rejecting} className="btn-secondary">{rejecting ? "처리 중..." : "반려"}</button>
        </form>
      </div>
      <Status state={approveState.ok || approveState.error ? approveState : rejectState} />
    </div>
  );
}
