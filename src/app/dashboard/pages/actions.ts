"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { limitMessage, metered } from "@/lib/usage";
import { generatePageContent } from "@/lib/ai/generate-page";
import { fillTemplateConfig, generateFreeGame } from "@/lib/ai/generate-game";
import type { EventGame } from "@/lib/event-game";
import { makeSlug } from "@/lib/slug";
import { SLUG_RE } from "@/lib/site";
import { sanitizeSections, toSections, withSections } from "@/lib/page-sections";
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
  if (withForm && !leadFields.length) return { error: "신청 폼에 넣을 필드를 하나 이상 선택해 주세요." };
  const brief = { ...parsed.data, lead_fields: leadFields };

  let content: PageContent;
  try {
    const generated = await metered(supabase, site.id, ["text"], () => generatePageContent(brief));
    const sections = toSections(generated).flatMap((s) => (s.type !== "form" ? [s] : withForm ? [{ ...s, fields: leadFields }] : []));
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
  const { data, error } = await supabase.from("pages").update({ slug }).eq("id", id).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "이미 다른 페이지에서 쓰고 있는 주소예요." : "주소를 바꾸지 못했어요." };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return { saved: true };
}

export async function savePageSections(
  id: string,
  input: { title: string; theme: string; sections: unknown },
): Promise<{ error?: string }> {
  const { supabase, site } = await requireSite();
  const { data: page } = await supabase.from("pages").select("content").eq("id", id).eq("site_id", site.id).single();
  if (!page) return { error: "페이지를 찾을 수 없어요." };
  const sections = sanitizeSections(input.sections);
  const theme = (THEMES as readonly string[]).includes(input.theme) ? (input.theme as Theme) : "indigo";
  const content = withSections({ ...(page.content as PageContent), theme }, sections);
  const title = String(input.title ?? "").trim().slice(0, 200) || content.headline;
  const { error } = await supabase.from("pages").update({ title, content }).eq("id", id);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath(`/dashboard/pages/${id}`);
  revalidatePath("/dashboard/pages");
  return {};
}

/** Makes a one-off game for an event element (saved with the page by the editor). */
export async function generateEventGame(description: string, context: string): Promise<{ game?: EventGame; error?: string }> {
  const { supabase, site } = await requireSite();
  const desc = String(description ?? "").trim().slice(0, 1000);
  if (!desc) return { error: "어떤 게임을 만들지 적어주세요." };
  try {
    const g = await metered(supabase, site.id, ["text"], () => generateFreeGame(desc, String(context ?? "").slice(0, 1000)));
    return { game: { css: g.css, html: g.html, js: g.js, config: g.config } };
  } catch (e) {
    console.error("generateFreeGame failed", e);
    return { error: limitMessage(e) ?? (e instanceof Error && e.message.startsWith("AI") ? e.message : "게임을 만들지 못했어요. 잠시 후 다시 시도해 주세요.") };
  }
}

export type TemplateOption = { id: string; name: string; description: string; game: EventGame };

/** Published event templates (with their default settings) for the editor. */
export async function listEventTemplates(): Promise<TemplateOption[]> {
  const { supabase } = await requireSite();
  const { data } = await supabase
    .from("event_templates")
    .select("id, name, description, css, html, js, config")
    .eq("is_public", true)
    .eq("status", "ready")
    .order("sort_order")
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, description: t.description, game: { css: t.css, html: t.html, js: t.js, config: t.config, template_id: t.id } }));
}

/** A template's game; with a request, AI first adjusts its settings (prizes, texts, colors) for this promotion. */
export async function applyEventTemplate(templateId: string, request: string, context: string): Promise<{ game?: EventGame; error?: string }> {
  const { supabase, site } = await requireSite();
  const { data: t } = await supabase
    .from("event_templates")
    .select("id, name, css, html, js, config, config_guide")
    .eq("id", templateId)
    .eq("is_public", true)
    .eq("status", "ready")
    .maybeSingle();
  if (!t) return { error: "템플릿을 찾을 수 없어요." };
  const game: EventGame = { css: t.css, html: t.html, js: t.js, config: t.config, template_id: t.id };
  const req = String(request ?? "").trim().slice(0, 1000);
  if (!req) return { game };
  try {
    game.config = await metered(supabase, site.id, ["text"], () => fillTemplateConfig(t, req, String(context ?? "").slice(0, 1000)));
    return { game };
  } catch (e) {
    console.error("fillTemplateConfig failed", e);
    return { error: limitMessage(e) ?? (e instanceof Error && e.message.startsWith("AI") ? e.message : "설정을 적용하지 못했어요. 잠시 후 다시 시도해 주세요.") };
  }
}
