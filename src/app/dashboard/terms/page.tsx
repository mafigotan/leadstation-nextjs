import Link from "next/link";
import { requireSite } from "@/lib/supabase/server";
import { TERM_KINDS, TERM_KIND_LABEL, type TermKind } from "@/lib/terms";
import { consentCounts, linkedPages } from "./linked";
import { createTerm } from "./actions";

export const metadata = { title: "약관 관리 | LEADstation" };

type Row = {
  id: string;
  title: string;
  kind: TermKind;
  is_default: boolean;
  current_version_id: string | null;
  archived_at: string | null;
  term_versions: { id: string; version: number; published_at: string | null }[];
};

const date = (s: string) => new Date(s).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ kind?: string; archived?: string }> }) {
  const { kind, archived } = await searchParams;
  const { supabase, site } = await requireSite();
  let query = supabase
    .from("terms")
    .select("id, title, kind, is_default, current_version_id, archived_at, term_versions:term_versions!term_versions_term_id_fkey(id, version, published_at)")
    .eq("site_id", site.id)
    .order("created_at");
  if (kind && TERM_KINDS.some((k) => k.key === kind)) query = query.eq("kind", kind);
  if (archived !== "1") query = query.is("archived_at", null);
  const { data } = await query.returns<Row[]>();
  const terms = data ?? [];
  const [links, counts] = await Promise.all([
    linkedPages(supabase, site.id),
    consentCounts(supabase, new Map(terms.map((t) => [t.id, t.term_versions.filter((v) => v.published_at).map((v) => v.id)]))),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">약관 관리</h1>
          <p className="mt-1 text-sm text-slate-500">신청 폼에 넣을 약관을 만들고 버전별로 관리해요. 프로모션마다 다른 약관과 버전을 연결할 수 있어요.</p>
        </div>
        <form action={createTerm} className="flex flex-wrap gap-2">
          <select name="kind" defaultValue="privacy" className="input w-auto" aria-label="새 약관 유형">
            {TERM_KINDS.map((k) => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </select>
          <input name="title" placeholder="새 약관 이름" className="input w-auto min-w-48" maxLength={200} />
          <button className="btn-primary">+ 새 약관</button>
        </form>
      </div>

      <form className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <select name="kind" defaultValue={kind ?? ""} className="input w-auto min-w-40" aria-label="유형">
          <option value="">전체 유형</option>
          {TERM_KINDS.map((k) => (
            <option key={k.key} value={k.key}>{k.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} /> 보관된 약관도 보기
        </label>
        <button className="btn-secondary">보기</button>
      </form>

      {terms.length === 0 ? (
        <div className="card p-12 text-center text-slate-600">약관이 없어요. 위에서 새 약관을 만들어 보세요.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">약관 이름</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">현재 버전</th>
                <th className="px-4 py-3 font-medium">연결된 프로모션</th>
                <th className="px-4 py-3 font-medium">동의 기록</th>
                <th className="px-4 py-3 font-medium">최근 발행</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terms.map((t) => {
                const current = t.term_versions.find((v) => v.id === t.current_version_id);
                const draft = t.term_versions.find((v) => !v.published_at);
                const linked = links.get(t.id) ?? [];
                return (
                  <tr key={t.id} className={t.archived_at ? "text-slate-500" : ""}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/terms/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                      {t.is_default && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">기본</span>}
                      {t.archived_at && <span className="ml-2 rounded border border-slate-300 px-1.5 py-0.5 text-xs">보관됨</span>}
                    </td>
                    <td className="px-4 py-3">{TERM_KIND_LABEL[t.kind]}</td>
                    <td className="px-4 py-3">
                      {current ? `v${current.version}` : <span className="text-slate-400">발행 전</span>}
                      {draft && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">작성 중 v{draft.version}</span>}
                    </td>
                    <td className="px-4 py-3">{linked.length}개</td>
                    <td className="px-4 py-3">{(counts.get(t.id) ?? 0).toLocaleString()}건</td>
                    <td className="px-4 py-3 text-slate-500">{current?.published_at ? date(current.published_at) : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/terms/${t.id}`} className="text-xs text-indigo-600 hover:underline">{t.archived_at ? "보기" : "편집"}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">동의 기록이 있는 약관은 삭제할 수 없고 보관만 돼요. 보관해도 리드 상세에서 동의 당시 전문을 계속 볼 수 있어요.</p>
    </div>
  );
}
