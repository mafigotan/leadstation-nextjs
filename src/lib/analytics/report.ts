import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteStats, normalizePath, type RangeDays, type SiteStats, type StatsResult } from "./ga";

/** GA visit numbers joined with LEADstation's own data: page names and leads (Supabase). */

export type ContentKind = "promo" | "blog" | "landing" | "list";
export const KIND_LABEL: Record<ContentKind, string> = { promo: "프로모션", blog: "블로그", landing: "랜딩", list: "목록" };

export type ContentRow = {
  path: string;
  kind: ContentKind;
  title: string;
  views: number;
  users: number;
  engagementSec: number;
  leads: number | null;
  href: string | null;
};

export type SiteReport = {
  stats: SiteStats;
  leadsTotal: number;
  leadsPrevious: number;
  leadsDaily: Map<string, number>;
  content: ContentRow[];
};

export type ReportResult = { ok: true; report: SiteReport } | Exclude<StatsResult, { ok: true }>;

function kstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** First moment (UTC) of the Korean day `offset` days ago. */
function kstStart(offset: number): Date {
  const day = new Date(Date.now() + 9 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00+09:00`);
}

function kindOf(path: string): ContentKind {
  if (path === "/") return "landing";
  if (path === "/blog" || path === "/promotions") return "list";
  if (path.startsWith("/blog/")) return "blog";
  return "promo";
}

export async function buildSiteReport(supabase: SupabaseClient, site: { id: string; handle: string }, days: RangeDays): Promise<ReportResult> {
  const statsRes = await getSiteStats(site.handle, days);
  if (!statsRes.ok) return statsRes;
  const stats = statsRes.stats;

  const since = kstStart(days * 2 - 1);
  const split = kstStart(days - 1);
  const [pagesQ, articlesQ] = await Promise.all([
    supabase.from("pages").select("id, slug, title").eq("site_id", site.id),
    supabase.from("articles").select("id, slug, title").eq("site_id", site.id),
  ]);
  const pages = (pagesQ.data ?? []) as { id: string; slug: string; title: string }[];
  const articles = (articlesQ.data ?? []) as { id: string; slug: string; title: string }[];

  const leadsQ = pages.length
    ? await supabase.from("leads").select("page_id, created_at").in("page_id", pages.map((p) => p.id))
        .gte("created_at", since.toISOString()).limit(20000)
    : { data: [] };
  const leads = (leadsQ.data ?? []) as { page_id: string; created_at: string }[];

  let leadsTotal = 0;
  let leadsPrevious = 0;
  const leadsDaily = new Map<string, number>();
  const leadsByPage = new Map<string, number>();
  for (const l of leads) {
    if (new Date(l.created_at) < split) { leadsPrevious++; continue; }
    leadsTotal++;
    const d = kstDay(l.created_at);
    leadsDaily.set(d, (leadsDaily.get(d) ?? 0) + 1);
    leadsByPage.set(l.page_id, (leadsByPage.get(l.page_id) ?? 0) + 1);
  }

  const pageBySlug = new Map(pages.map((p) => [p.slug, p]));
  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));

  const content: ContentRow[] = stats.pages.map((p) => {
    const path = normalizePath(p.path, site.handle);
    const kind = kindOf(path);
    const slug = path.replace(/^\/(blog\/)?/, "");
    if (kind === "promo") {
      const page = pageBySlug.get(slug);
      return { ...p, path, kind, title: page?.title || p.title || path, leads: page ? leadsByPage.get(page.id) ?? 0 : 0,
        href: page ? `/dashboard/pages/${page.id}` : null };
    }
    if (kind === "blog") {
      const a = articleBySlug.get(slug);
      return { ...p, path, kind, title: a?.title || p.title || path, leads: null, href: a ? `/dashboard/writer/${a.id}` : null };
    }
    const title = kind === "landing" ? "메인 랜딩" : path === "/blog" ? "블로그 목록" : "프로모션 목록";
    return { ...p, path, kind, title, leads: null, href: null };
  });

  return { ok: true, report: { stats, leadsTotal, leadsPrevious, leadsDaily, content } };
}
