"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GENDERS, LEAD_FIELD_LABEL, formFields, type LeadField } from "@/lib/lead-fields";
import { hasEvent, toSections } from "@/lib/page-sections";
import type { PageContent } from "@/lib/types";

const FIELD_SCHEMA: Record<LeadField, z.ZodType<unknown>> = {
  name: z.string().max(100, "이름이 너무 길어요."),
  email: z.union([z.literal(""), z.email("올바른 이메일을 입력해 주세요.").max(200)]),
  phone: z.string().max(50, "전화번호가 너무 길어요."),
  address: z.string().max(300, "주소가 너무 길어요."),
  gender: z.union([z.literal(""), z.enum(GENDERS, "성별을 선택해 주세요.")]),
  age: z.union([z.literal(""), z.coerce.number("나이는 숫자로 입력해 주세요.").int("나이는 숫자로 입력해 주세요.").min(0, "나이를 확인해 주세요.").max(150, "나이를 확인해 주세요.")]),
  nationality: z.string().max(100, "국적이 너무 길어요."),
  message: z.string().max(2000, "기타 내용이 너무 길어요."),
};

export type LeadState = { error?: string; done?: boolean };

export async function submitLead(pageId: string, sectionId: string, _: LeadState, formData: FormData): Promise<LeadState> {
  // Honeypot: real visitors leave this hidden field empty.
  if (formData.get("website")) return { done: true };
  if (formData.get("privacy") !== "on") return { error: "개인정보 수집 및 이용에 동의해 주세요." };

  const supabase = await createClient();
  // The page's own form decides which fields are accepted and required.
  const { data: page } = await supabase.from("pages").select("content").eq("id", pageId).maybeSingle<{ content: PageContent }>();
  if (!page) return { error: "공개된 페이지에서만 신청할 수 있어요." };
  const sections = toSections(page.content);
  const forms = sections.filter((s) => s.type === "form");
  const section = forms.find((s) => s.id === sectionId) ?? forms[0];
  const { fields, required } = formFields(section?.fields);

  const row: Record<string, unknown> = { page_id: pageId, marketing_consent: formData.get("marketing") === "on" };
  for (const f of fields) {
    const raw = String(formData.get(f) ?? "").trim();
    if (!raw && required.includes(f)) return { error: `${LEAD_FIELD_LABEL[f]}을(를) 입력해 주세요.` };
    const parsed = FIELD_SCHEMA[f].safeParse(f === "email" ? raw.toLowerCase() : raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
    if (raw) row[f] = parsed.data;
  }
  if (!fields.some((f) => row[f] !== undefined)) return { error: "신청 정보를 입력해 주세요." };
  if (hasEvent(sections)) {
    const ev = String(formData.get("event") ?? "").trim().slice(0, 200);
    if (!ev) return { error: "위 이벤트에 먼저 참여해 주세요." };
    row.event = ev;
  }

  const { error } = await supabase.from("leads").insert(row);
  if (error) {
    console.error("insert lead failed", error);
    return { error: "신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  return { done: true };
}
