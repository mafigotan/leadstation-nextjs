import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { todayKst } from "@/lib/site";
import { Table, Th, fmtDate, fmtDateTime, won } from "./ui";
import { LimitRequestTable, type LimitRequest } from "./limit-requests";
import { PendingHandleRequest, type HandleRequest } from "./handle-requests";
import { PaymentModalButton } from "./sites/[id]/forms";
import { loadPlans, planName } from "@/lib/plans";
import { daysLeft } from "@/lib/site";


export const metadata = { title: "대시보드 | 슈퍼 관리자" };

const REQ_STATUS: Record<string, [string, string]> = {
  pending: ["대기", "bg-amber-50 text-amber-700"],
  done: ["완료", "bg-emerald-50 text-emerald-700"],
  rejected: ["반려", "bg-slate-100 text-slate-600"],
};
type TemplateReq = { id: string; site_id: string; game_type: string; description: string; status: string; admin_note: string; created_at: string; sites: { handle: string; name: string } | null };

export default async function AdminHome() {
  const { supabase } = await requireSuperAdmin();
  const today = todayKst();
  const month = today.slice(0, 7);
  const twoMonths = (() => {
    const t = new Date(today + "T00:00:00Z");
    t.setUTCMonth(t.getUTCMonth() + 2);
    return t.toISOString().slice(0, 10);
  })();
  const [users, suspended, sites, inactive, expired, expiring, pays, requests, tplReqs, tplPending, handleReqs, planRows, plans] = await Promise.all([
    supabase.rpc("admin_user_list", { p_query: "", p_status: "all", p_limit: 1, p_offset: 0 }),
    supabase.rpc("admin_user_list", { p_query: "", p_status: "suspended", p_limit: 1, p_offset: 0 }),
    supabase.from("sites").select("id", { count: "exact", head: true }),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("status", "inactive"),
    supabase.from("sites").select("id", { count: "exact", head: true }).lt("active_until", today),
    supabase.from("sites").select("id, handle, name, plan, active_until").eq("status", "active").gte("active_until", today).lte("active_until", twoMonths).order("active_until"),
    supabase.from("site_payments").select("amount").gte("paid_on", `${month}-01`).lte("paid_on", today),
    supabase.from("limit_requests").select("id, site_id, kinds, message, status, created_at, sites(handle, name)").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("event_template_requests").select("id, site_id, game_type, description, status, admin_note, created_at, sites(handle, name)").order("created_at", { ascending: false }).limit(10),
    supabase.from("event_template_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("site_handle_requests").select("id, site_id, current_handle, new_handle, reason, status, admin_note, created_at, handled_at, sites(handle, name)").eq("status", "pending").order("created_at"),
    supabase.from("sites").select("plan"),
    loadPlans(supabase),
  ]);
  type Expiring = { id: string; handle: string; name: string; plan: string | null; active_until: string };
  const expiringSites = (expiring.data ?? []) as Expiring[];
  const expIds = expiringSites.map((x) => x.id);
  const [{ data: expPays }, contacts] = await Promise.all([
    expIds.length
      ? supabase.from("site_payments").select("site_id, paid_on, amount").in("site_id", expIds).order("paid_on", { ascending: false })
      : Promise.resolve({ data: [] as { site_id: string; paid_on: string; amount: number }[] }),
    Promise.all(expIds.map(async (sid) => {
      const { data } = await supabase.rpc("admin_site_members", { p_site: sid });
      const admin = ((data ?? []) as { email: string; full_name: string; role: string }[]).find((m) => m.role === "admin");
      return [sid, admin ? `${admin.full_name || ""} ${admin.email}`.trim() : "-"] as const;
    })),
  ]);
  const lastPay = new Map<string, { paid_on: string; amount: number }>();
  for (const p of expPays ?? []) if (!lastPay.has(p.site_id)) lastPay.set(p.site_id, p);
  const contactOf = new Map(contacts);
  const planCount = new Map<string, number>();
  for (const r of (planRows.data ?? []) as { plan: string | null }[]) planCount.set(r.plan ?? "", (planCount.get(r.plan ?? "") ?? 0) + 1);
  const siteOptions = expiringSites.map((x) => ({ id: x.id, plan: x.plan, active_until: x.active_until, label: `${x.name ? `${x.name} (${x.handle})` : x.handle} · ${planName(x.plan)} · ~${x.active_until}` }));
  const handleRequests = (handleReqs.data ?? []) as unknown as HandleRequest[];
  const templateRequests = (tplReqs.data ?? []) as unknown as TemplateReq[];
  const total = (r: { data: unknown }) => ((r.data as { total: number }[] | null)?.[0]?.total ?? 0);
  const monthTotal = (pays.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const stats: [string, string, string][] = [
    ["전체 유저", `${total(users)}명`, "/admin/users"],
    ["정지된 유저", `${total(suspended)}명`, "/admin/users?status=suspended"],
    ["전체 사이트", `${sites.count ?? 0}개`, "/admin/sites"],
    ["비활성 사이트", `${inactive.count ?? 0}개`, "/admin/sites?filter=inactive"],
    ["2개월 안에 만료", `${expiringSites.length}개`, "/admin/sites?filter=expiring"],
    ["기간 만료 사이트", `${expired.count ?? 0}개`, "/admin/sites?filter=expired"],
    ["이번 달 결제", won(monthTotal), "/admin/payments"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map(([k, v, href]) => (
          <Link key={k} href={href} className="card p-5 transition hover:shadow-md">
            <p className="text-sm text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-bold">{v}</p>
          </Link>
        ))}
      </div>
      <div className="card flex flex-wrap gap-x-6 gap-y-1 p-4 text-sm">
        <span className="font-semibold">요금제별 사이트</span>
        {plans.map((p) => <span key={p.code}>{p.name} {planCount.get(p.code) ?? 0}</span>)}
        <span className="text-slate-500">미지정 {planCount.get("") ?? 0}</span>
      </div>
      {!!handleRequests.length && (
        <section className="space-y-2">
          <h2 className="font-bold">사이트 주소 변경 요청 <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{handleRequests.length}</span></h2>
          <p className="text-sm text-slate-500">변경하면 요청한 유저의 대시보드에 알림이 가요.</p>
          {handleRequests.map((r) => <PendingHandleRequest key={r.id} request={r} showSite />)}
        </section>
      )}
      {!!requests.data?.length && (
        <section className="space-y-2">
          <h2 className="font-bold">처리할 이용 한도 증설 요청 <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{requests.data.length}</span></h2>
          <p className="text-sm text-slate-500">사이트 화면에서 한도를 올린 뒤 처리 완료를 눌러주세요.</p>
          <LimitRequestTable requests={requests.data as unknown as LimitRequest[]} showSite />
        </section>
      )}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">
            이벤트 템플릿 제작 요청
            {!!tplPending.count && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">대기 {tplPending.count}</span>}
          </h2>
          <Link href="/admin/event-templates" className="text-sm text-indigo-600 hover:underline">요청 처리하기 →</Link>
        </div>
        <Table head={<><Th>상태</Th><Th>사이트</Th><Th>요청 내용</Th><Th>답변</Th><Th>요청 시각</Th></>}>
          {templateRequests.map((r) => {
            const [label, cls] = REQ_STATUS[r.status] ?? REQ_STATUS.pending;
            return (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span></td>
                <td className="px-3 py-2"><Link href={`/admin/sites/${r.site_id}`} className="text-indigo-600 hover:underline">{r.sites?.name || r.sites?.handle}</Link></td>
                <td className="max-w-md px-3 py-2">
                  {r.game_type && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.game_type}</span>}
                  <span className="line-clamp-2 text-slate-700">{r.description}</span>
                </td>
                <td className="max-w-xs px-3 py-2 text-slate-500">{r.admin_note || "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDateTime(r.created_at)}</td>
              </tr>
            );
          })}
          {!templateRequests.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">아직 요청이 없어요.</td></tr>}
        </Table>
      </section>
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">
            2개월 안에 이용 기간이 끝나는 사이트
            {!!expiringSites.length && <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{expiringSites.length}</span>}
          </h2>
          <p className="text-sm text-slate-500">종료일이 가까운 순 · 연장 결제를 등록하면 목록에서 빠져요</p>
        </div>
        <Table head={<><Th>사이트</Th><Th>요금제</Th><Th>종료일</Th><Th>남은 기간</Th><Th>마지막 결제</Th><Th>관리자</Th><Th /></>}>
          {expiringSites.map((x) => {
            const d = daysLeft(x.active_until) ?? 0;
            const pay = lastPay.get(x.id);
            return (
              <tr key={x.id}>
                <td className="px-3 py-2"><Link href={`/admin/sites/${x.id}`} className="text-indigo-600 hover:underline">{x.name || x.handle}</Link></td>
                <td className="px-3 py-2">{planName(x.plan)}</td>
                <td className="whitespace-nowrap px-3 py-2">{fmtDate(x.active_until)}</td>
                <td className="px-3 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${d <= 30 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{d === 0 ? "오늘 종료" : `D-${d}`}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{pay ? `${pay.paid_on} · ${won(Number(pay.amount))}` : x.plan === "free" ? "없음 (무료 체험)" : "없음"}</td>
                <td className="px-3 py-2 text-slate-600">{contactOf.get(x.id)}</td>
                <td className="px-3 py-2 text-right"><PaymentModalButton sites={siteOptions} plans={plans} today={today} siteId={x.id} label="결제 등록" small /></td>
              </tr>
            );
          })}
          {!expiringSites.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">2개월 안에 끝나는 사이트가 없어요.</td></tr>}
        </Table>
        <p className="text-xs text-slate-500">D-30 이내는 빨강, 31~60일은 노랑으로 표시해요.</p>
      </section>
    </div>
  );
}
