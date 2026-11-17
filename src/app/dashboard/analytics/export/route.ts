import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireSite } from "@/lib/supabase/server";
import { buildSiteReport, KIND_LABEL } from "@/lib/analytics/report";
import { parsePeriod, previousOf } from "@/lib/analytics/period";

/** Excel export of what the 방문 통계 page shows for the chosen period. */
export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const period = parsePeriod(sp);
  const { supabase, site } = await requireSite();
  const res = await buildSiteReport(supabase, site, period);
  if (!res.ok) return NextResponse.json({ error: "방문 통계를 불러오지 못했어요." }, { status: res.reason === "not_configured" ? 404 : 502 });
  const { stats, leadsTotal, leadsPrevious, leadsDaily, content } = res.report;
  const c = stats.current;
  const p = stats.previous;
  const prev = previousOf(period);
  const avg = (sec: number, users: number) => (users ? Math.round(sec / users) : 0);
  const rate = (a: number, b: number) => (b ? a / b : null);

  const wb = new ExcelJS.Workbook();
  wb.creator = "LEADstation";
  wb.created = new Date();

  const style = (ws: ExcelJS.Worksheet, widths: number[], formats: Record<number, string> = {}) => {
    ws.columns = widths.map((width) => ({ width }));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const [col, fmt] of Object.entries(formats)) ws.getColumn(Number(col)).numFmt = fmt;
  };

  const summary = wb.addWorksheet("요약");
  style(summary, [20, 34, 34]);
  summary.addRows([
    ["항목", `조회 기간 (${period.start} ~ ${period.end})`, `지난 기간 (${prev.start} ~ ${prev.end})`],
    ["방문자", c.users, p.users],
    ["세션", c.sessions, p.sessions],
    ["페이지뷰", c.views, p.views],
    ["평균 참여시간(초)", avg(c.engagementSec, c.users), avg(p.engagementSec, p.users)],
    ["리드", leadsTotal, leadsPrevious],
    ["리드 전환율", rate(leadsTotal, c.users), rate(leadsPrevious, p.users)],
    [],
    ["사이트", site.handle],
    ["기준", "방문 데이터는 Google Analytics, 리드는 LEADstation 기준 (한국 시간)"],
  ]);
  const head = summary.getRow(1);
  head.font = { bold: true };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  summary.getRow(7).numFmt = "0.0%";

  const daily = wb.addWorksheet("일별 추이");
  daily.addRow(["날짜", "방문자", "페이지뷰", "리드"]);
  for (const d of stats.daily) daily.addRow([d.date, d.users, d.views, leadsDaily.get(d.date) ?? 0]);
  style(daily, [14, 12, 12, 10]);

  const pages = wb.addWorksheet("콘텐츠별 성과");
  pages.addRow(["페이지", "유형", "주소", "조회수", "방문자", "평균 참여시간(초)", "리드", "전환율"]);
  for (const r of content) {
    pages.addRow([r.title, KIND_LABEL[r.kind], r.path, r.views, r.users, avg(r.engagementSec, r.users),
      r.leads ?? "", r.leads === null ? "" : rate(r.leads, r.users) ?? ""]);
  }
  style(pages, [40, 10, 30, 10, 10, 18, 8, 10], { 8: "0.0%" });

  const sources = wb.addWorksheet("유입 경로");
  sources.addRow(["유입 경로 (source / medium)", "세션"]);
  for (const s of stats.sources) sources.addRow([s.name, s.value]);
  style(sources, [40, 12]);

  const devices = wb.addWorksheet("기기·지역");
  devices.addRow(["기기", "방문자", "", "지역", "방문자"]);
  for (let i = 0; i < Math.max(stats.devices.length, stats.regions.length); i++) {
    const d = stats.devices[i];
    const g = stats.regions[i];
    devices.addRow([d?.name ?? "", d?.value ?? "", "", g?.name ?? "", g?.value ?? ""]);
  }
  style(devices, [14, 10, 4, 14, 10]);

  const buf = await wb.xlsx.writeBuffer();
  const name = `visits-${site.handle}-${period.start}_${period.end}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
