"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/supabase/server";

export type AdminState = { error?: string; ok?: boolean; message?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return DATE_RE.test(s) ? s : null;
};

export async function setSuspended(userId: string, suspend: boolean, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase, user } = await requireSuperAdmin();
  if (userId === user.id) return { error: "내 계정은 정지할 수 없어요." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const { error } = await supabase.rpc("admin_set_suspended", { p_user: userId, p_suspend: suspend, p_reason: reason });
  if (error) return { error: "처리하지 못했어요: " + error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: suspend ? "이용을 정지했어요." : "정지를 풀었어요." };
}

export async function updateSiteAdmin(siteId: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase } = await requireSuperAdmin();
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  const active_from = date(formData.get("active_from"));
  const active_until = date(formData.get("active_until"));
  if (active_from && active_until && active_from > active_until) return { error: "이용 시작일이 종료일보다 늦어요." };
  const { error } = await supabase
    .from("sites")
    .update({
      status,
      active_from,
      active_until,
      service_started_on: date(formData.get("service_started_on")),
      admin_memo: String(formData.get("admin_memo") ?? "").slice(0, 2000),
    })
    .eq("id", siteId);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "저장했어요." };
}

const METHODS = ["transfer", "card", "cash", "other"];

export async function addPayment(siteId: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase } = await requireSuperAdmin();
  const paid_on = date(formData.get("paid_on"));
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d]/g, ""));
  const period_from = date(formData.get("period_from"));
  const period_to = date(formData.get("period_to"));
  const method = String(formData.get("method") ?? "transfer");
  if (!paid_on) return { error: "결제일을 입력해주세요." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "결제 금액을 입력해주세요." };
  if (period_from && period_to && period_from > period_to) return { error: "이용 기간 시작일이 종료일보다 늦어요." };
  const { error } = await supabase.from("site_payments").insert({
    site_id: siteId,
    paid_on,
    amount,
    method: METHODS.includes(method) ? method : "other",
    period_from,
    period_to,
    payer: String(formData.get("payer") ?? "").trim().slice(0, 100),
    memo: String(formData.get("memo") ?? "").trim().slice(0, 1000),
  });
  if (error) return { error: "저장하지 못했어요: " + error.message };

  // Optionally extend the site's period to the paid period and switch it on.
  if (formData.get("extend") === "on" && period_to) {
    const { data: site } = await supabase.from("sites").select("active_from, active_until, service_started_on").eq("id", siteId).single();
    await supabase
      .from("sites")
      .update({
        status: "active",
        active_until: site?.active_until && site.active_until > period_to ? site.active_until : period_to,
        active_from: site?.active_from ?? period_from,
        service_started_on: site?.service_started_on ?? period_from ?? paid_on,
      })
      .eq("id", siteId);
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "결제를 기록했어요." };
}

export async function deletePayment(id: string) {
  const { supabase } = await requireSuperAdmin();
  await supabase.from("site_payments").delete().eq("id", id);
  revalidatePath("/admin", "layout");
}
