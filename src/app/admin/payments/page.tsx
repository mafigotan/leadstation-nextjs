import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { todayKst } from "@/lib/site";
import { METHOD_LABEL, Table, Th, fmtDate, won } from "../ui";
import { PaymentModalButton } from "../sites/[id]/forms";

type Row = {
  id: string; site_id: string; paid_on: string; amount: number; method: string; period_from: string | null; period_to: string | null;
  payer: string; memo: string; sites: { handle: string; name: string } | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; method?: string; q?: string }> }) {
  const sp = await searchParams;
  const today = todayKst();
  const from = DATE_RE.test(sp.from ?? "") ? sp.from! : `${today.slice(0, 4)}-01-01`;
  const to = DATE_RE.test(sp.to ?? "") ? sp.to! : today;
  const method = sp.method && METHOD_LABEL[sp.method] ? sp.method : "";
  const q = (sp.q ?? "").trim().toLowerCase();
  const { supabase } = await requireSuperAdmin();

  let query = supabase
    .from("site_payments")
    .select("id, site_id, paid_on, amount, method, period_from, period_to, payer, memo, sites(handle, name)")
    .gte("paid_on", from)
    .lte("paid_on", to)
    .order("paid_on", { ascending: false })
    .limit(1000);
  if (method) query = query.eq("method", method);
  const { data, error } = await query;
  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => !q || [r.sites?.handle, r.sites?.name, r.payer, r.memo].some((v) => v?.toLowerCase().includes(q)),
  );
  const { data: allSites } = await supabase.from("sites").select("id, handle, name, active_until").order("handle");
  const siteOptions = (allSites ?? []).map((s) => ({
    id: s.id,
    label: `${s.name ? `${s.name} (${s.handle})` : s.handle}${s.active_until ? ` · ~${s.active_until}` : ""}`,
  }));
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  // Monthly totals for the selected range.
  const months = new Map<string, number>();
  for (const r of rows) months.set(r.paid_on.slice(0, 7), (months.get(r.paid_on.slice(0, 7)) ?? 0) + Number(r.amount));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">결제 내역</h1>
            <PaymentModalButton sites={siteOptions} today={today} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(from)} ~ {fmtDate(to)} · {rows.length}건 · 합계 <span className="font-semibold text-slate-800">{won(total)}</span></p>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input type="date" name="from" defaultValue={from} className="input w-auto" />
          <span className="text-slate-400">~</span>
          <input type="date" name="to" defaultValue={to} className="input w-auto" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="사이트, 입금자, 메모" className="input w-44" />
          <select name="method" defaultValue={method} className="input w-auto">
            <option value="">모든 방법</option>
            {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn-primary">조회</button>
        </form>
      </div>
      {error && <p className="text-sm text-red-600">불러오지 못했어요: {error.message}</p>}
      {months.size > 1 && (
        <div className="flex flex-wrap gap-2">
          {[...months].map(([m, v]) => (
            <span key={m} className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-slate-200">{m} <span className="font-semibold">{won(v)}</span></span>
          ))}
        </div>
      )}
      <Table head={<><Th>결제일</Th><Th>사이트</Th><Th right>금액</Th><Th>방법</Th><Th>이용 기간</Th><Th>입금자</Th><Th>메모</Th></>}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap px-3 py-2">{r.paid_on}</td>
            <td className="px-3 py-2"><Link href={`/admin/sites/${r.site_id}`} className="text-indigo-600 hover:underline">{r.sites?.name || r.sites?.handle}</Link></td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{won(Number(r.amount))}</td>
            <td className="px-3 py-2">{METHOD_LABEL[r.method] ?? r.method}</td>
            <td className="whitespace-nowrap px-3 py-2">{r.period_from || r.period_to ? `${fmtDate(r.period_from)} ~ ${fmtDate(r.period_to)}` : "-"}</td>
            <td className="px-3 py-2">{r.payer || "-"}</td>
            <td className="px-3 py-2 text-slate-600">{r.memo || "-"}</td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">이 기간에 결제 내역이 없어요.</td></tr>}
      </Table>
    </div>
  );
}
