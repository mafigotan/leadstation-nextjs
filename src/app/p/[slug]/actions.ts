"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LeadSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(100),
  email: z.email("올바른 이메일을 입력해 주세요.").max(200),
  phone: z.string().trim().max(50).optional(),
  message: z.string().trim().max(2000).optional(),
  marketing_consent: z.boolean(),
});

export type LeadState = { error?: string; done?: boolean };

export async function submitLead(pageId: string, _: LeadState, formData: FormData): Promise<LeadState> {
  // Honeypot: real visitors leave this hidden field empty.
  if (formData.get("website")) return { done: true };
  if (formData.get("privacy") !== "on") return { error: "개인정보 수집 및 이용에 동의해 주세요." };

  const parsed = LeadSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "") || undefined,
    message: String(formData.get("message") ?? "") || undefined,
    marketing_consent: formData.get("marketing") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({ page_id: pageId, ...parsed.data });
  if (error) {
    console.error("insert lead failed", error);
    return { error: "신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  return { done: true };
}
