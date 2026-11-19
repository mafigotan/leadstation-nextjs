"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { todayKst, validateHandle } from "@/lib/site";
import { LIMIT_COLUMNS, addDays, type LimitColumn } from "@/lib/plans";

export type AdminState = { error?: string; ok?: boolean; message?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return DATE_RE.test(s) ? s : null;
};

/** Empty means no limit. Accepts "1,000,000" style input. */
const limit = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[^\d]/g, "");
  return s ? Number(s) : null;
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

const PLAN_CODES = ["free", "basic", "standard", "pro", "custom"];

/** Per-site limit values from a form (empty = use the plan's value). Storage is entered in GB. */
function readLimits(formData: FormData, prefix = "") {
  const out = {} as Record<LimitColumn, number | null>;
  for (const col of LIMIT_COLUMNS) {
    if (col === "storage_mb_limit") {
      const gb = String(formData.get(prefix + col) ?? "").replace(/[^\d.]/g, "");
      out[col] = gb ? Math.round(Number(gb) * 1024) : null;
    } else out[col] = limit(formData.get(prefix + col));
  }
  return out;
}

const NO_OVERRIDES = Object.fromEntries(LIMIT_COLUMNS.map((c) => [c, null])) as Record<LimitColumn, null>;

/** Super admin sets a site's plan and its own limit values (without a payment). */
export async function updateSitePlan(siteId: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase } = await requireSuperAdmin();
  const planRaw = String(formData.get("plan") ?? "");
  const plan = PLAN_CODES.includes(planRaw) ? planRaw : null;
  const { data: site } = await supabase.from("sites").select("plan").eq("id", siteId).single();
  const changed = (site?.plan ?? null) !== plan;
  // A new plan starts clean: earlier per-site values are dropped (CUSTOM keeps what was typed).
  const limits = changed && plan !== "custom" ? NO_OVERRIDES : readLimits(formData);
  const { error } = await supabase.from("sites").update({ plan, ...limits }).eq("id", siteId);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: changed && plan !== "custom" ? "요금제를 바꿨어요. 개별 조정값은 비우고 새 요금제 한도를 적용했어요." : "저장했어요." };
}

const METHODS = ["transfer", "card", "cash", "other"];

/** Records an offline payment. siteId is empty when the site is chosen in the form (payments page). */
export async function addPayment(siteId: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase } = await requireSuperAdmin();
  siteId = siteId || String(formData.get("site_id") ?? "");
  if (!siteId) return { error: "결제한 사이트를 선택해주세요." };
  const paid_on = date(formData.get("paid_on"));
  const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d]/g, ""));
  const period_from = date(formData.get("period_from"));
  const period_to = date(formData.get("period_to"));
  const method = String(formData.get("method") ?? "transfer");
  const planRaw = String(formData.get("plan") ?? "");
  const plan = PLAN_CODES.includes(planRaw) ? planRaw : null;
  if (!paid_on) return { error: "결제일을 입력해주세요." };
  if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && plan !== "free")) return { error: "결제 금액을 입력해주세요." };
  if (period_from && period_to && period_from > period_to) return { error: "이용 기간 시작일이 종료일보다 늦어요." };
  if (plan && !period_to) return { error: "요금제를 적용하려면 이용 기간을 입력해주세요." };
  const { data: site } = await supabase.from("sites").select("plan, active_from, active_until, service_started_on").eq("id", siteId).single();
  const { error } = await supabase.from("site_payments").insert({
    site_id: siteId,
    plan,
    paid_on,
    amount,
    method: METHODS.includes(method) ? method : "other",
    period_from,
    period_to,
    payer: String(formData.get("payer") ?? "").trim().slice(0, 100),
    memo: String(formData.get("memo") ?? "").trim().slice(0, 1000),
  });
  if (error) return { error: "저장하지 못했어요: " + error.message };

  const today = todayKst();
  if (plan) {
    // Same plan paid right after the current period: the period is extended.
    // Anything else (upgrade, downgrade, a gap): the earlier plan and period are dropped and the new ones apply now.
    const continues = site?.plan === plan && !!site.active_until && !!period_from && period_from <= addDays(site.active_until, 1) && site.active_until >= today;
    const from = continues ? site!.active_from : period_from && period_from <= today ? period_from : today;
    const limits = plan === "custom" ? readLimits(formData, "custom_") : site?.plan === plan ? {} : NO_OVERRIDES;
    const { error: siteErr } = await supabase
      .from("sites")
      .update({
        plan,
        ...limits,
        status: "active",
        active_from: from,
        active_until: continues && site!.active_until! > period_to! ? site!.active_until : period_to,
        service_started_on: site?.service_started_on ?? from ?? paid_on,
      })
      .eq("id", siteId);
    if (siteErr) return { error: "결제는 기록했지만 요금제를 적용하지 못했어요: " + siteErr.message };
  } else if (formData.get("extend") === "on" && period_to) {
    // No plan picked: only extend the period, as before.
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
  return { ok: true, message: plan ? `결제를 기록하고 ${plan.toUpperCase()} 요금제를 적용했어요.` : "결제를 기록했어요." };
}

export async function deletePayment(id: string) {
  const { supabase } = await requireSuperAdmin();
  await supabase.from("site_payments").delete().eq("id", id);
  revalidatePath("/admin", "layout");
}

export async function closeLimitRequest(id: string) {
  const { supabase } = await requireSuperAdmin();
  await supabase.from("limit_requests").update({ status: "done", handled_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin", "layout");
}

const HANDLE_ERRORS: Record<string, string> = {
  "23505": "이미 다른 사이트가 쓰고 있는 주소예요.",
  P0007: "사용할 수 없는 주소예요. 영문 소문자, 숫자, 하이픈(-)으로 3~30자예요.",
};

/** Changes a site's address. Closes the site's open change request and notifies the requester. */
export async function setSiteHandle(siteId: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase } = await requireSuperAdmin();
  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const invalid = validateHandle(handle);
  if (invalid) return { error: invalid };
  const { error } = await supabase.rpc("admin_set_site_handle", {
    p_site: siteId,
    p_handle: handle,
    p_note: String(formData.get("note") ?? "").trim().slice(0, 1000),
  });
  if (error) return { error: HANDLE_ERRORS[error.code] ?? "바꾸지 못했어요: " + error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `사이트 주소를 ${handle} 로 바꿨어요.` };
}

export async function rejectHandleRequest(id: string, _: AdminState, formData: FormData): Promise<AdminState> {
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.rpc("reject_site_handle_request", {
    p_id: id,
    p_note: String(formData.get("note") ?? "").trim().slice(0, 1000),
  });
  if (error) return { error: "처리하지 못했어요: " + error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "요청을 반려했어요." };
}
