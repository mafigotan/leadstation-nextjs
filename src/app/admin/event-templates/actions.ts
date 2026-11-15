"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { generateTemplate, type GeneratedGame } from "@/lib/ai/generate-game";

export type TemplateState = { error?: string; ok?: boolean; message?: string };

const BASE = "/admin/event-templates";
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/** Starts AI generation of a new template; it finishes in the background (up to a few minutes). */
export async function createTemplate(_: TemplateState, formData: FormData): Promise<TemplateState> {
  const { supabase, user } = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 4000);
  if (!name) return { error: "템플릿 이름을 입력해 주세요." };
  if (!prompt) return { error: "AI에게 줄 게임 설명을 입력해 주세요." };
  const { data, error } = await supabase
    .from("event_templates")
    .insert({ name, description, prompt, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: "저장하지 못했어요: " + error?.message };
  const id = data.id;
  after(async () => {
    try {
      const g = await generateTemplate(prompt);
      await supabase.from("event_templates").update({ ...gameColumns(g), status: "ready", error: null }).eq("id", id);
    } catch (e) {
      console.error("generateTemplate failed", e);
      await supabase.from("event_templates").update({ status: "failed", error: errText(e) }).eq("id", id);
    }
  });
  redirect(`${BASE}/${id}`);
}

const gameColumns = (g: GeneratedGame) => ({ css: g.css, html: g.html, js: g.js, config: g.config, config_guide: g.guide });

/** Asks AI to change the template (or to try again after a failure). The current game stays usable meanwhile. */
export async function reviseTemplate(id: string, _: TemplateState, formData: FormData): Promise<TemplateState> {
  const { supabase } = await requireSuperAdmin();
  const feedback = String(formData.get("feedback") ?? "").trim().slice(0, 4000);
  const { data: t } = await supabase.from("event_templates").select("*").eq("id", id).single();
  if (!t) return { error: "템플릿을 찾을 수 없어요." };
  const fresh = t.status !== "ready";
  if (!fresh && !feedback) return { error: "어떻게 고칠지 적어주세요." };
  const prompt = fresh && feedback ? `${t.prompt}\n\n추가 요청: ${feedback}` : t.prompt;
  await supabase
    .from("event_templates")
    .update(fresh ? { status: "generating", error: null, prompt } : { revising_since: new Date().toISOString(), error: null })
    .eq("id", id);
  after(async () => {
    try {
      const g = fresh
        ? await generateTemplate(prompt)
        : await generateTemplate(t.prompt, { feedback, game: { css: t.css, html: t.html, js: t.js, config: t.config, guide: t.config_guide } });
      await supabase.from("event_templates").update({ ...gameColumns(g), status: "ready", error: null, revising_since: null }).eq("id", id);
    } catch (e) {
      console.error("reviseTemplate failed", e);
      await supabase
        .from("event_templates")
        .update(fresh ? { status: "failed", error: errText(e) } : { revising_since: null, error: "수정 실패: " + errText(e) })
        .eq("id", id);
    }
  });
  revalidatePath(`${BASE}/${id}`);
  return { ok: true, message: "AI가 작업을 시작했어요. 몇 분 걸릴 수 있어요." };
}

/** Name, description, order, default settings and visibility. */
export async function updateTemplate(id: string, _: TemplateState, formData: FormData): Promise<TemplateState> {
  const { supabase } = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "템플릿 이름을 입력해 주세요." };
  let config: unknown;
  try {
    config = JSON.parse(String(formData.get("config") ?? "{}"));
  } catch {
    return { error: "기본 설정이 올바른 JSON이 아니에요." };
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) return { error: "기본 설정은 { } 로 감싼 JSON이어야 해요." };
  const { error } = await supabase
    .from("event_templates")
    .update({
      name,
      description: String(formData.get("description") ?? "").trim().slice(0, 500),
      sort_order: Number(formData.get("sort_order")) || 0,
      config,
    })
    .eq("id", id);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath(BASE, "layout");
  return { ok: true, message: "저장했어요." };
}

export async function setTemplatePublic(id: string, isPublic: boolean) {
  const { supabase } = await requireSuperAdmin();
  await supabase.from("event_templates").update({ is_public: isPublic }).eq("id", id).eq("status", "ready");
  revalidatePath(BASE, "layout");
}

export async function deleteTemplate(id: string) {
  const { supabase } = await requireSuperAdmin();
  await supabase.from("event_templates").delete().eq("id", id);
  revalidatePath(BASE);
  redirect(BASE);
}
