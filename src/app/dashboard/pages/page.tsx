import Link from "next/link";
import { requireSite } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";

export const metadata = { title: "프로모션 | LEADstation" };

export default async function PagesList() {
  const { supabase, site } = await requireSite();
  const { data: pages } = await supabase
    .from("pages")
    .select("id, promo_no, title, slug, status, created_at, leads(count)")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">프로모션</h1>
          <p className="mt-1 text-sm text-slate-500">AI로 만든 프로모션을 공개하고 신청자를 모아보세요.</p>
        </div>
        <Link href="/dashboard/pages/new" className="btn-primary">+ 새 프로모션</Link>
      </div>

      {!pages?.length ? (
        <div className="card p-12 text-center">
          <p className="text-slate-600">아직 만든 프로모션이 없어요.</p>
          <Link href="/dashboard/pages/new" className="btn-primary mt-4">첫 프로모션 만들기</Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          <div className="flex items-center gap-4 bg-slate-50 px-5 py-2 text-xs font-medium text-slate-500">
            <span className="w-16 shrink-0">프로모션ID</span>
            <span className="flex-1">제목</span>
            <span className="shrink-0">리드 · 상태</span>
          </div>
          {pages.map((p) => {
            const leadCount = (p.leads as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={p.id}
                href={`/dashboard/pages/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50"
              >
                <span className="w-16 shrink-0 font-mono text-sm text-slate-600">{p.promo_no ?? "-"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")} · {userUrl(site.handle, p.slug).replace(/^https?:\/\//, "")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-slate-600">리드 {leadCount}명</span>
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "published" ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">공개</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">초안</span>
  );
}
