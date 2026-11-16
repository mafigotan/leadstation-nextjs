import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import type { TermKind } from "@/lib/terms";
import { consentCounts, linkedPages } from "../linked";
import { TermEditor, type VersionView } from "./term-editor";

export const metadata = { title: "약관 편집 | LEADstation" };

export default async function TermPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, site } = await requireSite();
  const { data: term } = await supabase
    .from("terms")
    .select("id, title, kind, is_default, current_version_id, archived_at, term_versions:term_versions!term_versions_term_id_fkey(id, version, label, body, body_hash, change_note, published_at)")
    .eq("id", id)
    .eq("site_id", site.id)
    .maybeSingle<{
      id: string;
      title: string;
      kind: TermKind;
      is_default: boolean;
      current_version_id: string | null;
      archived_at: string | null;
      term_versions: Omit<VersionView, "consents">[];
    }>();
  if (!term) notFound();

  const published = term.term_versions.filter((v) => v.published_at);
  const [links, counts] = await Promise.all([
    linkedPages(supabase, site.id),
    consentCounts(supabase, new Map(published.map((v) => [v.id, [v.id]]))),
  ]);
  const versions: VersionView[] = [...term.term_versions]
    .sort((a, b) => b.version - a.version)
    .map((v) => ({ ...v, consents: counts.get(v.id) ?? 0 }));
  const versionNo = new Map(versions.map((v) => [v.id, v.version]));
  const linked = (links.get(term.id) ?? []).map((p) => ({ ...p, pinned: p.version_id ? versionNo.get(p.version_id) ?? null : null }));

  return (
    <div>
      <Link href="/dashboard/terms" className="text-sm text-slate-500 hover:underline">← 약관 관리</Link>
      <TermEditor
        term={{ id: term.id, title: term.title, kind: term.kind, is_default: term.is_default, current_version_id: term.current_version_id, archived: !!term.archived_at }}
        versions={versions}
        linked={linked}
        owner={site.name || site.handle}
      />
    </div>
  );
}
