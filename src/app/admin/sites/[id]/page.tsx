import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { todayKst, userUrl } from "@/lib/site";
import { METHOD_LABEL, SiteStatus, Table, Th, UserStatus, fmtDate, won } from "../../ui";
import { deletePayment } from "../../actions";
import { PaymentForm, SiteAdminForm } from "./forms";
import { loadUsage } from "@/lib/usage";
import { LimitRequestTable } from "../../limit-requests";

type Site = {
  id: string; handle: string; name: string; status: string; active_from: string | null; active_until: string | null;
  service_started_on: string | null; created_at: string; newsletter_limit: number | null; text_token_limit: number | null; image_token_limit: number | null;
};
type Member = { user_id: string; email: string; full_name: string; role: string; suspended_at: string | null };

export default async function AdminSite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSuperAdmin();
  const { data: site } = await supabase
    .from("sites")
    .select("id, handle, name, status, active_from, active_until, service_started_on, created_at, newsletter_limit, text_token_limit, image_token_limit")
    .eq("id", id)
    .maybeSingle<Site>();
  if (!site) notFound();
  const [{ data: memo }, { data: members }, { data: payments }, { count: activityCount }, usage, { data: requests }] = await Promise.all([
    supabase.rpc("admin_site_memo", { p_site: id }),
    supabase.rpc("admin_site_members", { p_site: id }),
    supabase.from("site_payments").select("id, paid_on, amount, method, period_from, period_to, payer, memo").eq("site_id", id).order("paid_on", { ascending: false }),
    supabase.from("activity_logs").select("id", { count: "exact", head: true }).eq("site_id", id),
    loadUsage(supabase, id),
    supabase.from("limit_requests").select("id, kinds, message, status, created_at").eq("site_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const total = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/sites" className="text-sm text-slate-500 hover:underline">← 사이트 목록</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{site.name || site.handle}</h1>
          <SiteStatus site={site} />
          <a href={userUrl(site.handle)} target="_blank" className="text-sm text-indigo-600 hover:underline">{userUrl(site.handle)}</a>
        </div>
        <p className="mt-1 text-sm text-slate-500">생성일 {fmtDate(site.created_at)} · 활동 기록 {(activityCount ?? 0).toLocaleString()}건</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">사이트 상태와 이용 기간</h2>
          <SiteAdminForm site={site} memo={(memo as string | null) ?? ""} usage={usage} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">결제 입력 <span className="text-sm font-normal text-slate-500">오프라인 결제</span></h2>
          <PaymentForm siteId={site.id} today={todayKst()} />
        </section>
      </div>

      {!!requests?.length && (
        <section className="space-y-2">
          <h2 className="font-bold">이용 한도 증설 요청</h2>
          <LimitRequestTable requests={requests} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">결제 내역 <span className="text-sm font-normal text-slate-500">합계 {won(total)}</span></h2>
        <Table head={<><Th>결제일</Th><Th right>금액</Th><Th>방법</Th><Th>이용 기간</Th><Th>입금자</Th><Th>메모</Th><Th /></>}>
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-3 py-2">{p.paid_on}</td>
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
          {!payments?.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">결제 내역이 없어요.</td></tr>}
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
