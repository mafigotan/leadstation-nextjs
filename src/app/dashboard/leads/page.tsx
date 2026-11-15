import { requireSite } from "@/lib/supabase/server";
import { leadExtra, queryLeads } from "@/lib/leads";
import { deleteLead } from "./actions";

export const metadata = { title: "리드 관리 | LEADstation" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageId, q } = await searchParams;
  const { supabase, site } = await requireSite();

  const [{ data: pages }, leads] = await Promise.all([
    supabase.from("pages").select("id, title").eq("site_id", site.id).order("created_at", { ascending: false }),
    queryLeads(supabase, { pageId, q }),
  ]);

  const exportParams = new URLSearchParams();
  if (pageId) exportParams.set("page", pageId);
  if (q) exportParams.set("q", q);

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
                <th className="px-4 py-3 font-medium">마케팅 동의</th>
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
                    {l.name || "-"}
                    {l.message && <p className="mt-1 max-w-xs whitespace-pre-line text-xs font-normal text-slate-500">{l.message}</p>}
                  </td>
                  <td className="px-4 py-3">{l.email || "-"}</td>
                  <td className="px-4 py-3">{l.phone ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {leadExtra(l) || (l.event ? "" : "-")}
                    {l.event && <span className="mt-1 block w-fit rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">🎮 {l.event}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.pages?.title ?? "-"}</td>
                  <td className="px-4 py-3">{l.marketing_consent ? "동의" : "-"}</td>
                  <td className="px-4 py-3 text-right">
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
