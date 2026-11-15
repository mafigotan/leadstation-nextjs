"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { readTemplateJob, startTemplateJob, type GeneratedGame } from "@/lib/ai/generate-game";

export type TemplateState = { error?: string; ok?: boolean; message?: string };

const BASE = "/admin/event-templates";
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/** Starts AI generation of a new template; the detail page collects the result when it is ready. */
export async function createTemplate(_: TemplateState, formData: FormData): Promise<TemplateState> {
  const { supabase, user } = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const description = String(formData.get("description") ?? "").trim().slice(0, 500);
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 4000);
  if (!name) return { error: "템플릿 이름을 입력해 주세요." };
  if (!prompt) return { error: "AI에게 줄 게임 설명을 입력해 주세요." };
  let batchId: string;
  try {
    batchId = await startTemplateJob(prompt);
  } catch (e) {
    console.error("startTemplateJob failed", e);
    return { error: "AI 작업을 시작하지 못했어요: " + errText(e) };
  }
  const { data, error } = await supabase
    .from("event_templates")
    .insert({ name, description, prompt, created_by: user.id, job_batch_id: batchId, job_kind: "create" })
    .select("id")
    .single();
  if (error || !data) return { error: "저장하지 못했어요: " + error?.message };
  redirect(`${BASE}/${data.id}`);
}

const gameColumns = (g: GeneratedGame) => ({ css: g.css, html: g.html, js: g.js, config: g.config, config_guide: g.guide });

/** Asks AI to change the template (or to try again after a failure). The current game stays usable meanwhile. */
export async function reviseTemplate(id: string, _: TemplateState, formData: FormData): Promise<TemplateState> {
  const { supabase } = await requireSuperAdmin();
  const feedback = String(formData.get("feedback") ?? "").trim().slice(0, 4000);
  const { data: t } = await supabase.from("event_templates").select("*").eq("id", id).single();
  if (!t) return { error: "템플릿을 찾을 수 없어요." };
  if (t.job_batch_id) return { error: "AI가 이미 작업 중이에요. 끝난 뒤에 다시 요청해 주세요." };
  const fresh = t.status !== "ready";
  if (!fresh && !feedback) return { error: "어떻게 고칠지 적어주세요." };
  const prompt = fresh && feedback ? `${t.prompt}\n\n추가 요청: ${feedback}` : t.prompt;
  let batchId: string;
  try {
    batchId = fresh
      ? await startTemplateJob(prompt)
      : await startTemplateJob(t.prompt, { feedback, game: { css: t.css, html: t.html, js: t.js, config: t.config, guide: t.config_guide } });
  } catch (e) {
    console.error("startTemplateJob failed", e);
    return { error: "AI 작업을 시작하지 못했어요: " + errText(e) };
  }
  await supabase
    .from("event_templates")
    .update({
      ...(fresh ? { status: "generating", prompt } : { revising_since: new Date().toISOString() }),
      error: null,
      job_batch_id: batchId,
      job_kind: fresh ? "create" : "revise",
    })
    .eq("id", id);
  revalidatePath(`${BASE}/${id}`);
  return { ok: true, message: "AI가 작업을 시작했어요. 끝나면 이 화면이 자동으로 바뀌어요." };
}

/** Collects a finished AI job. The detail page calls this every few seconds while a job runs. */
export async function pollTemplate(id: string): Promise<{ done: boolean }> {
  const { supabase } = await requireSuperAdmin();
  const { data: t } = await supabase.from("event_templates").select("id, job_batch_id, job_kind").eq("id", id).single();
  if (!t?.job_batch_id) return { done: true };
  let r: Awaited<ReturnType<typeof readTemplateJob>>;
  try {
    r = await readTemplateJob(t.job_batch_id);
  } catch (e) {
    console.error("readTemplateJob failed", e);
    return { done: false };
  }
  if (!r) return { done: false };
  const create = t.job_kind !== "revise";
  const patch = r.game
    ? { ...gameColumns(r.game), status: "ready", error: null }
    : create
      ? { status: "failed", error: r.error }
      : { error: "수정 실패: " + r.error };
  await supabase
    .from("event_templates")
    .update({ ...patch, revising_since: null, job_batch_id: null, job_kind: null })
    .eq("id", id)
    .eq("job_batch_id", t.job_batch_id);
  revalidatePath(BASE, "layout");
  return { done: true };
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

/** 완료 or 반려 for a user's template request; the requester is notified on the dashboard. */
export async function answerTemplateRequest(id: string, status: "done" | "rejected", _: TemplateState, formData: FormData): Promise<TemplateState> {
  const { supabase } = await requireSuperAdmin();
  const templateId = String(formData.get("template_id") ?? "");
  const { error } = await supabase.rpc("answer_event_template_request", {
    p_id: id,
    p_status: status,
    p_note: String(formData.get("note") ?? "").trim().slice(0, 1000),
    p_template: /^[0-9a-f-]{36}$/.test(templateId) ? templateId : null,
  });
  if (error) return { error: "처리하지 못했어요: " + error.message };
  revalidatePath(BASE);
  return { ok: true };
}
