import Link from "next/link";
import { requireSite } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";
import { RANGES, getRealtimeUsers, type RangeDays } from "@/lib/analytics/ga";
import { buildSiteReport, KIND_LABEL, type ContentKind } from "@/lib/analytics/report";
import { DailyBars, Delta, Kpi, NotConfigured, duration, fmt, pct } from "./parts";

export const metadata = { title: "방문 통계 | LEADstation" };

const KINDS: { key: "all" | ContentKind; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "promo", label: "프로모션" },
  { key: "blog", label: "블로그" },
  { key: "landing", label: "랜딩" },
];

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "방금" : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`;
}

function Bars({ items }: { items: { name: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.name}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.name}</span>
            <span className="shrink-0 text-slate-600">{fmt(i.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; kind?: string }> }) {
  const sp = await searchParams;
  const days = (RANGES.find((r) => String(r) === sp.range) ?? 28) as RangeDays;
  const kind = (KINDS.find((k) => k.key === sp.kind)?.key ?? "all") as "all" | ContentKind;
  const { supabase, site } = await requireSite();
  const [res, live] = await Promise.all([buildSiteReport(supabase, site, days), getRealtimeUsers(site.handle)]);
  const address = userUrl(site.handle).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const q = (r: number, k: string) => `/dashboard/analytics?range=${r}${k !== "all" ? `&kind=${k}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">방문 통계</h1>
          <p className="mt-1 text-sm text-slate-500">
            {address} · 랜딩, 블로그, 프로모션 페이지 방문 기준
            {res.ok && ` · 업데이트 ${ago(res.report.stats.fetchedAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700" title="최근 30분 기준">
              <span className="size-2 rounded-full bg-emerald-500" />지금 방문 중 {fmt(live)}명
            </span>
          )}
          <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
            {RANGES.map((r) => (
              <Link key={r} href={q(r, kind)} className={`px-3.5 py-2 ${r === days ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {r}일
              </Link>
            ))}
          </div>
        </div>
      </div>

      {!res.ok ? (
        res.reason === "not_configured" ? <NotConfigured /> : (
          <div className="card p-8 text-center">
            <p className="font-semibold">통계를 불러오지 못했어요</p>
            <p className="mt-2 text-sm text-slate-500">잠시 후 다시 시도해 주세요.</p>
          </div>
        )
      ) : (() => {
        const { stats, leadsTotal, leadsPrevious, leadsDaily, content } = res.report;
        const { current: c, previous: p } = stats;
        const rows = content.filter((r) => r.kind !== "list" && (kind === "all" || r.kind === kind)).slice(0, 30);
        const deviceTotal = stats.devices.reduce((s, d) => s + d.value, 0);
        const regionTotal = stats.regions.reduce((s, d) => s + d.value, 0);
        return (
          <>
            <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <Kpi label="방문자" value={fmt(c.users)} sub={<Delta now={c.users} before={p.users} />} />
              <Kpi label="세션" value={fmt(c.sessions)} sub={<Delta now={c.sessions} before={p.sessions} />} />
              <Kpi label="페이지뷰" value={fmt(c.views)} sub={<Delta now={c.views} before={p.views} />} />
              <Kpi label="평균 참여시간" value={c.users ? duration(c.engagementSec / c.users) : "-"}
                sub={<Delta now={c.users ? c.engagementSec / c.users : 0} before={p.users ? p.engagementSec / p.users : 0} />} />
              <Kpi label="리드 전환율" value={pct(leadsTotal, c.users)}
                sub={<span className="text-slate-600">리드 {fmt(leadsTotal)}건 (지난 기간 {fmt(leadsPrevious)}건)</span>} />
            </section>

            <section className="card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">일별 추이</h2>
                <div className="flex gap-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-indigo-500" />방문자</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-orange-500" />리드</span>
                </div>
              </div>
              <DailyBars daily={stats.daily} leads={leadsDaily} />
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="card p-5">
                <h2 className="mb-4 font-bold">유입 경로 <span className="text-sm font-normal text-slate-500">세션 기준</span></h2>
                {stats.sources.length ? <Bars items={stats.sources} /> : <p className="py-4 text-center text-sm text-slate-400">아직 데이터가 없어요.</p>}
              </div>
              <div className="card space-y-6 p-5">
                <div>
                  <h2 className="mb-3 font-bold">기기</h2>
                  {deviceTotal ? (
                    <>
                      <div className="flex h-7 overflow-hidden rounded-md text-xs text-white">
                        {stats.devices.map((d, i) => (
                          <div key={d.name} className={`flex items-center overflow-hidden whitespace-nowrap px-2 ${["bg-indigo-900", "bg-indigo-500", "bg-indigo-300", "bg-slate-400"][i] ?? "bg-slate-400"}`}
                            style={{ width: `${(d.value / deviceTotal) * 100}%` }} title={`${d.name} ${pct(d.value, deviceTotal, 0)}`}>
                            {d.value / deviceTotal > 0.15 ? `${d.name} ${pct(d.value, deviceTotal, 0)}` : ""}
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{stats.devices.map((d) => `${d.name} ${pct(d.value, deviceTotal, 0)}`).join(" · ")}</p>
                    </>
                  ) : <p className="text-sm text-slate-400">아직 데이터가 없어요.</p>}
                </div>
                <div>
                  <h2 className="mb-3 font-bold">지역</h2>
                  {regionTotal ? (
                    <ul className="space-y-2 text-sm">
                      {stats.regions.map((r) => (
                        <li key={r.name} className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span>{r.name}</span><span className="text-slate-600">{pct(r.value, c.users || regionTotal, 0)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-400">아직 데이터가 없어요.</p>}
                </div>
              </div>
            </section>

            <section className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">콘텐츠별 성과</h2>
                <div className="flex flex-wrap gap-1 text-sm">
                  {KINDS.map((k) => (
                    <Link key={k.key} href={q(days, k.key)}
                      className={`rounded-full border px-3 py-1 ${k.key === kind ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {k.label}
                    </Link>
                  ))}
                </div>
              </div>
              {rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="px-2 py-2.5 font-medium">페이지</th>
                        <th className="px-2 py-2.5 font-medium">유형</th>
                        <th className="px-2 py-2.5 text-right font-medium">조회수</th>
                        <th className="px-2 py-2.5 text-right font-medium">방문자</th>
                        <th className="px-2 py-2.5 text-right font-medium">평균 참여시간</th>
                        <th className="px-2 py-2.5 text-right font-medium">리드</th>
                        <th className="px-2 py-2.5 text-right font-medium">전환율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.path} className="border-b border-slate-100">
                          <td className="max-w-[320px] px-2 py-3">
                            {r.href ? <Link href={r.href} className="block truncate text-indigo-600 hover:underline">{r.title}</Link> : <span className="block truncate">{r.title}</span>}
                            <span className="block truncate text-xs text-slate-400">{r.path}</span>
                          </td>
                          <td className="px-2 py-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{KIND_LABEL[r.kind]}</span></td>
                          <td className="px-2 py-3 text-right">{fmt(r.views)}</td>
                          <td className="px-2 py-3 text-right">{fmt(r.users)}</td>
                          <td className="px-2 py-3 text-right">{r.users ? duration(r.engagementSec / r.users) : "-"}</td>
                          <td className="px-2 py-3 text-right">{r.leads === null ? "-" : fmt(r.leads)}</td>
                          <td className="px-2 py-3 text-right font-medium">{r.leads === null ? "-" : pct(r.leads, r.users)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">이 기간에 방문 기록이 없어요.</p>
              )}
            </section>

            <p className="text-xs text-slate-500">
              방문 데이터는 Google Analytics 기준이며 최대 48시간 늦게 반영될 수 있어요. 리드와 전환율은 LEADstation에 저장된 리드 기준이에요.
            </p>
          </>
        );
      })()}
    </div>
  );
}
