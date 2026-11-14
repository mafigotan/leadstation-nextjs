import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { todayKst, userUrl } from "@/lib/site";
import { Pager, SiteStatus, Table, Th, fmtDate, won } from "../ui";

const SIZE = 30;

type Row = {
  id: string; handle: string; name: string; status: string; active_from: string | null; active_until: string | null;
  service_started_on: string | null; created_at: string; site_members: { count: number }[];
};

function addDays(d: string, n: number) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export default async function AdminSites({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().replace(/[%,()*]/g, " ") ?? "";
  const filter = sp.filter ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayKst();
  const { supabase } = await requireSuperAdmin();

  let query = supabase
    .from("sites")
    .select("id, handle, name, status, active_from, active_until, service_started_on, created_at, site_members(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * SIZE, page * SIZE - 1);
  if (q) query = query.or(`handle.ilike.%${q}%,name.ilike.%${q}%`);
  if (filter === "active") query = query.eq("status", "active").or(`active_until.is.null,active_until.gte.${today}`);
  if (filter === "inactive") query = query.eq("status", "inactive");
  if (filter === "expired") query = query.lt("active_until", today);
  if (filter === "expiring") query = query.eq("status", "active").gte("active_until", today).lte("active_until", addDays(today, 30));
  const { data, count, error } = await query;
  const rows = (data ?? []) as Row[];

  const ids = rows.map((r) => r.id);
  const { data: pays } = ids.length
    ? await supabase.from("site_payments").select("site_id, paid_on, amount").in("site_id", ids).order("paid_on", { ascending: false })
    : { data: [] };
  const lastPay = new Map<string, { paid_on: string; amount: number }>();
  for (const p of pays ?? []) if (!lastPay.has(p.site_id)) lastPay.set(p.site_id, p);

  const href = (p: number) => `/admin/sites?${new URLSearchParams({ q, filter, page: String(p) })}`;
  const filters: [string, string][] = [["all", "전체"], ["active", "활성"], ["expiring", "30일 안에 만료"], ["expired", "기간 만료"], ["inactive", "비활성"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">사이트 <span className="text-base font-normal text-slate-500">{(count ?? 0).toLocaleString()}개</span></h1>
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="사이트 주소 또는 이름" className="input w-60" />
          <select name="filter" defaultValue={filter} className="input w-auto">
            {filters.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn-primary">검색</button>
        </form>
      </div>
      {error && <p className="text-sm text-red-600">불러오지 못했어요: {error.message}</p>}
      <Table head={<><Th>사이트</Th><Th>상태</Th><Th>서비스 개시일</Th><Th>이용 기간</Th><Th right>멤버</Th><Th>최근 결제</Th><Th>생성일</Th></>}>
        {rows.map((r) => {
          const lp = lastPay.get(r.id);
          return (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link href={`/admin/sites/${r.id}`} className="font-medium text-indigo-600 hover:underline">{r.name || r.handle}</Link>
                <a href={userUrl(r.handle)} target="_blank" className="block text-xs text-slate-400 hover:underline">{r.handle}</a>
              </td>
              <td className="px-3 py-2"><SiteStatus site={r} /></td>
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.service_started_on)}</td>
              <td className="whitespace-nowrap px-3 py-2">{r.active_from || r.active_until ? `${fmtDate(r.active_from)} ~ ${fmtDate(r.active_until)}` : "제한 없음"}</td>
              <td className="px-3 py-2 text-right">{r.site_members?.[0]?.count ?? 0}</td>
              <td className="whitespace-nowrap px-3 py-2">{lp ? `${lp.paid_on} · ${won(lp.amount)}` : "-"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(r.created_at)}</td>
            </tr>
          );
        })}
        {!rows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">사이트가 없어요.</td></tr>}
      </Table>
      <Pager page={page} total={count ?? 0} size={SIZE} href={href} />
    </div>
  );
}
