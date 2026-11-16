// Data for the public user site (handle.leadstation.kr): site info, promotions and blog posts.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSiteLive, todayKst } from "@/lib/site";
import type { HeaderImage } from "@/lib/writer/types";

export type PublicSite = {
  id: string;
  handle: string;
  name: string;
  status: string;
  active_from: string | null;
  active_until: string | null;
  logo_url: string;
  company_name: string;
  ceo_name: string;
  business_no: string;
  address: string;
  contact_phone: string;
  contact_email: string;
};

export const PUBLIC_SITE_COLUMNS =
  "id, handle, name, status, active_from, active_until, logo_url, company_name, ceo_name, business_no, address, contact_phone, contact_email";

/** The live site for a handle, or null. Cached per request so layout-like parts can share it. */
export const loadPublicSite = cache(async (handle: string): Promise<PublicSite | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sites").select(PUBLIC_SITE_COLUMNS).eq("handle", handle.toLowerCase()).maybeSingle<PublicSite>();
  if (!data || !isSiteLive(data)) return null;
  return data;
});

export type PromoState = "live" | "upcoming" | "ended";

export type PromoCard = {
  slug: string;
  headline: string;
  subheadline: string;
  image: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  state: PromoState;
};

export function promoState(p: { starts_on: string | null; ends_on: string | null }, today = todayKst()): PromoState {
  if (p.ends_on && p.ends_on < today) return "ended";
  if (p.starts_on && p.starts_on > today) return "upcoming";
  return "live";
}

export const PROMO_STATE_LABEL: Record<PromoState, string> = { live: "진행 중", upcoming: "오픈 예정", ended: "종료" };

/** "2026.11.01" from "2026-11-01". */
export function dotDate(d: string | null | undefined): string {
  return d ? d.slice(0, 10).replace(/-/g, ".") : "";
}

export function periodText(p: { starts_on: string | null; ends_on: string | null }): string {
  if (!p.starts_on && !p.ends_on) return "";
  return `${dotDate(p.starts_on)} ~ ${dotDate(p.ends_on)}`.trim();
}

/** Days left until the end date (0 on the last day), or null without one. */
export function promoDaysLeft(endsOn: string | null): number | null {
  if (!endsOn) return null;
  return Math.round((Date.parse(endsOn + "T00:00:00Z") - Date.parse(todayKst() + "T00:00:00Z")) / 86400000);
}

const stateOrder: Record<PromoState, number> = { live: 0, upcoming: 1, ended: 2 };

/** Published promotions of a site: live first, then upcoming, then ended; newest first within each. */
export async function listPromotions(siteId: string): Promise<PromoCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("slug, starts_on, ends_on, created_at, headline:content->>headline, subheadline:content->>subheadline, image:content->>hero_image")
    .eq("site_id", siteId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(500);
  const today = todayKst();
  const rows = (data ?? []) as unknown as Omit<PromoCard, "state">[];
  return rows
    .map((r) => ({ ...r, headline: r.headline ?? "", subheadline: r.subheadline ?? "", image: r.image ?? "", state: promoState(r, today) }))
    .sort((a, b) => {
      if (a.state !== b.state) return stateOrder[a.state] - stateOrder[b.state];
      // Ended: the one that ended last comes first. Others: the one that started (or was made) last.
      const ka = a.state === "ended" ? a.ends_on ?? "" : a.starts_on ?? a.created_at.slice(0, 10);
      const kb = b.state === "ended" ? b.ends_on ?? "" : b.starts_on ?? b.created_at.slice(0, 10);
      if (ka !== kb) return ka < kb ? 1 : -1;
      return a.created_at < b.created_at ? 1 : -1;
    });
}

/** The promotion for the top of the home page: a live one, otherwise the one that ended last. */
export function featuredPromotion(promos: PromoCard[]): PromoCard | null {
  return promos.find((p) => p.state === "live") ?? promos.find((p) => p.state === "ended") ?? null;
}

export type PostCard = {
  slug: string;
  title: string;
  meta_description: string;
  header_image: Partial<HeaderImage>;
  published_at: string;
};

/** Published blog posts (AI 글쓰기), newest first, with the total count. */
export async function listPosts(siteId: string, offset: number, limit: number): Promise<{ posts: PostCard[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("articles")
    .select("slug, title, meta_description, header_image, published_at", { count: "exact" })
    .eq("site_id", siteId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return { posts: (data ?? []) as PostCard[], total: count ?? 0 };
}

/** Page number from ?page=, at least 1. */
export function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 1 ? Math.min(n, 1000) : 1;
}
