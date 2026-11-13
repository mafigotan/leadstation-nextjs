"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadAccount, requireUser } from "@/lib/supabase/server";
import { validateHandle } from "@/lib/site";

export type FormState = { error?: string; ok?: boolean; message?: string };

const PHONE_RE = /^[0-9+\-\s()]{8,20}$/;

/** Reads and checks 이름, 전화번호, 회사명. Returns an error message or the values. */
export async function readPersonalInfo(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim().slice(0, 50);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  const company = String(formData.get("company") ?? "").trim().slice(0, 100);
  if (!full_name) return { error: "이름을 입력해주세요." } as const;
  if (!PHONE_RE.test(phone)) return { error: "전화번호를 확인해주세요. 예: 010-1234-5678" } as const;
  if (!company) return { error: "회사명을 입력해주세요." } as const;
  return { values: { full_name, phone, company } } as const;
}

/** First step after sign-up: personal info and, for people who were not invited, their own site. */
export async function completeProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, memberships } = await loadAccount();
  const info = await readPersonalInfo(formData);
  if ("error" in info) return { error: info.error };

  let handle = "";
  if (!memberships.length) {
    handle = String(formData.get("handle") ?? "").trim().toLowerCase();
    const invalid = validateHandle(handle);
    if (invalid) return { error: invalid };
  }

  const { error } = await supabase.from("profiles").upsert({ user_id: user.id, ...info.values }, { onConflict: "user_id" });
  if (error) {
    console.error("save profile failed", error);
    return { error: "저장하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  if (!memberships.length) {
    const { error: siteError } = await supabase.rpc("create_site", { p_handle: handle, p_name: info.values.company });
    if (siteError) {
      if (siteError.code === "23505") return { error: "이미 다른 사람이 쓰고 있는 사이트 주소예요. 다른 주소를 입력해주세요." };
      console.error("create site failed", siteError);
      return { error: "사이트를 만들지 못했어요. 잠시 후 다시 시도해주세요." };
    }
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Live check for a site address. `currentSiteId` lets a site keep its own address. */
export async function checkHandle(raw: string, currentSiteId?: string) {
  const handle = raw.trim().toLowerCase();
  const invalid = validateHandle(handle);
  if (invalid) return { ok: false, message: invalid };
  const { supabase } = await requireUser();
  const { data } = await supabase.from("sites").select("id").eq("handle", handle).maybeSingle();
  if (data && data.id !== currentSiteId) return { ok: false, message: "이미 사용 중인 주소예요. 다른 주소를 입력해주세요." };
  return { ok: true, message: "사용할 수 있는 주소예요." };
}
