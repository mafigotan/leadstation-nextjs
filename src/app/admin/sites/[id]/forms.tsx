"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/visual-editor";
import { addPayment, updateSiteAdmin, updateSitePlan, type AdminState } from "../../actions";
import { LIMIT_COLUMNS, LIMIT_LABEL, addDays, formatBytes, formatMb, limitText, periodEnd, planName, type LimitColumn, type Plan } from "@/lib/plans";

type Site = {
  id: string;
  status: string;
  active_from: string | null;
  active_until: string | null;
  service_started_on: string | null;
};

export type Usage = { kind: UsageKind; used: number; limit_value: number | null };
type UsageKind = "ai" | "newsletter" | "subscribers" | "storage" | "members";

const USAGE_OF: Record<LimitColumn, UsageKind> = {
  ai_token_limit: "ai",
  newsletter_limit: "newsletter",
  subscriber_limit: "subscribers",
  storage_mb_limit: "storage",
  member_limit: "members",
};

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

/** Plan and per-site limits: plan default, this site's own value (empty = plan default), current usage. */
export function SitePlanForm({ siteId, plan, overrides, plans, usage }: {
  siteId: string;
  plan: string | null;
  overrides: Record<LimitColumn, number | null>;
  plans: Plan[];
  usage: Usage[];
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(updateSitePlan.bind(null, siteId), {});
  const [picked, setPicked] = useState(plan ?? "");
  const def = plans.find((p) => p.code === picked) ?? null;
  const changed = picked !== (plan ?? "");
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="plan">요금제</label>
          <select id="plan" name="plan" value={picked} onChange={(e) => setPicked(e.target.value)} className="input w-auto">
            <option value="">미지정 (사이트 값만 사용)</option>
            {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        {changed && picked !== "custom" && (
          <p className="pb-2 text-xs text-amber-700">저장하면 개별 조정값을 비우고 {planName(picked || null)} 한도를 바로 적용해요. 이용 기간은 바뀌지 않아요.</p>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="px-3 py-2 font-medium">항목</th><th className="px-3 py-2 font-medium">요금제 기본값</th><th className="px-3 py-2 font-medium">이 사이트 적용값</th><th className="px-3 py-2 font-medium">사용량</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {LIMIT_COLUMNS.map((col) => {
              const [label, unit] = LIMIT_LABEL[col];
              const u = usage.find((x) => x.kind === USAGE_OF[col]);
              const pct = u && u.limit_value ? Math.min(100, Math.round((u.used / u.limit_value) * 100)) : null;
              const own = overrides[col];
              const shown = col === "storage_mb_limit" ? (own === null ? "" : +(own / 1024).toFixed(2)) : own ?? "";
              const usedText = u ? (col === "storage_mb_limit" ? formatBytes(u.used) : u.used.toLocaleString()) : "-";
              return (
                <tr key={col}>
                  <td className="whitespace-nowrap px-3 py-2">{label} <span className="text-xs text-slate-400">({col === "storage_mb_limit" ? "GB" : unit})</span></td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{def ? limitText(col, def[col]) : "-"}</td>
                  <td className="px-3 py-2">
                    <input
                      name={col}
                      aria-label={`${label} 적용값`}
                      inputMode="decimal"
                      defaultValue={shown}
                      key={`${col}-${picked}`}
                      disabled={changed && picked !== "custom"}
                      placeholder={def ? "기본값 사용" : "무제한"}
                      className="input py-1.5"
                    />
                    {own !== null && !changed && <span className="text-xs text-indigo-600">개별 조정됨</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {usedText}
                    {pct !== null && <span className={pct >= 90 ? "font-semibold text-red-600" : "text-slate-500"}> ({pct}%)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        적용값을 비우면 요금제 기본값을 써요. AI 사용량과 뉴스레터 발송은 매달 1일에 초기화되고, AI 사용량은 본문 토큰과 이미지(1장 4,000토큰)를 합산해요. 멤버 수에는 수락 전 초대도 들어가요.
      </p>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "요금제와 한도 저장"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export type SiteOption = { id: string; label: string; plan?: string | null; active_until?: string | null };

const MONTH_OPTIONS = [1, 3, 6, 12];

export function PaymentForm({
  siteId = "",
  sites,
  site,
  plans,
  today,
  onSaved,
}: {
  siteId?: string;
  sites?: SiteOption[];
  /** The site when the form is on its page (siteId set). */
  site?: SiteOption;
  plans: Plan[];
  today: string;
  onSaved?: (message: string) => void;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(addPayment.bind(null, siteId), {});
  const [chosen, setChosen] = useState(sites?.find((x) => x.id === siteId)?.id ?? "");
  const current = site ?? sites?.find((x) => x.id === chosen) ?? null;
  const [plan, setPlan] = useState(current?.plan && current.plan !== "free" ? current.plan : "basic");
  const [months, setMonths] = useState(12);
  const startFor = (p: string, cur: SiteOption | null) =>
    cur?.plan === p && cur.active_until && cur.active_until >= today ? addDays(cur.active_until, 1) : today;
  const [from, setFrom] = useState(() => startFor(plan, current));
  const def = plans.find((p) => p.code === plan) ?? null;
  const endFor = (f: string, p: Plan | null, m: number) => (p?.trial_days ? addDays(f, p.trial_days - 1) : periodEnd(f, m));
  const [to, setTo] = useState(() => endFor(from, def, months));
  const priceFor = (p: Plan | null, m: number) => (p?.monthly_price === null || p?.monthly_price === undefined ? "" : (p.trial_days ? 0 : p.monthly_price * m).toLocaleString());
  const [amount, setAmount] = useState(() => priceFor(def, months));

  // Picking a site, plan or length refills the dates and amount (they can still be edited).
  const refill = (nextPlan: string, nextMonths: number, cur: SiteOption | null) => {
    const p = plans.find((x) => x.code === nextPlan) ?? null;
    const f = startFor(nextPlan, cur);
    setFrom(f);
    setTo(endFor(f, p, nextMonths));
    setAmount(priceFor(p, nextMonths));
  };
  useEffect(() => {
    if (state.ok && onSaved) onSaved(state.message ?? "");
  }, [state, onSaved]);

  const continues = current?.plan === plan && !!current?.active_until && current.active_until >= today && from <= addDays(current.active_until, 1);
  const switching = !!current && current.plan !== plan;

  return (
    <form action={action} className="space-y-4">
      {sites && (
        <div>
          <label className="label" htmlFor="site_id">사이트</label>
          <select
            id="site_id"
            name="site_id"
            required
            value={chosen}
            onChange={(e) => {
              setChosen(e.target.value);
              refill(plan, months, sites.find((x) => x.id === e.target.value) ?? null);
            }}
            className="input"
          >
            <option value="" disabled>결제한 사이트를 선택하세요</option>
            {sites.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
      )}

      <fieldset>
        <legend className="label">요금제</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {plans.map((p) => (
            <label key={p.code} className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-xs ${plan === p.code ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-slate-300 hover:bg-slate-50"}`}>
              <span className="flex items-center gap-1.5 text-sm font-bold">
                <input
                  type="radio"
                  name="plan"
                  value={p.code}
                  checked={plan === p.code}
                  onChange={() => {
                    setPlan(p.code);
                    refill(p.code, months, current);
                  }}
                />
                {p.name}
              </span>
              <span className="text-slate-600">{p.trial_days ? `무료 · ${p.trial_days}일` : p.monthly_price === null ? "협의 금액" : `월 ${p.monthly_price.toLocaleString()}원`}</span>
              <span className="text-slate-500">{p.ai_token_limit === null ? "한도 직접 입력" : `AI ${limitText("ai_token_limit", p.ai_token_limit)}`}</span>
              {p.newsletter_limit !== null && <span className="text-slate-500">발송 {p.newsletter_limit.toLocaleString()}통</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="period_from">이용 시작일</label>
          <input
            id="period_from"
            name="period_from"
            type="date"
            required
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              if (e.target.value) setTo(endFor(e.target.value, def, months));
            }}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="months">기간</label>
          {def?.trial_days ? (
            <p className="input flex items-center bg-slate-50 text-slate-500">{def.trial_days}일 (고정)</p>
          ) : (
            <select
              id="months"
              value={months}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMonths(m);
                setTo(endFor(from, def, m));
                setAmount(priceFor(def, m));
              }}
              className="input"
            >
              {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{m}개월</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="label" htmlFor="period_to">이용 종료일</label>
          <input id="period_to" name="period_to" type="date" required value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="amount">결제 금액 (원)</label>
          <input id="amount" name="amount" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="협의 금액" className="input" />
          {def?.monthly_price && !def.trial_days ? (
            <p className="mt-1 text-xs text-slate-500">월 {def.monthly_price.toLocaleString()}원 × {months}개월. 할인하면 고쳐주세요.</p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="paid_on">결제일</label>
          <input id="paid_on" name="paid_on" type="date" required defaultValue={today} className="input" />
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
        <div className="sm:col-span-2">
          <label className="label" htmlFor="memo">메모</label>
          <input id="memo" name="memo" maxLength={1000} className="input" placeholder="예: 연간 계약, 세금계산서 발행" />
        </div>
      </div>

      {plan === "custom" && (
        <div className="space-y-2 rounded-lg border border-dashed border-slate-400 p-3">
          <p className="text-sm font-semibold">CUSTOM 한도 <span className="font-normal text-slate-500">(비우면 무제한)</span></p>
          <div className="grid gap-2 sm:grid-cols-5">
            {LIMIT_COLUMNS.map((col) => (
              <div key={col}>
                <label className="label text-xs" htmlFor={`custom_${col}`}>{LIMIT_LABEL[col][0]} ({col === "storage_mb_limit" ? "GB" : LIMIT_LABEL[col][1]})</label>
                <input id={`custom_${col}`} name={`custom_${col}`} inputMode="decimal" className="input py-1.5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {current && def && (
        <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold">저장하면 이렇게 바뀌어요</p>
          <p>
            요금제 {planName(current.plan)} → <b>{def.name}</b> · 이용 기간{" "}
            {continues ? <>~{current.active_until} → <b>~{to}</b> (연장)</> : <><b>{from <= today ? from : today} ~ {to}</b>{current.active_until ? ` (기존 ~${current.active_until}은 무시)` : ""}</>}
          </p>
          {def.code !== "custom" && (
            <p className="text-slate-500">
              한도: AI {limitText("ai_token_limit", def.ai_token_limit)} · 발송 {limitText("newsletter_limit", def.newsletter_limit)} · 구독자 {limitText("subscriber_limit", def.subscriber_limit)} · 용량 {def.storage_mb_limit === null ? "무제한" : formatMb(def.storage_mb_limit)} · 멤버 {limitText("member_limit", def.member_limit)}
              {switching ? " (개별 조정값은 비워져요)" : ""}
            </p>
          )}
          {switching && <p className="text-slate-500">저장하는 즉시 새 요금제가 적용돼요. 이번 달 사용량은 그대로 이어져요.</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "저장 중..." : "결제 등록하고 적용"}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

/** "결제 등록" button that opens the payment form in a modal. With `siteId` the site is picked already. */
export function PaymentModalButton({ sites, plans, today, siteId, label = "+ 결제 등록", small }: {
  sites: SiteOption[];
  plans: Plan[];
  today: string;
  siteId?: string;
  label?: string;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setNotice(""); }} className={small ? "btn-secondary px-3 py-1.5 text-xs" : "btn-primary"}>{label}</button>
      {notice && <span className="text-sm text-emerald-700">{notice}</span>}
      {open && (
        <Modal title="서비스 이용료 결제 등록" onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-slate-500">오프라인으로 받은 결제를 기록하면 선택한 요금제와 이용 기간이 사이트에 바로 적용돼요.</p>
          <PaymentForm
            key={siteId ?? "any"}
            sites={siteId ? sites.filter((x) => x.id === siteId) : sites}
            siteId={siteId}
            plans={plans}
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
