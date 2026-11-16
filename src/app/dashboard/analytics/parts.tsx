import type { DailyPoint } from "@/lib/analytics/ga";

export const fmt = (n: number) => n.toLocaleString("ko-KR");

export function duration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  return `${m}분 ${String(s % 60).padStart(2, "0")}초`;
}

export function pct(part: number, whole: number, digits = 1): string {
  if (!whole) return "-";
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

/** "지난 기간 대비 +12%" style change line. */
export function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-slate-400">지난 기간 데이터 없음</span>;
  const d = Math.round(((now - before) / before) * 100);
  const cls = d > 0 ? "text-emerald-700" : d < 0 ? "text-rose-700" : "text-slate-500";
  return <span className={cls}>지난 기간 대비 {d > 0 ? "+" : d < 0 ? "−" : "±"}{Math.abs(d)}%</span>;
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs">{sub}</p>}
    </div>
  );
}

/** Daily visitor bars with a lead dot above each day. Plain CSS so it renders on the server. */
export function DailyBars({ daily, leads, height = 200, compact = false }: { daily: DailyPoint[]; leads?: Map<string, number>; height?: number; compact?: boolean }) {
  const max = Math.max(1, ...daily.map((d) => d.users));
  const leadMax = Math.max(1, ...daily.map((d) => leads?.get(d.date) ?? 0));
  const ticks = compact ? [] : [0, Math.floor((daily.length - 1) / 2), daily.length - 1];
  return (
    <div>
      <div className="flex items-end gap-[3px] border-b border-l border-slate-300 px-1" style={{ height }}>
        {daily.map((d) => {
          const l = leads?.get(d.date) ?? 0;
          return (
            <div key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${d.date} · 방문자 ${fmt(d.users)} · 페이지뷰 ${fmt(d.views)}${leads ? ` · 리드 ${l}` : ""}`}>
              {leads && l > 0 && (
                <span className="absolute size-1.5 rounded-full bg-orange-500" style={{ bottom: `${(l / leadMax) * 90 + 4}%` }} />
              )}
              <div className="w-full rounded-t-[3px] bg-indigo-500/85 group-hover:bg-indigo-700" style={{ height: `${(d.users / max) * 85}%`, minHeight: d.users ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      {ticks.length > 0 && (
        <div className="mt-1 flex justify-between px-1 text-xs text-slate-500">
          {ticks.map((i) => <span key={i}>{daily[i]?.date.slice(5).replace("-", "/")}</span>)}
        </div>
      )}
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold">방문 통계 준비 중이에요</p>
      <p className="mt-2 text-sm text-slate-500">Google Analytics 연결 설정이 끝나면 내 사이트 방문 통계가 여기에 표시돼요.</p>
    </div>
  );
}
