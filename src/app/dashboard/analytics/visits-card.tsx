import Link from "next/link";
import type { ReportResult } from "@/lib/analytics/report";
import { DailyBars, Delta, fmt, pct } from "./parts";

/** Last-7-days visit summary on the main dashboard. */
export function VisitsCard({ visits }: { visits: ReportResult }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">방문 통계 <span className="text-sm font-normal text-slate-500">최근 7일</span></h2>
        <Link href="/dashboard/analytics?range=7" className="text-sm text-indigo-600 hover:underline">자세히 보기</Link>
      </div>
      {!visits.ok ? (
        <p className="py-4 text-center text-sm text-slate-400">
          {visits.reason === "not_configured" ? "Google Analytics 연결 설정이 끝나면 방문 통계가 표시돼요." : "지금은 방문 통계를 불러오지 못했어요."}
        </p>
      ) : (() => {
        const { stats, leadsTotal, content } = visits.report;
        const top = content.find((c) => c.kind === "promo" || c.kind === "blog");
        return (
          <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">방문자</p>
                <p className="mt-1 text-xl font-bold">{fmt(stats.current.users)}</p>
                <p className="text-xs"><Delta now={stats.current.users} before={stats.previous.users} /></p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">페이지뷰</p>
                <p className="mt-1 text-xl font-bold">{fmt(stats.current.views)}</p>
                <p className="text-xs"><Delta now={stats.current.views} before={stats.previous.views} /></p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">리드 전환율</p>
                <p className="mt-1 text-xl font-bold">{pct(leadsTotal, stats.current.users)}</p>
                <p className="text-xs text-slate-600">리드 {fmt(leadsTotal)}건</p>
              </div>
            </div>
            <div>
              <DailyBars daily={stats.daily} height={72} compact />
              {top && (
                <p className="mt-2 truncate text-sm text-slate-600">
                  가장 많이 본 페이지: {top.href ? <Link href={top.href} className="text-indigo-600 hover:underline">{top.title}</Link> : top.title} · 조회 {fmt(top.views)}
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
