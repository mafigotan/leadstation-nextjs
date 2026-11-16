"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { isTermKind, termTemplate } from "@/lib/terms";
import { linkedPages } from "./linked";

export type TermInput = { title: string; kind: string; label: string; body: string; change_note: string };
export type TermResult = { error?: string; ok?: string };

function clean(input: TermInput) {
  return {
    title: String(input.title ?? "").trim().slice(0, 200),
    kind: isTermKind(input.kind) ? input.kind : "other",
    label: String(input.label ?? "").trim().slice(0, 200),
    body: String(input.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, 20000),
    change_note: String(input.change_note ?? "").trim().slice(0, 300),
  };
}

export async function createTerm(formData: FormData) {
  const { supabase, site, user } = await requireSite();
  const kind = isTermKind(formData.get("kind")) ? (formData.get("kind") as string) : "privacy";
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || "새 약관";
  const { data: term, error } = await supabase.from("terms").insert({ site_id: site.id, title, kind }).select("id").single();
  if (error || !term) throw new Error("약관을 만들지 못했어요: " + (error?.message ?? ""));
  const t = termTemplate(kind as Parameters<typeof termTemplate>[0], site.name || site.handle);
  await supabase.from("term_versions").insert({ term_id: term.id, version: 1, label: t.label || title, body: t.body, created_by: user.id });
  revalidatePath("/dashboard/terms");
  redirect(`/dashboard/terms/${term.id}`);
}

async function loadTerm(termId: string) {
  const ctx = await requireSite();
  const { data: term } = await ctx.supabase.from("terms").select("id, archived_at").eq("id", termId).eq("site_id", ctx.site.id).maybeSingle();
  return { ...ctx, term };
}

/** Saves the term's name and kind and its draft (a new draft version when there is none). Returns the draft id. */
async function writeDraft(termId: string, input: TermInput): Promise<{ error?: string; draftId?: string }> {
  const { supabase, user, term } = await loadTerm(termId);
  if (!term) return { error: "약관을 찾을 수 없어요." };
  if (term.archived_at) return { error: "보관된 약관은 고칠 수 없어요. 먼저 보관을 해제해 주세요." };
  const v = clean(input);
  if (!v.title) return { error: "약관 이름을 입력해 주세요." };
  if (!v.label) return { error: "신청 폼에 보이는 동의 문구를 입력해 주세요." };

  const { error: termError } = await supabase.from("terms").update({ title: v.title, kind: v.kind }).eq("id", termId);
  if (termError) return { error: "저장하지 못했어요: " + termError.message };

  const { data: versions } = await supabase.from("term_versions").select("id, version, published_at").eq("term_id", termId);
  const draft = versions?.find((x) => !x.published_at);
  const fields = { label: v.label, body: v.body, change_note: v.change_note };
  if (draft) {
    const { error } = await supabase.from("term_versions").update(fields).eq("id", draft.id);
    if (error) return { error: "저장하지 못했어요: " + error.message };
    return { draftId: draft.id };
  }
  const next = Math.max(0, ...(versions ?? []).map((x) => x.version)) + 1;
  const { data: created, error } = await supabase
    .from("term_versions")
    .insert({ term_id: termId, version: next, ...fields, created_by: user.id })
    .select("id")
    .single();
  if (error || !created) return { error: "저장하지 못했어요: " + (error?.message ?? "") };
  return { draftId: created.id };
}

export async function saveTermDraft(termId: string, input: TermInput): Promise<TermResult> {
  const r = await writeDraft(termId, input);
  if (r.error) return { error: r.error };
  revalidatePath(`/dashboard/terms/${termId}`);
  revalidatePath("/dashboard/terms");
  return { ok: "임시 저장했어요. 발행하기 전까지 신청 폼에는 지금 버전이 보여요." };
}

export async function publishTerm(termId: string, input: TermInput): Promise<TermResult> {
  if (!clean(input).body) return { error: "약관 전문을 입력해 주세요." };
  const r = await writeDraft(termId, input);
  if (r.error || !r.draftId) return { error: r.error ?? "저장하지 못했어요." };
  const { supabase } = await requireSite();
  const { error } = await supabase.from("term_versions").update({ published_at: new Date().toISOString() }).eq("id", r.draftId);
  if (error) return { error: "발행하지 못했어요: " + error.message };
  revalidatePath(`/dashboard/terms/${termId}`);
  revalidatePath("/dashboard/terms");
  return { ok: "발행했어요. ‘최신 버전 자동’으로 연결된 프로모션에 바로 반영돼요." };
}

export async function deleteTermDraft(termId: string): Promise<TermResult> {
  const { supabase, term } = await loadTerm(termId);
  if (!term) return { error: "약관을 찾을 수 없어요." };
  const { data: published } = await supabase.from("term_versions").select("id").eq("term_id", termId).not("published_at", "is", null).limit(1);
  if (!published?.length) return { error: "발행된 버전이 없는 약관은 초안을 지울 수 없어요. 약관을 삭제해 주세요." };
  await supabase.from("term_versions").delete().eq("term_id", termId).is("published_at", null);
  revalidatePath(`/dashboard/terms/${termId}`);
  revalidatePath("/dashboard/terms");
  return { ok: "작성 중인 버전을 지웠어요." };
}

export async function setTermArchived(termId: string, archived: boolean): Promise<TermResult> {
  const { supabase, site, term } = await loadTerm(termId);
  if (!term) return { error: "약관을 찾을 수 없어요." };
  if (archived) {
    const linked = (await linkedPages(supabase, site.id)).get(termId) ?? [];
    if (linked.length) {
      const names = linked.slice(0, 3).map((p) => `‘${p.title}’`).join(", ");
      return { error: `이 약관을 쓰는 프로모션이 있어서 보관할 수 없어요: ${names}${linked.length > 3 ? ` 외 ${linked.length - 3}개` : ""}. 프로모션에서 먼저 빼 주세요.` };
    }
  }
  const { error } = await supabase.from("terms").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", termId);
  if (error) return { error: "바꾸지 못했어요: " + error.message };
  revalidatePath(`/dashboard/terms/${termId}`);
  revalidatePath("/dashboard/terms");
  return { ok: archived ? "보관했어요. 이미 동의한 리드에서는 계속 전문을 볼 수 있어요." : "보관을 해제했어요." };
}

/** Only terms nobody has agreed to can be deleted (row level security also checks this). */
export async function deleteTerm(termId: string): Promise<TermResult> {
  const { supabase, site, term } = await loadTerm(termId);
  if (!term) return { error: "약관을 찾을 수 없어요." };
  if ((await linkedPages(supabase, site.id)).get(termId)?.length) return { error: "이 약관을 쓰는 프로모션이 있어서 삭제할 수 없어요." };
  const { data, error } = await supabase.from("terms").delete().eq("id", termId).select("id");
  if (error) return { error: "삭제하지 못했어요: " + error.message };
  if (!data?.length) return { error: "동의 기록이 있는 약관은 삭제할 수 없어요. 대신 보관해 주세요." };
  revalidatePath("/dashboard/terms");
  redirect("/dashboard/terms");
}
