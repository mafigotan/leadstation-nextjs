import { requireSite } from "@/lib/supabase/server";
import Link from "next/link";
import { consentSummary, leadExtra, queryLeads } from "@/lib/leads";
import { deleteLead } from "./actions";

export const metadata = { title: "리드 관리 | LEADstation" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; marketing?: string }>;
}) {
  const { page: pageId, q, marketing } = await searchParams;
  const { supabase, site } = await requireSite();

  const [{ data: pages }, leads] = await Promise.all([
    supabase.from("pages").select("id, title").eq("site_id", site.id).order("created_at", { ascending: false }),
    queryLeads(supabase, { pageId, q, marketing }),
  ]);

  const exportParams = new URLSearchParams();
  if (pageId) exportParams.set("page", pageId);
  if (q) exportParams.set("q", q);
  if (marketing) exportParams.set("marketing", marketing);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">리드 관리</h1>
          <p className="mt-1 text-sm text-slate-500">프로모션으로 들어온 신청자 목록이에요.</p>
        </div>
        <a href={`/dashboard/leads/export?${exportParams}`} className="btn-secondary">CSV 내보내기</a>
      </div>

      <form className="card mb-4 flex flex-wrap gap-3 p-4">
        <select name="page" defaultValue={pageId ?? ""} className="input w-auto min-w-48">
          <option value="">전체 프로모션</option>
          {pages?.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <select name="marketing" defaultValue={marketing ?? ""} className="input w-auto" aria-label="마케팅 동의">
          <option value="">마케팅 동의: 전체</option>
          <option value="yes">마케팅 동의함</option>
          <option value="no">마케팅 동의 안 함</option>
        </select>
        <input name="q" defaultValue={q ?? ""} placeholder="이름, 이메일, 연락처, 주소 검색" className="input w-auto flex-1 min-w-48" />
        <button className="btn-primary">검색</button>
      </form>

      <p className="mb-2 text-sm text-slate-500">총 {leads.length}명{leads.length === 500 ? " (최근 500명까지 표시)" : ""}</p>

      {leads.length === 0 ? (
        <div className="card p-12 text-center text-slate-600">아직 들어온 리드가 없어요.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">신청일</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">연락처</th>
                <th className="px-4 py-3 font-medium">추가 정보</th>
                <th className="px-4 py-3 font-medium">프로모션</th>
                <th className="px-4 py-3 font-medium">약관 동의</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(l.created_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" })}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/dashboard/leads/${l.id}`} className="hover:underline">{l.name || "(이름 없음)"}</Link>
                    {l.message && <p className="mt-1 max-w-xs whitespace-pre-line text-xs font-normal text-slate-500">{l.message}</p>}
                  </td>
                  <td className="px-4 py-3">{l.email || "-"}</td>
                  <td className="px-4 py-3">{l.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {leadExtra(l) || (l.event ? "" : "-")}
                    {l.event && <span className="mt-1 block w-fit rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">🎮 {l.event}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.pages?.title ?? "-"}</td>
                  <td className="px-4 py-3">
                    <ConsentBadges l={l} />
                  </td>
                  <td className="space-y-1 px-4 py-3 text-right">
                    <Link href={`/dashboard/leads/${l.id}`} className="block text-xs text-indigo-600 hover:underline">상세</Link>
                    <form action={deleteLead.bind(null, l.id)}>
                      <button className="text-xs text-red-600 hover:underline">삭제</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConsentBadges({ l }: { l: Parameters<typeof consentSummary>[0] }) {
  const c = consentSummary(l);
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {c.has ? (
        <span className={`rounded px-1.5 py-0.5 ${c.requiredAgreed === c.required ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          필수 {c.requiredAgreed}/{c.required}
        </span>
      ) : (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">기록 없음</span>
      )}
      <span className={`rounded px-1.5 py-0.5 ${l.marketing_consent ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}>마케팅 {l.marketing_consent ? "✓" : "–"}</span>
      {c.outdated && <span className="rounded border border-slate-300 px-1.5 py-0.5 text-slate-600">이전 버전</span>}
    </div>
  );
}
