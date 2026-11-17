"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { limitMessage, metered } from "@/lib/usage";
import { generatePageContent } from "@/lib/ai/generate-page";
import { fillTemplateFields, suggestFieldText } from "@/lib/ai/generate-game";
import { buildConfig, getPath, templateFields, type TemplateField } from "@/lib/event-fields";
import type { EventGame } from "@/lib/event-game";
import { makeSlug } from "@/lib/slug";
import { SLUG_RE } from "@/lib/site";
import { sanitizeSections, toSections, withSections, type Section } from "@/lib/page-sections";
import { listTermOptions } from "@/lib/terms";
import { cleanFields } from "@/lib/lead-fields";
import { BriefSchema, THEMES, type PageContent, type Theme } from "@/lib/types";

export type FormState = { error?: string; saved?: boolean };

export async function createPage(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, site } = await requireSite();

  const parsed = BriefSchema.safeParse({
    product: formData.get("product"),
    description: formData.get("description"),
    audience: formData.get("audience") ?? "",
    offer: formData.get("offer") ?? "",
    tone: formData.get("tone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const withForm = formData.get("lead_form") !== "off";
  const leadFields = withForm ? cleanFields(formData.getAll("lead_fields")) : [];
  const leadRequired = cleanFields(formData.getAll("lead_required")).filter((f) => leadFields.includes(f));
  if (withForm && !leadFields.length) return { error: "신청 폼에 넣을 필드를 하나 이상 선택해 주세요." };
  const brief = { ...parsed.data, lead_fields: leadFields };

  let content: PageContent;
  try {
    const generated = await metered(supabase, site.id, ["text"], () => generatePageContent(brief));
    const sections = toSections(generated).flatMap((s) => (s.type !== "form" ? [s] : withForm ? [{ ...s, fields: leadFields, required: leadRequired }] : []));
    content = withSections(generated, sections);
  } catch (e) {
    console.error("generatePageContent failed", e);
    // Outside production, show the cause so staging problems can be found without the logs.
    const cause = process.env.VERCEL_ENV === "production" ? "" : ` (원인: ${!process.env.ANTHROPIC_API_KEY ? "ANTHROPIC_API_KEY 환경 변수가 없어요" : e instanceof Error ? e.message.slice(0, 300) : String(e)})`;
    return { error: limitMessage(e) ?? (e instanceof Error && e.message.startsWith("AI") ? e.message : "페이지 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요." + cause) };
  }

  const { data, error } = await supabase
    .from("pages")
    .insert({
      site_id: site.id, user_id: user.id,
      title: parsed.data.product,
      slug: makeSlug(),
      brief,
      content,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("insert page failed", error);
    return { error: "페이지를 저장하지 못했어요." };
  }

  revalidatePath("/dashboard/pages");
  redirect(`/dashboard/pages/${data.id}`);
}

export async function setPublished(id: string, published: boolean) {
  const { supabase } = await requireSite();
  await supabase
    .from("pages")
    .update({ status: published ? "published" : "draft" })
    .eq("id", id);
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
}

export async function deletePage(id: string) {
  const { supabase } = await requireSite();
  await supabase.from("pages").delete().eq("id", id);
  revalidatePath("/dashboard/pages");
  redirect("/dashboard/pages");
}

export async function updateSlug(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSite();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { error: "영문 소문자, 숫자, 하이픈(-)으로 1~50자로 정해주세요." };
  if (slug === "blog") return { error: "blog는 블로그 주소로 쓰여서 사용할 수 없어요." };
  if (slug === "promotions") return { error: "promotions는 프로모션 목록 주소로 쓰여서 사용할 수 없어요." };
  const { data, error } = await supabase.from("pages").update({ slug }).eq("id", id).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "이미 다른 페이지에서 쓰고 있는 주소예요." : "주소를 바꾸지 못했어요." };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return { saved: true };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Promotion period shown on the user site (진행 중 / 종료). Empty dates mean no limit. */
export async function updatePeriod(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSite();
  const read = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return DATE_RE.test(v) ? v : null;
  };
  const starts_on = read("starts_on");
  const ends_on = read("ends_on");
  if (starts_on && ends_on && starts_on > ends_on) return { error: "종료일은 시작일과 같거나 뒤여야 해요." };
  const { data, error } = await supabase.from("pages").update({ starts_on, ends_on }).eq("id", id).select("id").single();
  if (error || !data) return { error: "기간을 저장하지 못했어요." };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return { saved: true };
}

/** A form with its own terms needs a required privacy term, and pinned versions must be published versions of that term. */
async function checkFormTerms(supabase: Awaited<ReturnType<typeof requireSite>>["supabase"], siteId: string, sections: Section[]): Promise<string | null> {
  const form = sections.find((s) => s.type === "form");
  if (!form?.terms) return null;
  const options = await listTermOptions(supabase, siteId);
  const byId = new Map(options.map((o) => [o.id, o]));
  for (const t of form.terms) {
    const o = byId.get(t.term_id);
    if (!o) return "신청 폼에 찾을 수 없는 약관이 있어요. 약관 설정에서 빼거나 바꿔 주세요.";
    if (t.version_id && !o.versions.some((v) => v.id === t.version_id)) return `‘${o.title}’에서 고른 버전을 찾을 수 없어요.`;
  }
  if (!form.terms.some((t) => t.required && byId.get(t.term_id)?.kind === "privacy")) {
    return "신청 폼에는 필수 ‘개인정보 수집·이용’ 약관이 하나 이상 있어야 해요. 신청 폼을 누르고 ‘약관’에서 설정해 주세요.";
  }
  return null;
}

export async function savePageSections(
  id: string,
  input: { title: string; theme: string; sections: unknown },
): Promise<{ error?: string }> {
  const { supabase, site } = await requireSite();
  const { data: page } = await supabase.from("pages").select("content").eq("id", id).eq("site_id", site.id).single();
  if (!page) return { error: "페이지를 찾을 수 없어요." };
  const enforced = await enforceTemplateGames(supabase, sanitizeSections(input.sections));
  if (enforced.error) return { error: enforced.error };
  const sections = enforced.sections;
  const termsError = await checkFormTerms(supabase, site.id, sections);
  if (termsError) return { error: termsError };
  const theme = (THEMES as readonly string[]).includes(input.theme) ? (input.theme as Theme) : "indigo";
  const content = withSections({ ...(page.content as PageContent), theme }, sections);
  const title = String(input.title ?? "").trim().slice(0, 200) || content.headline;
  const { error } = await supabase.from("pages").update({ title, content }).eq("id", id);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return {};
}

export type TemplateOption = { id: string; name: string; description: string; game: EventGame; fields: TemplateField[] };

/** Published event templates (with their default settings and editable fields) for the editor. */
export async function listEventTemplates(): Promise<TemplateOption[]> {
  const { supabase } = await requireSite();
  const { data } = await supabase
    .from("event_templates")
    .select("id, name, description, css, html, js, config, fields")
    .eq("is_public", true)
    .eq("status", "ready")
    .order("sort_order")
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    game: { css: t.css, html: t.html, js: t.js, config: t.config, template_id: t.id },
    fields: templateFields(t.fields, t.config ?? {}),
  }));
}

async function readTemplate(supabase: Awaited<ReturnType<typeof requireSite>>["supabase"], id: string) {
  const { data: t } = await supabase
    .from("event_templates")
    .select("id, name, css, html, js, config, config_guide, fields")
    .eq("id", id)
    .eq("is_public", true)
    .eq("status", "ready")
    .maybeSingle();
  return t ? { ...t, config: (t.config ?? {}) as Record<string, unknown>, fieldList: templateFields(t.fields, t.config ?? {}) } : null;
}

const aiError = (e: unknown, fallback: string) => limitMessage(e) ?? (e instanceof Error && e.message.startsWith("AI") ? e.message : fallback);

/** AI fills the template's AI-fillable fields for this promotion; everything else stays as the user has it. */
export async function fillEventFields(templateId: string, request: string, context: string, values: unknown): Promise<{ values?: Record<string, unknown>; error?: string }> {
  const { supabase, site } = await requireSite();
  const t = await readTemplate(supabase, templateId);
  if (!t) return { error: "템플릿을 찾을 수 없어요." };
  const current = buildConfig(t.fieldList, t.config, values).config;
  const targets = t.fieldList.filter((f) => f.user_edit && f.ai_fill);
  if (!targets.length) return { error: "이 템플릿은 AI로 채울 항목이 없어요." };
  try {
    const filled = await metered(supabase, site.id, ["text"], () =>
      fillTemplateFields(t, targets, Object.fromEntries(targets.map((f) => [f.key, getPath(current, f.key)])), String(request ?? "").trim().slice(0, 1000), String(context ?? "").slice(0, 1000)),
    );
    let next = current;
    for (const f of targets) if (f.key in filled) next = buildConfig([f], next, { ...next, ...nest(f.key, filled[f.key]) }).config;
    return { values: next };
  } catch (e) {
    console.error("fillTemplateFields failed", e);
    return { error: aiError(e, "AI로 채우지 못했어요. 잠시 후 다시 시도해 주세요.") };
  }
}

const nest = (path: string, value: unknown): Record<string, unknown> => path.split(".").reduceRight<unknown>((acc, k) => ({ [k]: acc }), value) as Record<string, unknown>;

/** Three alternatives for one text field. */
export async function suggestEventText(templateId: string, key: string, current: string, request: string, context: string): Promise<{ options?: string[]; error?: string }> {
  const { supabase, site } = await requireSite();
  const t = await readTemplate(supabase, templateId);
  const f = t?.fieldList.find((x) => x.key === key && x.user_edit && x.ai_fill && (x.type === "text" || x.type === "textarea"));
  if (!t || !f) return { error: "이 항목은 AI로 바꿀 수 없어요." };
  try {
    const options = await metered(supabase, site.id, ["text"], () =>
      suggestFieldText(t.name, f, String(current ?? "").slice(0, 2000), String(request ?? "").trim().slice(0, 300), String(context ?? "").slice(0, 1000)),
    );
    return options.length ? { options } : { error: "제안을 만들지 못했어요. 다시 시도해 주세요." };
  } catch (e) {
    console.error("suggestFieldText failed", e);
    return { error: aiError(e, "제안을 만들지 못했어요. 잠시 후 다시 시도해 주세요.") };
  }
}

/**
 * Template-based games always run the template's current code, and only its user-editable fields may differ
 * from the default. Returns an error when a field value cannot be used (e.g. prize weights not adding up).
 */
async function enforceTemplateGames(supabase: Awaited<ReturnType<typeof requireSite>>["supabase"], sections: Section[]): Promise<{ sections: Section[]; error?: string }> {
  const out: Section[] = [];
  for (const s of sections) {
    const g = s.type === "event" ? s.game : undefined;
    const t = g?.template_id ? await readTemplate(supabase, g.template_id) : null;
    if (!g || !t) {
      out.push(s);
      continue;
    }
    const { config, errors } = buildConfig(t.fieldList, t.config, g.config);
    const bad = Object.keys(errors)[0];
    if (bad) return { sections, error: `이벤트 설정을 확인해 주세요. ${t.fieldList.find((f) => f.key === bad)?.label ?? bad}: ${errors[bad]}` };
    out.push({ ...s, game: { css: t.css, html: t.html, js: t.js, config, template_id: t.id } });
  }
  return { sections: out };
}

export type TemplateRequest = { id: string; game_type: string; description: string; status: string; admin_note: string; created_at: string };

/** This site's recent template requests, newest first. */
export async function listTemplateRequests(): Promise<TemplateRequest[]> {
  const { supabase, site } = await requireSite();
  const { data } = await supabase
    .from("event_template_requests")
    .select("id, game_type, description, status, admin_note, created_at")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

/** Asks the super admins for a new event template and emails them. */
export async function requestEventTemplate(input: { gameType: string; description: string; usage: string }): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, profile, site } = await requireSite();
  const gameType = String(input.gameType ?? "").trim().slice(0, 50);
  const description = String(input.description ?? "").trim().slice(0, 2000);
  const usage = String(input.usage ?? "").trim().slice(0, 1000);
  if (!description) return { error: "원하는 게임을 설명해 주세요." };
  const { error } = await supabase.rpc("request_event_template", { p_game_type: gameType, p_description: description, p_usage: usage });
  if (error) {
    if (error.code === "P0005") return { error: "처리 중인 요청이 이미 3건 있어요. 답변을 받은 뒤 다시 요청해 주세요." };
    console.error("template request failed", error);
    return { error: "요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  try {
    const { esc, superAdminEmails } = await import("@/lib/admin-notify");
    const { sendOne } = await import("@/lib/newsletter/mailer");
    const { siteUrl } = await import("@/lib/site");
    const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">
      <p><b>${esc(site.name || site.handle)}</b> (${esc(site.handle)}) 사이트에서 새 이벤트 템플릿을 요청했어요.</p>
      <p>요청자: ${esc(profile.full_name)} &lt;${esc(user.email ?? "")}&gt;</p>
      ${gameType ? `<p>게임 종류: ${esc(gameType)}</p>` : ""}
      <p>원하는 게임:<br>${esc(description).replace(/\n/g, "<br>")}</p>
      ${usage ? `<p>사용할 프로모션:<br>${esc(usage).replace(/\n/g, "<br>")}</p>` : ""}
      <p><a href="${siteUrl()}/admin/event-templates">슈퍼 관리자 화면에서 확인하기</a></p></div>`;
    for (const to of await superAdminEmails()) {
      await sendOne({ to, subject: `[LEADstation] 이벤트 템플릿 요청: ${site.name || site.handle}`, html, fromName: "LEADstation", replyTo: user.email ?? undefined });
    }
  } catch (e) {
    // The request is saved and shows in the super admin screen even if the email fails.
    console.error("template request email failed", e);
  }
  return { ok: true };
}

/** Sends the applicant thank-you email (with the editor's unsaved settings and sample answers) to the signed-in user. */
export async function sendApplicantMailTest(pageId: string, mail: unknown, fields: unknown): Promise<{ ok?: string; error?: string }> {
  const { supabase, user, site } = await requireSite();
  if (!user.email) return { error: "내 계정에 이메일이 없어요." };
  const { data: page } = await supabase.from("pages").select("title, slug").eq("id", pageId).eq("site_id", site.id).maybeSingle();
  if (!page) return { error: "페이지를 찾을 수 없어요." };
  const { PUBLIC_SITE_COLUMNS } = await import("@/lib/user-site");
  const { data: full } = await supabase.from("sites").select(PUBLIC_SITE_COLUMNS).eq("id", site.id).maybeSingle();
  if (!full) return { error: "사이트 정보를 불러오지 못했어요." };
  const { applicantEmail, sampleNotice, sanitizeApplicantMail, siteDisplayName } = await import("@/lib/lead-mail-template");
  const { mailProvider, sendOne } = await import("@/lib/newsletter/mailer");
  if (!mailProvider()) return { error: "메일 발송 설정이 없어요." };
  const s = full as unknown as import("@/lib/user-site").PublicSite;
  const { subject, html } = applicantEmail(sampleNotice(s, page.title, cleanFields(fields)), s, sanitizeApplicantMail(mail));
  try {
    await sendOne({ to: user.email, subject: `[테스트] ${subject}`, html, fromName: siteDisplayName(s), replyTo: s.contact_email || undefined });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "발송하지 못했어요." };
  }
  return { ok: `${user.email}(으)로 테스트 메일을 보냈어요.` };
}
