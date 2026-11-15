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
  marketing_consent: boolean;
  created_at: string;
  pages: { title: string } | null;
};

export async function queryLeads(
  supabase: SupabaseClient,
  { pageId, q, limit = 500 }: { pageId?: string; q?: string; limit?: number },
) {
  let query = supabase
    .from("leads")
    .select("id, page_id, name, email, phone, message, address, gender, age, nationality, marketing_consent, created_at, pages(title)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (pageId) query = query.eq("page_id", pageId);
  const term = q?.trim().replace(/[%,()*]/g, " ");
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%`);

  const { data, error } = await query.returns<LeadWithPage[]>();
  if (error) console.error("queryLeads failed", error);
  return data ?? [];
}

/** 주소, 성별, 나이, 국적 in one line for the list. */
export function leadExtra(l: LeadWithPage): string {
  return [l.gender, l.age != null ? `${l.age}세` : null, l.nationality, l.address].filter(Boolean).join(" · ");
}
