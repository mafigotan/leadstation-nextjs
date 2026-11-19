import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { daysLeft, rootDomain, siteUrl, todayKst, userUrl } from "@/lib/site";
import { METHOD_LABEL, SiteStatus, Table, Th, UserStatus, fmtDate, won } from "../../ui";
import { deletePayment } from "../../actions";
import { PaymentForm, SiteAdminForm, SitePlanForm } from "./forms";
import { LIMIT_COLUMNS, loadPlans, planName, type LimitColumn } from "@/lib/plans";

import { loadUsage } from "@/lib/usage";
import { LimitRequestTable } from "../../limit-requests";
import { HandleStatusBadge, PendingHandleRequest, SiteHandleForm, type HandleRequest } from "../../handle-requests";

type Site = {
  id: string; handle: string; name: string; status: string; active_from: string | null; active_until: string | null;
  service_started_on: string | null; created_at: string; plan: string | null;
} & Record<LimitColumn, number | null>;
type Member = { user_id: string; email: string; full_name: string; role: string; suspended_at: string | null };

export default async function AdminSite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSuperAdmin();
  const { data: site } = await supabase
    .from("sites")
    .select(`id, handle, name, status, active_from, active_until, service_started_on, created_at, plan, ${LIMIT_COLUMNS.join(", ")}`)
    .eq("id", id)
    .maybeSingle<Site>();
  if (!site) notFound();
  const [{ data: memo }, { data: members }, { data: payments }, { count: activityCount }, usage, { data: requests }, { data: handleReqs }, plans] = await Promise.all([
    supabase.rpc("admin_site_memo", { p_site: id }),
    supabase.rpc("admin_site_members", { p_site: id }),
    supabase.from("site_payments").select("id, plan, paid_on, amount, method, period_from, period_to, payer, memo").eq("site_id", id).order("paid_on", { ascending: false }),
    supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("site_id", id),
    loadUsage(supabase, id),
    supabase.from("limit_requests").select("id, kinds, message, status, created_at").eq("site_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("site_handle_requests").select("id, site_id, current_handle, new_handle, reason, status, admin_note, created_at, handled_at").eq("site_id", id).order("created_at", { ascending: false }).limit(10),
    loadPlans(supabase),
  ]);
  const overrides = Object.fromEntries(LIMIT_COLUMNS.map((c) => [c, site[c] === null ? null : Number(site[c])])) as Record<LimitColumn, number | null>;
  const left = daysLeft(site.active_until);
  const lastPay = payments?.[0];
  const handleRequests = (handleReqs ?? []) as HandleRequest[];
  const pendingHandle = handleRequests.find((r) => r.status === "pending");
  const total = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sites" className="text-sm text-slate-500 hover:underline">← 사이트 목록</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{site.name || site.handle}</h1>
          <SiteStatus site={site} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{planName(site.plan)}</span>
          {left !== null && left >= 0 && left <= 60 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${left <= 30 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>만료 D-{left}</span>
          )}
          <a href={userUrl(site.handle)} target="_blank" className="text-sm text-indigo-600 hover:underline">{userUrl(site.handle)}</a>
        </div>
        <p className="mt-1 text-sm text-slate-500">생성일 {fmtDate(site.created_at)} · 활동 기록 {(activityCount ?? 0).toLocaleString()}건</p>
      </div>

      <section className="card p-5">
        <div className="mb-3">
          <h2 className="font-bold">요금제와 한도</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {planName(site.plan)} · 이용 기간 {fmtDate(site.active_from)} ~ {fmtDate(site.active_until)}
            {lastPay ? ` · 마지막 결제 ${lastPay.paid_on} ${won(Number(lastPay.amount))}` : ""}
          </p>
        </div>
        <SitePlanForm key={`${site.plan}-${LIMIT_COLUMNS.map((c) => site[c]).join("-")}`} siteId={site.id} plan={site.plan} overrides={overrides} plans={plans} usage={usage} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">결제 등록 <span className="text-sm font-normal text-slate-500">오프라인 결제 · 요금제와 기간이 바로 적용돼요</span></h2>
          <PaymentForm siteId={site.id} site={{ id: site.id, label: site.handle, plan: site.plan, active_until: site.active_until }} plans={plans} today={todayKst()} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">사이트 상태와 이용 기간</h2>
          <SiteAdminForm site={site} memo={(memo as string | null) ?? ""} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold">
          사이트 주소
          {pendingHandle && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">변경 요청 1</span>}
        </h2>
        {pendingHandle && <PendingHandleRequest request={pendingHandle} />}
        <div className="card p-5">
          <SiteHandleForm siteId={site.id} handle={site.handle} rootDomain={rootDomain() ?? siteUrl().replace(/^https?:\/\//, "") + "/s"} />
        </div>
        {handleRequests.some((r) => r.status !== "pending") && (
          <Table head={<><Th>상태</Th><Th>요청 주소</Th><Th>요청 사유</Th><Th>답변</Th><Th>요청 시각</Th></>}>
            {handleRequests.filter((r) => r.status !== "pending").map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-2"><HandleStatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.current_handle} → {r.new_handle}</td>
                <td className="max-w-xs px-3 py-2 text-slate-600">{r.reason || "-"}</td>
                <td className="max-w-xs px-3 py-2 text-slate-500">{r.admin_note || "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {!!requests?.length && (
        <section className="space-y-2">
          <h2 className="font-bold">이용 한도 증설 요청</h2>
          <LimitRequestTable requests={requests} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">결제 내역 <span className="text-sm font-normal text-slate-500">합계 {won(total)}</span></h2>
        <Table head={<><Th>결제일</Th><Th>요금제</Th><Th right>금액</Th><Th>방법</Th><Th>이용 기간</Th><Th>입금자</Th><Th>메모</Th><Th /></>}>
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-3 py-2">{p.paid_on}</td>
              <td className="px-3 py-2">{p.plan ? planName(p.plan) : "-"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{won(Number(p.amount))}</td>
              <td className="px-3 py-2">{METHOD_LABEL[p.method] ?? p.method}</td>
              <td className="whitespace-nowrap px-3 py-2">{p.period_from || p.period_to ? `${fmtDate(p.period_from)} ~ ${fmtDate(p.period_to)}` : "-"}</td>
              <td className="px-3 py-2">{p.payer || "-"}</td>
              <td className="px-3 py-2 text-slate-600">{p.memo || "-"}</td>
              <td className="px-3 py-2 text-right">
                <form action={deletePayment.bind(null, p.id)}>
                  <button className="text-xs text-slate-400 hover:text-red-600">삭제</button>
                </form>
              </td>
            </tr>
          ))}
          {!payments?.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">결제 내역이 없어요.</td></tr>}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">멤버</h2>
        <Table head={<><Th>이름</Th><Th>이메일</Th><Th>권한</Th><Th>계정 상태</Th></>}>
          {((members ?? []) as Member[]).map((m) => (
            <tr key={m.user_id}>
              <td className="px-3 py-2"><Link href={`/admin/users/${m.user_id}`} className="font-medium text-indigo-600 hover:underline">{m.full_name || "(미입력)"}</Link></td>
              <td className="px-3 py-2 text-slate-600">{m.email}</td>
              <td className="px-3 py-2">{m.role === "admin" ? "관리자" : "사용자"}</td>
              <td className="px-3 py-2"><UserStatus suspended={!!m.suspended_at} /></td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
