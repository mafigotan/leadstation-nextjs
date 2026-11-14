"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/visual-editor";
import { addPayment, updateSiteAdmin, type AdminState } from "../../actions";

type Site = { id: string; status: string; active_from: string | null; active_until: string | null; service_started_on: string | null };

function Status({ state }: { state: AdminState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.message}</p>;
  return null;
}

export function SiteAdminForm({ site, memo }: { site: Site; memo: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(updateSiteAdmin.bind(null, site.id), {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <span className="label">상태</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" name="status" value="active" defaultChecked={site.status !== "inactive"} /> 활성</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="status" value="inactive" defaultChecked={site.status === "inactive"} /> 비활성</label>
        </div>
        <p className="mt-1 text-xs text-slate-500">비활성이거나 이용 기간 밖이면 멤버가 대시보드를 쓸 수 없고, 공개 페이지와 블로그도 열리지 않아요.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="active_from">이용 시작일</label>
          <input id="active_from" name="active_from" type="date" defaultValue={site.active_from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="active_until">이용 종료일</label>
          <input id="active_until" name="active_until" type="date" defaultValue={site.active_until ?? ""} className="input" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">비워두면 기간 제한이 없어요.</p>
      <div>
        <label className="label" htmlFor="service_started_on">서비스 개시일</label>
        <input id="service_started_on" name="service_started_on" type="date" defaultValue={site.service_started_on ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="admin_memo">운영 메모 <span className="font-normal text-slate-400">(슈퍼 관리자만 보여요)</span></label>
        <textarea id="admin_memo" name="admin_memo" rows={3} defaultValue={memo} className="input" />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "저장"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export type SiteOption = { id: string; label: string };

export function PaymentForm({
  siteId = "",
  sites,
  today,
  onSaved,
}: {
  siteId?: string;
  sites?: SiteOption[];
  today: string;
  onSaved?: (message: string) => void;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(addPayment.bind(null, siteId), {});
  useEffect(() => {
    if (state.ok && onSaved) onSaved(state.message ?? "");
  }, [state, onSaved]);
  return (
    <form action={action} className="space-y-3">
      {sites && (
        <div>
          <label className="label" htmlFor="site_id">사이트</label>
          <select id="site_id" name="site_id" required defaultValue="" className="input">
            <option value="" disabled>결제한 사이트를 선택하세요</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="paid_on">결제일</label>
          <input id="paid_on" name="paid_on" type="date" required defaultValue={today} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="amount">금액 (원)</label>
          <input id="amount" name="amount" inputMode="numeric" required placeholder="330000" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="method">결제 방법</label>
          <select id="method" name="method" className="input">
            <option value="transfer">계좌이체</option>
            <option value="card">카드(오프라인)</option>
            <option value="cash">현금</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="payer">입금자</label>
          <input id="payer" name="payer" maxLength={100} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="period_from">이용 기간 시작</label>
          <input id="period_from" name="period_from" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="period_to">이용 기간 종료</label>
          <input id="period_to" name="period_to" type="date" className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="memo">메모</label>
        <input id="memo" name="memo" maxLength={1000} className="input" placeholder="예: 연간 이용료, 세금계산서 발행" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="extend" defaultChecked /> 사이트 이용 종료일을 이 결제의 기간 종료일까지 늘리고 활성으로 바꾸기
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "결제 기록"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** "결제 등록" button that opens the payment form in a modal. */
export function PaymentModalButton({ sites, today }: { sites: SiteOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setNotice(""); }} className="btn-primary">+ 결제 등록</button>
      {notice && <span className="text-sm text-emerald-700">{notice}</span>}
      {open && (
        <Modal title="서비스 이용료 결제 등록" onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-slate-500">이용 기간을 넣으면 그 사이트의 이용 종료일이 자동으로 늘어나고 활성으로 바뀌어요.</p>
          <PaymentForm
            sites={sites}
            today={today}
            onSaved={(m) => {
              setOpen(false);
              setNotice(m);
            }}
          />
        </Modal>
      )}
    </>
  );
}
