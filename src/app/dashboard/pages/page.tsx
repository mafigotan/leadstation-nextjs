import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";

export const metadata = { title: "프로모션 페이지 | LEADstation" };

export default async function PagesList() {
  const { supabase, profile } = await requireProfile();
  const { data: pages } = await supabase
    .from("pages")
    .select("id, title, slug, status, created_at, leads(count)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">프로모션 페이지</h1>
          <p className="mt-1 text-sm text-slate-500">AI로 만든 페이지를 공개하고 신청자를 모아보세요.</p>
        </div>
        <Link href="/dashboard/pages/new" className="btn-primary">+ 새 페이지</Link>
      </div>

      {!pages?.length ? (
        <div className="card p-12 text-center">
          <p className="text-slate-600">아직 만든 페이지가 없어요.</p>
          <Link href="/dashboard/pages/new" className="btn-primary mt-4">첫 페이지 만들기</Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {pages.map((p) => {
            const leadCount = (p.leads as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={p.id}
                href={`/dashboard/pages/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")} · {userUrl(profile.handle, p.slug).replace(/^https?:\/\//, "")}
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
