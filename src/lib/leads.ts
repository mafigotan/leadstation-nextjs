import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadWithPage = {
  id: string;
  page_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  address: string | null;
  gender: string | null;
  age: number | null;
  nationality: string | null;
  event: string | null;
  marketing_consent: boolean;
  created_at: string;
  pages: { title: string } | null;
  lead_consents?: LeadConsent[];
};

export type LeadConsent = {
  required: boolean;
  agreed: boolean;
  agreed_at: string | null;
  term_versions: { id: string; version: number; label: string; terms: { title: string; kind: string; current_version_id: string | null } | null } | null;
};

const CONSENTS = "lead_consents(required, agreed, agreed_at, term_versions(id, version, label, terms:terms!term_versions_term_id_fkey(title, kind, current_version_id)))";

export async function queryLeads(
  supabase: SupabaseClient,
  { pageId, q, marketing, limit = 500 }: { pageId?: string; q?: string; marketing?: string; limit?: number },
): Promise<LeadWithPage[]> {
  const base = "id, page_id, name, email, phone, message, address, gender, age, nationality, event, marketing_consent, created_at, pages(title)";
  const run = (columns: string) => {
    let query = supabase.from("leads").select(columns).order("created_at", { ascending: false }).limit(limit);
    if (pageId) query = query.eq("page_id", pageId);
    if (marketing === "yes" || marketing === "no") query = query.eq("marketing_consent", marketing === "yes");
    const term = q?.trim().replace(/[%,()*]/g, " ");
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%`);
    return query.returns<LeadWithPage[]>();
  };
  let { data, error } = await run(`${base}, ${CONSENTS}`);
  // Before the terms migration runs there is no consent table: show the plain list.
  if (error) ({ data, error } = await run(base));
  if (error) console.error("queryLeads failed", error);
  return data ?? [];
}

/** 필수 약관 동의 수, 마케팅 동의, and whether any agreed version is older than the term's current one. */
export function consentSummary(l: LeadWithPage) {
  const list = l.lead_consents ?? [];
  const required = list.filter((c) => c.required);
  return {
    has: list.length > 0,
    required: required.length,
    requiredAgreed: required.filter((c) => c.agreed).length,
    outdated: list.some((c) => c.agreed && c.term_versions?.terms?.current_version_id && c.term_versions.terms.current_version_id !== c.term_versions.id),
  };
}

/** One line per consent for CSV: "약관 이름 v2 동의(필수) 2026. 11. 14. 15:02". */
export function consentText(l: LeadWithPage): string {
  return (l.lead_consents ?? [])
    .map((c) => {
      const v = c.term_versions;
      const at = c.agreed_at ? " " + new Date(c.agreed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";
      return `${v?.terms?.title ?? "약관"} v${v?.version ?? "?"} ${c.agreed ? "동의" : "미동의"}(${c.required ? "필수" : "선택"})${at}`;
    })
    .join("; ");
}

/** 주소, 성별, 나이, 국적 in one line for the list. */
export function leadExtra(l: LeadWithPage): string {
  return [l.gender, l.age != null ? `${l.age}세` : null, l.nationality, l.address].filter(Boolean).join(" · ");
}
