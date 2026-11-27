"use server";

import { revalidatePath } from "next/cache";
import { requireSite } from "@/lib/supabase/server";
import { checkLimit, limitMessage, metered } from "@/lib/usage";
import { IMAGE_RATIOS, IMAGE_STYLES, type ImageRatio, type ImageStyle } from "@/lib/images/options";

export type MediaItem = {
  id: string;
  url: string;
  source: "ai" | "upload";
  prompt: string;
  style: string;
  ratio: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

const BUCKET = "newsletter-images";

/** An AI image that is stored as a file but not yet in the library (no media row). */
export type AiDraft = { url: string; path: string; width: number; height: number; bytes: number };

function draftPath(userId: string) {
  return `${userId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
}

async function storeDraft(supabase: Awaited<ReturnType<typeof requireSite>>["supabase"], userId: string, img: { bytes: Uint8Array; width: number; height: number }) {
  const path = draftPath(userId);
  const { error } = await supabase.storage.from(BUCKET).upload(path, img.bytes, { contentType: "image/jpeg" });
  if (error) throw new Error("이미지를 저장하지 못했어요: " + error.message);
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { url, path, width: img.width, height: img.height, bytes: img.bytes.length } satisfies AiDraft;
}

/**
 * Generates an AI image as a draft. It is not added to the library yet:
 * that happens in saveAiImage, when the user puts it in the draft or saves it.
 */
export async function generateAiImage(description: string, style: string, ratio: string): Promise<{ draft?: AiDraft; error?: string }> {
  const { supabase, user, site } = await requireSite();
  const { generateImage } = await import("@/lib/images/ai");
  const st = (style in IMAGE_STYLES ? style : "") as ImageStyle | "";
  const ra = (ratio in IMAGE_RATIOS ? ratio : "1:1") as ImageRatio;
  try {
    await checkLimit(supabase, site.id, "storage", 300 * 1024);
    const img = await metered(supabase, site.id, ["image"], () => generateImage(description, st, ra));
    return { draft: await storeDraft(supabase, user.id, img) };
  } catch (e) {
    if (limitMessage(e)) return { error: limitMessage(e)! };
    console.error("generateAiImage failed", e);
    return { error: e instanceof Error ? e.message : "이미지를 만들지 못했어요." };
  }
}

/**
 * Edits an image from this app's storage with an instruction, based on the image itself
 * (image-to-image). The result is a new draft; the source is left as it is.
 */
export async function editAiImage(sourceUrl: string, instruction: string, width: number | null, height: number | null): Promise<{ draft?: AiDraft; error?: string }> {
  const { supabase, user, site } = await requireSite();
  const prefix = supabase.storage.from(BUCKET).getPublicUrl("").data.publicUrl.replace(/\/?$/, "/");
  if (!sourceUrl.startsWith(prefix)) return { error: "이미지 라이브러리에 있는 이미지만 수정할 수 있어요." };
  const { editImage } = await import("@/lib/images/ai");
  try {
    await checkLimit(supabase, site.id, "storage", 300 * 1024);
    const res = await fetch(sourceUrl);
    if (!res.ok) return { error: "원본 이미지를 불러오지 못했어요." };
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return { error: "JPG, PNG, WEBP 이미지만 AI로 수정할 수 있어요." };
    const source = new Blob([await res.arrayBuffer()], { type });
    const img = await metered(supabase, site.id, ["image"], () => editImage(source, instruction, width, height));
    return { draft: await storeDraft(supabase, user.id, img) };
  } catch (e) {
    if (limitMessage(e)) return { error: limitMessage(e)! };
    console.error("editAiImage failed", e);
    return { error: e instanceof Error ? e.message : "이미지를 수정하지 못했어요." };
  }
}

/** Adds a draft AI image to the library. Returns its url. */
export async function saveAiImage(input: { path: string; prompt: string; style: string; ratio: string; width: number | null; height: number | null }): Promise<{ url?: string; error?: string }> {
  const { supabase, user, site } = await requireSite();
  const { path } = input;
  if (!path.startsWith(`${user.id}/ai-`) || path.includes("..")) return { error: "저장할 이미지를 찾을 수 없어요." };
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { data: existing } = await supabase.from("media").select("id").eq("path", path).maybeSingle();
  if (existing) return { url };
  const head = await fetch(url, { method: "HEAD" }).catch(() => null);
  if (!head?.ok) return { error: "저장할 이미지를 찾을 수 없어요. 다시 만들어 주세요." };
  const bytes = Number(head.headers.get("content-length")) || 0;
  try {
    await checkLimit(supabase, site.id, "storage", Math.max(1, bytes));
  } catch (e) {
    return { error: limitMessage(e) ?? "용량을 확인하지 못했어요." };
  }
  const dim = (n: number | null) => (n && Number.isFinite(n) && n > 0 ? Math.round(n) : null);
  const { error } = await supabase.from("media").insert({
    site_id: site.id,
    user_id: user.id,
    url,
    path,
    source: "ai",
    prompt: String(input.prompt ?? "").slice(0, 3000),
    style: input.style in IMAGE_STYLES ? input.style : "",
    ratio: input.ratio in IMAGE_RATIOS ? input.ratio : "",
    width: dim(input.width),
    height: dim(input.height),
    bytes,
  });
  if (error) return { error: "라이브러리에 저장하지 못했어요: " + error.message };
  revalidatePath("/dashboard/media");
  return { url };
}

/** Removes draft AI images the user did not keep. Files already in the library are left alone. */
export async function discardAiDrafts(paths: string[]) {
  const { supabase, user } = await requireSite();
  const mine = paths.filter((p) => p.startsWith(`${user.id}/ai-`) && !p.includes("..")).slice(0, 50);
  if (!mine.length) return;
  const { data } = await supabase.from("media").select("path").in("path", mine);
  const kept = new Set((data ?? []).map((r) => r.path as string));
  const drop = mine.filter((p) => !kept.has(p));
  if (drop.length) await supabase.storage.from(BUCKET).remove(drop);
}

/** Checked by the browser before it uploads a file: an error when the site's storage limit has no room. */
export async function checkUploadRoom(size: number): Promise<{ error?: string }> {
  const { supabase, site } = await requireSite();
  try {
    await checkLimit(supabase, site.id, "storage", Math.max(1, Math.round(size)));
    return {};
  } catch (e) {
    return { error: limitMessage(e) ?? "용량을 확인하지 못했어요." };
  }
}

/** Records an image the browser uploaded to storage. */
export async function recordUpload(url: string, path: string, width: number | null, height: number | null, bytes = 0) {
  const { supabase, user, site } = await requireSite();
  if (!path.startsWith(`${user.id}/`)) return;
  await supabase.from("media").insert({ site_id: site.id, user_id: user.id, url, path, source: "upload", width, height, bytes: Math.max(0, Math.round(bytes)) });
  revalidatePath("/dashboard/media");
}

export async function listMedia(limit = 60, before?: string): Promise<MediaItem[]> {
  const { supabase } = await requireSite();
  let q = supabase.from("media").select("id, url, source, prompt, style, ratio, width, height, created_at").order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data } = await q;
  return (data ?? []) as MediaItem[];
}

export async function deleteMedia(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireSite();
  const { data } = await supabase.from("media").select("path").eq("id", id).maybeSingle();
  if (!data) return { error: "이미지를 찾을 수 없어요." };
  if (data.path) await supabase.storage.from(BUCKET).remove([data.path]);
  await supabase.from("media").delete().eq("id", id);
  revalidatePath("/dashboard/media");
  return {};
}
