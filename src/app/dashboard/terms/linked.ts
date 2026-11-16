import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toSections } from "@/lib/page-sections";
import { formTermLinks, type TermKind } from "@/lib/terms";
import type { PageContent } from "@/lib/types";

export type LinkedPage = { id: string; title: string; version_id: string | null; required: boolean };

/** For each term of the site, the promotions whose lead form shows it. */
export async function linkedPages(supabase: SupabaseClient, siteId: string): Promise<Map<string, LinkedPage[]>> {
  const [{ data: pages }, { data: defaults }] = await Promise.all([
    supabase.from("pages").select("id, title, content").eq("site_id", siteId).order("created_at", { ascending: false }),
    supabase.from("terms").select("id, kind").eq("site_id", siteId).eq("is_default", true).is("archived_at", null),
  ]);
  const out = new Map<string, LinkedPage[]>();
  for (const p of (pages ?? []) as { id: string; title: string; content: PageContent }[]) {
    for (const link of formTermLinks(toSections(p.content), (defaults ?? []) as { id: string; kind: TermKind }[])) {
      const list = out.get(link.term_id) ?? [];
      list.push({ id: p.id, title: p.title, version_id: link.version_id, required: link.required });
      out.set(link.term_id, list);
    }
  }
  return out;
}

/** Number of consent records per term (any version). */
export async function consentCounts(supabase: SupabaseClient, versionsByTerm: Map<string, string[]>): Promise<Map<string, number>> {
  const entries = await Promise.all(
    [...versionsByTerm].map(async ([termId, ids]) => {
      if (!ids.length) return [termId, 0] as const;
      const { count } = await supabase.from("lead_consents").select("id", { count: "exact", head: true }).in("term_version_id", ids);
      return [termId, count ?? 0] as const;
    }),
  );
  return new Map(entries);
}
