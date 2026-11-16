// Terms (개인정보 수집·이용 등) linked to a promotion's lead form. Shared by the dashboard, the editor and public pages.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Section } from "./page-sections";

export const TERM_KINDS = [
  { key: "privacy", label: "개인정보 수집·이용" },
  { key: "third_party", label: "개인정보 제3자 제공" },
  { key: "marketing", label: "마케팅 정보 수신" },
  { key: "other", label: "기타" },
] as const;
export type TermKind = (typeof TERM_KINDS)[number]["key"];
export const TERM_KIND_LABEL = Object.fromEntries(TERM_KINDS.map((k) => [k.key, k.label])) as Record<TermKind, string>;
export const isTermKind = (v: unknown): v is TermKind => TERM_KINDS.some((k) => k.key === v);

/** One term on a form section. version_id null = always the latest published version. */
export type FormTerm = { term_id: string; version_id: string | null; required: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeFormTerms(input: unknown): FormTerm[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.slice(0, 10).flatMap((raw): FormTerm[] => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = typeof r.term_id === "string" && UUID_RE.test(r.term_id) ? r.term_id : "";
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const v = typeof r.version_id === "string" && UUID_RE.test(r.version_id) ? r.version_id : null;
    return [{ term_id: id, version_id: v, required: r.required === true }];
  });
}

/** Template text for a new term of each kind. */
export function termTemplate(kind: TermKind, owner: string): { label: string; body: string } {
  const who = owner || "[회사명]";
  switch (kind) {
    case "privacy":
      return {
        label: "개인정보 수집 및 이용에 동의합니다.",
        body: `${who}은(는) 프로모션 신청 확인과 안내를 위해 아래와 같이 개인정보를 수집·이용합니다.\n\n■ 수집 목적: [예: 이벤트 참여 확인, 당첨자 안내 및 경품 발송]\n■ 수집 항목: [예: 이름, 전화번호, 주소]\n■ 보유 기간: [예: 이벤트 종료 후 3개월 뒤 파기]\n\n동의를 거부할 수 있으며, 거부하면 신청이 제한됩니다.`,
      };
    case "third_party":
      return {
        label: "개인정보 제3자 제공에 동의합니다.",
        body: `${who}은(는) 아래와 같이 개인정보를 제3자에게 제공합니다.\n\n■ 제공받는 자: [예: ○○택배]\n■ 제공 목적: [예: 경품 배송]\n■ 제공 항목: [예: 이름, 전화번호, 주소]\n■ 보유 기간: [예: 배송 완료 후 1개월]\n\n동의를 거부할 수 있으며, 거부하면 [경품 수령]이 제한됩니다.`,
      };
    case "marketing":
      return {
        label: "이벤트 및 마케팅 정보 수신에 동의합니다.",
        body: `${who}이(가) 보내는 이벤트, 혜택 등 마케팅 정보를 이메일이나 문자로 받는 것에 동의합니다.\n\n■ 이용 목적: 이벤트·혜택 안내, 뉴스레터 발송\n■ 이용 항목: 이메일, 전화번호\n■ 보유 기간: 동의를 철회할 때까지\n\n동의하지 않아도 신청할 수 있으며, 언제든 수신을 거부할 수 있습니다.`,
      };
    default:
      return { label: "", body: "" };
  }
}

/** A term as shown on a lead form: the exact version a visitor agrees to. */
export type ShownTerm = {
  term_id: string;
  version_id: string;
  version: number;
  kind: TermKind;
  label: string;
  body: string;
  required: boolean;
};

type TermRow = { id: string; kind: TermKind; is_default: boolean; current_version_id: string | null };
type VersionRow = { id: string; term_id: string; version: number; label: string; body: string };

/**
 * The terms a form section shows. Sections saved before terms existed use the site's default terms
 * (privacy required, marketing optional), which matches the old fixed wording.
 * Returns [] when nothing resolves (e.g. the database is not migrated yet): the form then keeps its old fixed checkboxes.
 */
export async function resolveFormTerms(supabase: SupabaseClient, siteId: string, section: Section | null | undefined): Promise<ShownTerm[]> {
  const { data: terms, error } = await supabase
    .from("terms")
    .select("id, kind, is_default, current_version_id")
    .eq("site_id", siteId)
    .is("archived_at", null)
    .returns<TermRow[]>();
  if (error || !terms?.length) return [];
  const byId = new Map(terms.map((t) => [t.id, t]));

  const wanted: FormTerm[] = section?.terms
    ? section.terms
    : [...terms]
        .filter((t) => t.is_default && (t.kind === "privacy" || t.kind === "marketing"))
        .sort((a, b) => (a.kind === "privacy" ? 0 : 1) - (b.kind === "privacy" ? 0 : 1))
        .map((t) => ({ term_id: t.id, version_id: null, required: t.kind === "privacy" }));

  const picks = wanted.flatMap((w) => {
    const t = byId.get(w.term_id);
    const vid = w.version_id ?? t?.current_version_id;
    return t && vid ? [{ w, t, vid }] : [];
  });
  if (!picks.length) return [];
  const { data: versions } = await supabase
    .from("term_versions")
    .select("id, term_id, version, label, body")
    .in("id", picks.map((p) => p.vid))
    .not("published_at", "is", null)
    .returns<VersionRow[]>();
  const vById = new Map((versions ?? []).map((v) => [v.id, v]));
  return picks.flatMap(({ w, t, vid }) => {
    const v = vById.get(vid);
    if (!v || v.term_id !== t.id) return [];
    return [{ term_id: t.id, version_id: v.id, version: v.version, kind: t.kind, label: v.label, body: v.body, required: w.required }];
  });
}

/** Terms and their published versions, for the promotion editor's picker. */
export type TermOption = {
  id: string;
  title: string;
  kind: TermKind;
  is_default: boolean;
  current_version_id: string | null;
  versions: { id: string; version: number; label: string; published_at: string }[];
};

export async function listTermOptions(supabase: SupabaseClient, siteId: string): Promise<TermOption[]> {
  const { data } = await supabase
    .from("terms")
    .select("id, title, kind, is_default, current_version_id, term_versions:term_versions!term_versions_term_id_fkey(id, version, label, published_at)")
    .eq("site_id", siteId)
    .is("archived_at", null)
    .order("created_at")
    .returns<(Omit<TermOption, "versions"> & { term_versions: { id: string; version: number; label: string; published_at: string | null }[] })[]>();
  return (data ?? [])
    .map(({ term_versions, ...t }) => ({
      ...t,
      versions: term_versions
        .filter((v): v is TermOption["versions"][number] => !!v.published_at)
        .sort((a, b) => b.version - a.version),
    }))
    .filter((t) => t.versions.length);
}

/** Which terms a page's form uses (term id → pinned version id or null), for "linked promotions" counts. */
export function formTermLinks(sections: Section[], defaults: { id: string; kind: TermKind }[]): FormTerm[] {
  const form = sections.find((s) => s.type === "form");
  if (!form) return [];
  if (form.terms) return form.terms;
  return defaults
    .filter((t) => t.kind === "privacy" || t.kind === "marketing")
    .map((t) => ({ term_id: t.id, version_id: null, required: t.kind === "privacy" }));
}
