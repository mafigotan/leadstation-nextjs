"use server";

import { revalidatePath } from "next/cache";
import { requireSite, requireUser } from "@/lib/supabase/server";

export async function markNotificationRead(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/dashboard");
}

/** Admin approves or declines a request to use the site. */
export async function answerJoinRequest(requestId: string, approve: boolean) {
  const { supabase, role } = await requireSite();
  if (role !== "admin") return;
  const { error } = await supabase.rpc("answer_join_request", { p_id: requestId, p_approve: approve });
  if (error) console.error("answer join request failed", error);
  revalidatePath("/dashboard", "layout");
}

const KIND_LABEL: Record<string, string> = { newsletter: "뉴스레터 발송 건수", text: "AI 본문 생성 토큰", image: "AI 이미지 생성 토큰" };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Super admin email addresses (service role), plus ADMIN_NOTIFY_EMAIL if set. */
async function superAdminEmails() {
  const out = new Set((process.env.ADMIN_NOTIFY_EMAIL ?? "").split(/[,\s]+/).filter(Boolean));
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("platform_admins").select("user_id");
    for (const r of data ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(r.user_id);
      if (u.user?.email) out.add(u.user.email);
    }
  }
  return [...out];
}

/** "이용 한도 늘리기": records the request and emails the super admins. */
export async function requestLimitIncrease(kinds: string[], message: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, profile, site } = await requireSite();
  const picked = kinds.filter((k) => k in KIND_LABEL);
  if (!picked.length) return { error: "늘릴 항목을 하나 이상 골라주세요." };
  const { error } = await supabase.rpc("request_limit_increase", { p_kinds: picked, p_message: message.slice(0, 1000) });
  if (error) {
    if (error.code === "P0004") return { error: "이미 요청을 보냈어요. 운영팀이 확인하고 있어요. (12시간 뒤 다시 요청할 수 있어요)" };
    console.error("limit request failed", error);
    return { error: "요청을 보내지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  try {
    const { loadUsage } = await import("@/lib/usage");
    const { sendOne } = await import("@/lib/newsletter/mailer");
    const { siteUrl } = await import("@/lib/site");
    const usage = await loadUsage(supabase, site.id);
    const rows = usage
      .map((u) => `<tr><td style="padding:4px 12px 4px 0">${KIND_LABEL[u.kind]}${picked.includes(u.kind) ? " <b>(요청)</b>" : ""}</td><td>${u.used.toLocaleString()} / ${u.limit_value === null ? "무제한" : u.limit_value.toLocaleString()}</td></tr>`)
      .join("");
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">
      <p><b>${esc(site.name || site.handle)}</b> (${esc(site.handle)}) 사이트에서 이용 한도 증설을 요청했어요.</p>
      <p>요청자: ${esc(profile.full_name)} &lt;${esc(user.email ?? "")}&gt;</p>
      <p>요청 항목: ${picked.map((k) => KIND_LABEL[k]).join(", ")}</p>
      ${message.trim() ? `<p>메시지: ${esc(message.trim())}</p>` : ""}
      <p>이번 달 사용량</p><table>${rows}</table>
      <p><a href="${siteUrl()}/admin/sites/${site.id}">슈퍼 관리자 화면에서 한도 변경하기</a></p></div>`;
    const to = await superAdminEmails();
    for (const addr of to) {
      await sendOne({ to: addr, subject: `[LEADstation] 이용 한도 증설 요청: ${site.name || site.handle}`, html, fromName: "LEADstation", replyTo: user.email ?? undefined });
    }
    if (!to.length) console.warn("limit request: no super admin email (set SUPABASE_SERVICE_ROLE_KEY or ADMIN_NOTIFY_EMAIL)");
  } catch (e) {
    // The request is saved and shows in the super admin screen even if the email fails.
    console.error("limit request email failed", e);
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
