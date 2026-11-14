"use server";

import { revalidatePath } from "next/cache";
import { requireSite } from "@/lib/supabase/server";
import { metered } from "@/lib/usage";
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

/** Generates an AI image, stores it in the user's library and returns its url. */
export async function generateAiImage(description: string, style: string, ratio: string): Promise<{ url?: string; error?: string }> {
  const { supabase, user, site } = await requireSite();
  const { generateImage } = await import("@/lib/images/ai");
  const st = (style in IMAGE_STYLES ? style : "") as ImageStyle | "";
  const ra = (ratio in IMAGE_RATIOS ? ratio : "1:1") as ImageRatio;
  try {
    const { bytes, width, height } = await metered(supabase, site.id, ["image"], () => generateImage(description, st, ra));
    const path = `${user.id}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
    if (error) return { error: "이미지를 저장하지 못했어요: " + error.message };
    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error: dbErr } = await supabase
      .from("media")
      .insert({ site_id: site.id, user_id: user.id, url, path, source: "ai", prompt: description.slice(0, 3000), style: st, ratio: ra, width, height });
    if (dbErr) console.error("media insert failed", dbErr);
    revalidatePath("/dashboard/media");
    return { url };
  } catch (e) {
    console.error("generateAiImage failed", e);
    return { error: e instanceof Error ? e.message : "이미지를 만들지 못했어요." };
  }
}

/** Records an image the browser uploaded to storage. */
export async function recordUpload(url: string, path: string, width: number | null, height: number | null) {
  const { supabase, user, site } = await requireSite();
  if (!path.startsWith(`${user.id}/`)) return;
  await supabase.from("media").insert({ site_id: site.id, user_id: user.id, url, path, source: "upload", width, height });
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
