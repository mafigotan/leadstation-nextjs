import "server-only";
import { createSign } from "node:crypto";
import { unstable_cache } from "next/cache";
import { propertyId, serviceAccount as readServiceAccount } from "./config";

/**
 * Site visit statistics from the platform's single GA4 property (GA4 Data API, service account).
 * Every report is filtered to one site by the `site_handle` custom dimension, so a user only ever sees their own site.
 *
 * Env:
 *   GA4_PROPERTY_ID                 numeric property id (Admin → Property details)
 *   GOOGLE_SERVICE_ACCOUNT_JSON     the service account key JSON (whole file, or base64 of it)
 *
 * Results are cached for an hour per site and range (realtime for a minute) to stay far inside the API quota.
 * Another source (e.g. the user's own GA property over OAuth) can later implement the same `SiteStats` shape.
 */

export type RangeDays = 7 | 28 | 90;
export const RANGES: RangeDays[] = [7, 28, 90];

export type Totals = { users: number; sessions: number; views: number; engagementSec: number };
export type DailyPoint = { date: string; users: number; views: number };
export type NamedValue = { name: string; value: number };
export type PageStat = { path: string; title: string; views: number; users: number; engagementSec: number };

export type SiteStats = {
  days: RangeDays;
  current: Totals;
  previous: Totals;
  daily: DailyPoint[];
  sources: NamedValue[];
  devices: NamedValue[];
  regions: NamedValue[];
  pages: PageStat[];
  fetchedAt: string;
};

export type StatsResult = { ok: true; stats: SiteStats } | { ok: false; reason: "not_configured" | "error"; message?: string };

export function gaConfigured(): boolean {
  return !!(propertyId() && readServiceAccount());
}

function serviceAccount() {
  const sa = readServiceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON을 읽을 수 없어요");
  return sa;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

let token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claim}`);
  const jwt = `${head}.${claim}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google 인증 실패 (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type GaReport = { rows?: GaRow[] };

async function gaPost<T>(method: string, body: unknown): Promise<T> {
  const property = propertyId();
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 Data API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

const siteFilter = (handle: string) => ({
  filter: { fieldName: "customEvent:site_handle", stringFilter: { matchType: "EXACT", value: handle } },
});

const num = (r: GaRow, i: number) => Number(r.metricValues?.[i]?.value ?? 0);
const dim = (r: GaRow, i: number) => r.dimensionValues?.[i]?.value ?? "";

function totalsOf(r: GaRow | undefined): Totals {
  if (!r) return { users: 0, sessions: 0, views: 0, engagementSec: 0 };
  return { users: num(r, 0), sessions: num(r, 1), views: num(r, 2), engagementSec: num(r, 3) };
}

/** yyyy-mm-dd in Korea time, `offset` days before today. */
function kstDate(offset: number): string {
  const d = new Date(Date.now() + 9 * 3600_000 - offset * 86400_000);
  return d.toISOString().slice(0, 10);
}

const REGION_KO: Record<string, string> = {
  Seoul: "서울", "Gyeonggi-do": "경기", Incheon: "인천", Busan: "부산", Daegu: "대구", Daejeon: "대전", Gwangju: "광주",
  Ulsan: "울산", Sejong: "세종", "Sejong-si": "세종", "Gangwon-do": "강원", Gangwon: "강원",
  "Chungcheongbuk-do": "충북", "Chungcheongnam-do": "충남", "Jeollabuk-do": "전북", "Jeonbuk State": "전북",
  "Jeollanam-do": "전남", "Gyeongsangbuk-do": "경북", "Gyeongsangnam-do": "경남", "Jeju-do": "제주", Jeju: "제주",
  "(not set)": "알 수 없음",
};
const DEVICE_KO: Record<string, string> = { mobile: "모바일", desktop: "PC", tablet: "태블릿", "smart tv": "TV" };

function sourceLabel(source: string, medium: string): string {
  if (source === "(direct)") return "직접 방문 (direct)";
  if (!source || source === "(not set)") return "알 수 없음";
  return `${source} / ${medium || "(none)"}`;
}

/** On staging the pages live under /s/<handle>; on subdomains at the root. Normalise to the subdomain form. */
export function normalizePath(path: string, handle: string): string {
  const prefix = `/s/${handle}`;
  let p = path.split("?")[0] || "/";
  if (p === prefix) p = "/";
  else if (p.startsWith(`${prefix}/`)) p = p.slice(prefix.length);
  return p.length > 1 ? p.replace(/\/$/, "") : p;
}

async function fetchStats(handle: string, days: RangeDays): Promise<SiteStats> {
  const current = { startDate: `${days - 1}daysAgo`, endDate: "today", name: "current" };
  const previous = { startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo`, name: "previous" };
  const filter = siteFilter(handle);
  const base = { dateRanges: [current], dimensionFilter: filter };
  const totalsMetrics = [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "userEngagementDuration" }];

  const [a, b] = await Promise.all([
    gaPost<{ reports: GaReport[] }>("batchRunReports", {
      requests: [
        { dateRanges: [current, previous], dimensionFilter: filter, metrics: totalsMetrics },
        { ...base, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }], limit: 400 },
        { ...base, dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }], metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 6 },
      ],
    }),
    gaPost<{ reports: GaReport[] }>("batchRunReports", {
      requests: [
        { ...base, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] },
        { ...base, dimensions: [{ name: "region" }], metrics: [{ name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 6 },
        { ...base, dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "userEngagementDuration" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 200 },
      ],
    }),
  ]);
  const [totalsR, dailyR, sourcesR] = a.reports;
  const [devicesR, regionsR, pagesR] = b.reports;

  // With two date ranges GA adds a "dateRange" dimension to each row.
  const tRows = totalsR.rows ?? [];
  const cur = tRows.find((r) => dim(r, 0) === "current");
  const prev = tRows.find((r) => dim(r, 0) === "previous");

  const byDate = new Map((dailyR.rows ?? []).map((r) => {
    const d = dim(r, 0);
    return [`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, { users: num(r, 0), views: num(r, 1) }];
  }));
  const daily: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = kstDate(i);
    daily.push({ date, ...(byDate.get(date) ?? { users: 0, views: 0 }) });
  }

  // Merge rows that only differ by trailing slash / staging prefix; keep the most-viewed title.
  const pageMap = new Map<string, PageStat>();
  for (const r of pagesR.rows ?? []) {
    const path = normalizePath(dim(r, 0), handle);
    const row = pageMap.get(path);
    if (row) {
      row.views += num(r, 0); row.users += num(r, 1); row.engagementSec += num(r, 2);
    } else {
      pageMap.set(path, { path, title: dim(r, 1), views: num(r, 0), users: num(r, 1), engagementSec: num(r, 2) });
    }
  }

  return {
    days,
    current: totalsOf(cur),
    previous: totalsOf(prev),
    daily,
    sources: (sourcesR.rows ?? []).map((r) => ({ name: sourceLabel(dim(r, 0), dim(r, 1)), value: num(r, 0) })),
    devices: (devicesR.rows ?? []).map((r) => ({ name: DEVICE_KO[dim(r, 0)] ?? dim(r, 0), value: num(r, 0) })),
    regions: (regionsR.rows ?? []).map((r) => ({ name: REGION_KO[dim(r, 0)] ?? dim(r, 0), value: num(r, 0) })),
    pages: [...pageMap.values()].sort((x, y) => y.views - x.views),
    fetchedAt: new Date().toISOString(),
  };
}

const cachedStats = unstable_cache(fetchStats, ["ga-site-stats-v1"], { revalidate: 3600 });

export async function getSiteStats(handle: string, days: RangeDays): Promise<StatsResult> {
  if (!gaConfigured()) return { ok: false, reason: "not_configured" };
  try {
    return { ok: true, stats: await cachedStats(handle.toLowerCase(), days) };
  } catch (e) {
    console.error("[ga] stats", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchRealtime(handle: string): Promise<number> {
  const r = await gaPost<GaReport>("runRealtimeReport", {
    dimensionFilter: { filter: { fieldName: "customUser:ls_site", stringFilter: { matchType: "EXACT", value: handle } } },
    metrics: [{ name: "activeUsers" }],
  });
  return r.rows?.[0] ? num(r.rows[0], 0) : 0;
}

const cachedRealtime = unstable_cache(fetchRealtime, ["ga-site-realtime-v1"], { revalidate: 60 });

/** Visitors in the last 30 minutes, or null when unavailable. */
export async function getRealtimeUsers(handle: string): Promise<number | null> {
  if (!gaConfigured()) return null;
  try {
    return await cachedRealtime(handle.toLowerCase());
  } catch (e) {
    console.error("[ga] realtime", e);
    return null;
  }
}

export type AccessibleProperty = { id: string; name: string; account: string };

/**
 * Properties the service account can read (GA Admin API accountSummaries), for the setup panel.
 * Needs "Google Analytics Admin API" enabled in the same Google Cloud project; otherwise returns the error text.
 */
export async function accessibleProperties(): Promise<{ ok: true; list: AccessibleProperty[] } | { ok: false; message: string }> {
  try {
    const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200", {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, message: `${res.status} ${(await res.text()).slice(0, 200)}` };
    const j = (await res.json()) as { accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[] };
    const list = (j.accountSummaries ?? []).flatMap((a) =>
      (a.propertySummaries ?? []).map((p) => ({ id: p.property.replace(/^properties\//, ""), name: p.displayName, account: a.displayName })),
    );
    return { ok: true, list };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Realtime visitors (last 30 min) by the ls_site user property, unfiltered: for the setup panel. */
export async function realtimeBySite(): Promise<{ ok: true; rows: NamedValue[] } | { ok: false; message: string }> {
  try {
    const r = await gaPost<GaReport>("runRealtimeReport", {
      dimensions: [{ name: "customUser:ls_site" }],
      metrics: [{ name: "activeUsers" }],
      limit: 20,
    });
    return { ok: true, rows: (r.rows ?? []).map((x) => ({ name: dim(x, 0), value: num(x, 0) })) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
