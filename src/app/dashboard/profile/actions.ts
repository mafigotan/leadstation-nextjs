"use server";

import { revalidatePath } from "next/cache";
import { requireSite, requireSiteAdmin, requireUser } from "@/lib/supabase/server";
import { validateHandle } from "@/lib/site";
import { checkLimit, limitMessage } from "@/lib/usage";
import { readPersonalInfo, type FormState } from "@/app/welcome/actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function done(message: string): FormState {
  revalidatePath("/dashboard", "layout");
  return { ok: true, message };
}

export async function saveMyInfo(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const info = await readPersonalInfo(formData);
  if ("error" in info) return { error: info.error };
  const { error } = await supabase.from("profiles").update(info.values).eq("user_id", user.id);
  if (error) return { error: "저장하지 못했어요." };
  return done("내 정보를 저장했어요.");
}

export async function saveSite(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, site } = await requireSiteAdmin().catch(() => ({ supabase: null, site: null }));
  if (!supabase || !site) return { error: "사이트 관리자만 바꿀 수 있어요." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const { error } = await supabase.from("sites").update({ name }).eq("id", site.id);
  if (error) return { error: "저장하지 못했어요." };
  return done("사이트 이름을 저장했어요.");
}

/** Site admins cannot change the address themselves: they ask the super admins. */
export async function requestHandleChange(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, site } = await requireSiteAdmin().catch(() => ({ supabase: null, site: null }));
  if (!supabase || !site) return { error: "사이트 관리자만 주소 변경을 요청할 수 있어요." };
  const handle = String(formData.get("handle") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  if (handle === site.handle) return { error: "지금 쓰고 있는 주소예요. 바꿀 주소를 입력해주세요." };
  const invalid = validateHandle(handle);
  if (invalid) return { error: invalid };
  const { error } = await supabase.rpc("request_site_handle_change", { p_new_handle: handle, p_reason: reason });
  if (error) {
    if (error.code === "23505") return { error: "이미 다른 사람이 쓰고 있는 사이트 주소예요." };
    if (error.code === "P0005") return { error: "이미 처리 중인 주소 변경 요청이 있어요." };
    if (error.code === "P0006") return { error: "지금 쓰고 있는 주소예요." };
    if (error.code === "P0007") return { error: "사용할 수 없는 주소예요." };
    console.error("handle request failed", error);
    return { error: "요청하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
  return done("주소 변경을 요청했어요. 운영팀이 확인 후 바꿔드릴게요.");
}

export async function cancelHandleRequest(id: string): Promise<FormState> {
  const { supabase } = await requireSiteAdmin();
  const { error } = await supabase.rpc("cancel_site_handle_request", { p_id: id });
  if (error) return { error: "취소하지 못했어요." };
  return done("주소 변경 요청을 취소했어요.");
}

export type SiteInfo = {
  logo_url: string;
  company_name: string;
  ceo_name: string;
  business_no: string;
  address: string;
  contact_phone: string;
  contact_email: string;
};

/** Logo and footer information shown on the public user site. */
export async function saveSiteInfo(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, site } = await requireSiteAdmin().catch(() => ({ supabase: null, site: null }));
  if (!supabase || !site) return { error: "사이트 관리자만 바꿀 수 있어요." };
  const text = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const logo = text("logo_url", 2000);
  if (logo && !/^https:\/\//i.test(logo)) return { error: "로고 이미지 주소는 https:// 로 시작해야 해요." };
  const email = text("contact_email", 200).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { error: "이메일 형식을 확인해 주세요." };
  const info: SiteInfo = {
    logo_url: logo,
    company_name: text("company_name", 100),
    ceo_name: text("ceo_name", 50),
    business_no: text("business_no", 30),
    address: text("address", 300),
    contact_phone: text("contact_phone", 30),
    contact_email: email,
  };
  const { error } = await supabase.from("sites").update(info).eq("id", site.id);
  if (error) return { error: "저장하지 못했어요." };
  return done("사이트 표시 정보를 저장했어요.");
}

export async function addMember(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, site } = await requireSiteAdmin().catch(() => ({ supabase: null, site: null }));
  if (!supabase || !site) return { error: "사이트 관리자만 사용자를 추가할 수 있어요." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "admin" ? "admin" : "member";
  if (!EMAIL_RE.test(email)) return { error: "이메일 주소를 확인해주세요." };
  // Member limit (members and open invites): only a new person counts.
  const [{ data: members }, { data: invited }] = await Promise.all([
    supabase.rpc("site_member_list", { p_site: site.id }),
    supabase.from("site_invites").select("id").eq("site_id", site.id).eq("email", email).limit(1),
  ]);
  const known = ((members ?? []) as { email: string }[]).some((m) => m.email?.toLowerCase() === email) || !!invited?.length;
  if (!known) {
    try {
      await checkLimit(supabase, site.id, "members", 1);
    } catch (e) {
      return { error: limitMessage(e) ?? "멤버 한도를 확인하지 못했어요." };
    }
  }
  const { data, error } = await supabase.rpc("add_site_member", { p_site: site.id, p_email: email, p_role: role });
  if (error) {
    console.error("add member failed", error);
    return { error: "추가하지 못했어요." };
  }
  return done(
    data === "added"
      ? `${email} 님을 사이트 ${role === "admin" ? "관리자" : "사용자"}로 추가했어요.`
      : `${email} 님은 아직 가입하지 않았어요. 이 이메일로 가입하면 자동으로 사이트에 추가돼요.`,
  );
}

async function adminCount(supabase: Awaited<ReturnType<typeof requireSite>>["supabase"], siteId: string) {
  const { count } = await supabase.from("site_members").select("user_id", { count: "exact", head: true }).eq("site_id", siteId).eq("role", "admin");
  return count ?? 0;
}

export async function setMemberRole(userId: string, role: "admin" | "member"): Promise<FormState> {
  const { supabase, site } = await requireSiteAdmin().catch(() => ({ supabase: null, site: null }));
  if (!supabase || !site) return { error: "사이트 관리자만 권한을 바꿀 수 있어요." };
  if (role === "member") {
    const { data: m } = await supabase.from("site_members").select("role").eq("site_id", site.id).eq("user_id", userId).maybeSingle();
    if (m?.role === "admin" && (await adminCount(supabase, site.id)) <= 1) return { error: "관리자가 최소 한 명은 있어야 해요." };
  }
  const { error } = await supabase.from("site_members").update({ role }).eq("site_id", site.id).eq("user_id", userId);
  if (error) return { error: "바꾸지 못했어요." };
  return done("권한을 바꿨어요.");
}

/** Admins remove anyone; anyone can leave a site themselves. The last admin cannot leave. */
export async function removeMember(userId: string): Promise<FormState> {
  const { supabase, site, role, user } = await requireSite();
  if (role !== "admin" && userId !== user.id) return { error: "사이트 관리자만 사용자를 삭제할 수 있어요." };
  const { data: m } = await supabase.from("site_members").select("role").eq("site_id", site.id).eq("user_id", userId).maybeSingle();
  if (!m) return { error: "이미 삭제된 사용자예요." };
  if (m.role === "admin" && (await adminCount(supabase, site.id)) <= 1) return { error: "관리자가 최소 한 명은 있어야 해요. 다른 사람을 먼저 관리자로 지정해주세요." };
  const { error } = await supabase.from("site_members").delete().eq("site_id", site.id).eq("user_id", userId);
  if (error) return { error: "삭제하지 못했어요." };
  return done(userId === user.id ? "사이트에서 나왔어요." : "사용자를 삭제했어요.");
}

export async function cancelInvite(id: string): Promise<FormState> {
  const { supabase, site } = await requireSiteAdmin().catch(() => ({ supabase: null, site: null }));
  if (!supabase || !site) return { error: "사이트 관리자만 할 수 있어요." };
  await supabase.from("site_invites").delete().eq("id", id).eq("site_id", site.id);
  return done("초대를 취소했어요.");
}

export async function switchSite(siteId: string): Promise<FormState> {
  const { supabase, user, memberships } = await requireSite();
  if (!memberships.some((m) => m.site.id === siteId)) return { error: "이 사이트의 멤버가 아니에요." };
  await supabase.from("profiles").update({ active_site_id: siteId }).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
