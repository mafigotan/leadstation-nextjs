import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { todayKst } from "@/lib/site";
import { Table, Th, fmtDate, won } from "./ui";
import { LimitRequestTable, type LimitRequest } from "./limit-requests";

function addDays(d: string, n: number) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export default async function AdminHome() {
  const { supabase } = await requireSuperAdmin();
  const today = todayKst();
  const month = today.slice(0, 7);
  const [users, suspended, sites, inactive, expired, expiring, pays, requests] = await Promise.all([
    supabase.rpc("admin_user_list", { p_query: "", p_status: "all", p_limit: 1, p_offset: 0 }),
    supabase.rpc("admin_user_list", { p_query: "", p_status: "suspended", p_limit: 1, p_offset: 0 }),
    supabase.from("sites").select("id", { count: "exact", head: true }),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("status", "inactive"),
    supabase.from("sites").select("id", { count: "exact", head: true }).lt("active_until", today),
    supabase.from("sites").select("id, handle, name, active_until").eq("status", "active").gte("active_until", today).lte("active_until", addDays(today, 30)).order("active_until"),
    supabase.from("site_payments").select("amount").gte("paid_on", `${month}-01`).lte("paid_on", today),
    supabase.from("limit_requests").select("id, site_id, kinds, message, status, created_at, sites(handle, name)").eq("status", "pending").order("created_at", { ascending: false }),
  ]);
  const total = (r: { data: unknown }) => ((r.data as { total: number }[] | null)?.[0]?.total ?? 0);
  const monthTotal = (pays.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const stats: [string, string, string][] = [
    ["전체 유저", `${total(users)}명`, "/admin/users"],
    ["정지된 유저", `${total(suspended)}명`, "/admin/users?status=suspended"],
    ["전체 사이트", `${sites.count ?? 0}개`, "/admin/sites"],
    ["비활성 사이트", `${inactive.count ?? 0}개`, "/admin/sites?filter=inactive"],
    ["기간 만료 사이트", `${expired.count ?? 0}개`, "/admin/sites?filter=expired"],
    ["이번 달 결제", won(monthTotal), "/admin/payments"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">요약</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {stats.map(([k, v, href]) => (
          <Link key={k} href={href} className="card p-5 transition hover:shadow-md">
            <p className="text-sm text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-bold">{v}</p>
          </Link>
        ))}
      </div>
      {!!requests.data?.length && (
        <section className="space-y-2">
          <h2 className="font-bold">처리할 이용 한도 증설 요청 <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{requests.data.length}</span></h2>
          <p className="text-sm text-slate-500">사이트 화면에서 한도를 올린 뒤 처리 완료를 눌러주세요.</p>
          <LimitRequestTable requests={requests.data as unknown as LimitRequest[]} showSite />
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-bold">30일 안에 이용 기간이 끝나는 사이트</h2>
        <Table head={<><Th>사이트</Th><Th>종료일</Th></>}>
          {(expiring.data ?? []).map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2"><Link href={`/admin/sites/${s.id}`} className="text-indigo-600 hover:underline">{s.name || s.handle}</Link></td>
              <td className="px-3 py-2">{fmtDate(s.active_until)}</td>
            </tr>
          ))}
          {!expiring.data?.length && <tr><td colSpan={2} className="px-3 py-6 text-center text-slate-400">곧 끝나는 사이트가 없어요.</td></tr>}
        </Table>
      </section>
    </div>
  );
}
