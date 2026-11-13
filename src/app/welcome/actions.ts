"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { validateHandle } from "@/lib/site";

export type HandleState = { error?: string; ok?: boolean };

export async function saveProfile(_: HandleState, formData: FormData): Promise<HandleState> {
  const { supabase, user } = await requireUser();
  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 80);
  const invalid = validateHandle(handle);
  if (invalid) return { error: invalid };

  const { data: existing } = await supabase.from("profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("profiles").update({ handle, display_name: displayName }).eq("user_id", user.id)
    : await supabase.from("profiles").insert({ user_id: user.id, handle, display_name: displayName });
  if (error) {
    if (error.code === "23505") return { error: "이미 다른 사람이 쓰고 있는 주소예요." };
    console.error("save profile failed", error);
    return { error: "저장하지 못했어요." };
  }
  revalidatePath("/", "layout");
  if (!existing) redirect("/dashboard");
  return { ok: true };
}

export async function checkHandle(raw: string) {
  const handle = raw.trim().toLowerCase();
  const invalid = validateHandle(handle);
  if (invalid) return { ok: false, message: invalid };
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("user_id").eq("handle", handle).maybeSingle();
  if (data && data.user_id !== user.id) return { ok: false, message: "이미 사용 중인 주소예요." };
  return { ok: true, message: "사용할 수 있는 주소예요." };
}
