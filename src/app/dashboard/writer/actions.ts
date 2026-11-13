"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSite } from "@/lib/supabase/server";
import { makeSlug } from "@/lib/slug";
import { loadWriterSettings } from "@/lib/writer/settings";
import { cleanSlug, generateArticle, generateOutline, suggestSeo, suggestTitles, transformText, type TransformAction } from "@/lib/writer/ai";
import {
  ARTICLE_SLUG_RE,
  LANGUAGES,
  LENGTHS,
  POST_TYPES,
  TONES,
  articleText,
  safeUrl,
  sanitizeBlocks,
  sanitizeFaq,
  type Block,
  type Brief,
  type Faq,
  type HeaderImage,
  type Outline,
} from "@/lib/writer/types";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const pick = <T extends Record<string, unknown>>(v: unknown, opts: T, def: keyof T) => (typeof v === "string" && v in opts ? v : def) as keyof T;


function cleanBrief(raw: Partial<Brief>): Brief {
  return {
    topic: s(raw.topic, 300),
    keyword: s(raw.keyword, 100),
    subkw: s(raw.subkw, 300),
    type: pick(raw.type, POST_TYPES, "info"),
    tone: pick(raw.tone, TONES, "friendly"),
    length: pick(raw.length, LENGTHS, "medium"),
    language: pick(raw.language, LANGUAGES, "ko"),
    audience: s(raw.audience, 200),
    extra: s(raw.extra, 2000),
  };
}

function aiError(e: unknown, fallback: string) {
  console.error(fallback, e);
  if (!process.env.ANTHROPIC_API_KEY) return "AI 설정이 없어요. Vercel 환경 변수에 ANTHROPIC_API_KEY를 넣어주세요.";
  const msg = e instanceof Error ? e.message : "";
  if (/timeout|timed out/i.test(msg)) return "AI 응답이 너무 오래 걸렸어요. 분량을 줄여 다시 시도해 주세요.";
  return /[가-힣]/.test(msg) ? msg : fallback;
}

export async function createOutline(rawBrief: Partial<Brief>): Promise<{ outline?: Outline; error?: string }> {
  const { supabase, site } = await requireSite();
  const brief = cleanBrief(rawBrief);
  if (!brief.keyword) return { error: "포커스 키워드를 입력해 주세요." };
  try {
    return { outline: await generateOutline(brief, await loadWriterSettings(supabase, site.id)) };
  } catch (e) {
    return { error: aiError(e, "개요를 만들지 못했어요. 다시 시도해 주세요.") };
  }
}

async function uniqueSlug(supabase: SupabaseClient, siteId: string, base: string, exceptId?: string) {
  const root = ARTICLE_SLUG_RE.test(base) ? base : makeSlug();
  const { data } = await supabase.from("articles").select("id, slug").eq("site_id", siteId).like("slug", `${root}%`);
  const taken = new Set((data ?? []).filter((r) => r.id !== exceptId).map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

export async function createArticle(rawBrief: Partial<Brief>, outline: Outline | null): Promise<{ error?: string }> {
  const { supabase, user, site } = await requireSite();
  const brief = cleanBrief(rawBrief);
  if (!brief.keyword) return { error: "포커스 키워드를 입력해 주세요." };
  const cleanOutline = outline
    ? { title: s(outline.title, 200), paragraphs: (outline.paragraphs ?? []).map((p) => s(p, 300)).filter(Boolean).slice(0, 12), closing: s(outline.closing, 300) }
    : null;

  let id: string;
  try {
    const a = await generateArticle(brief, await loadWriterSettings(supabase, site.id), cleanOutline);
    const slug = await uniqueSlug(supabase, site.id, a.slug);
    const { data, error } = await supabase
      .from("articles")
      .insert({
        site_id: site.id, user_id: user.id,
        slug,
        title: a.title,
        keyword: brief.keyword,
        brief: { ...brief, outline: cleanOutline ?? undefined },
        seo_title: a.seo_title,
        meta_description: a.meta_description,
        tags: a.tags,
        header_image: a.header_image,
        blocks: a.blocks,
        faq: a.faq,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "글을 저장하지 못했어요: " + (error?.message ?? "") };
    id = data.id;
  } catch (e) {
    return { error: aiError(e, "본문을 만들지 못했어요. 다시 시도해 주세요.") };
  }
  revalidatePath("/dashboard/writer");
  redirect(`/dashboard/writer/${id}`);
}

export type ArticleDraft = {
  title: string;
  keyword: string;
  slug: string;
  seo_title: string;
  meta_description: string;
  tags: string[];
  header_image: Partial<HeaderImage>;
  blocks: Block[];
  faq: Faq[];
};

export async function saveArticle(id: string, d: ArticleDraft): Promise<{ error?: string; slug?: string }> {
  const { supabase, site } = await requireSite();
  const slug = cleanSlug(s(d.slug, 100));
  if (!ARTICLE_SLUG_RE.test(slug)) return { error: "주소(slug)는 영문 소문자, 숫자, 하이픈(-)으로 정해주세요." };
  const { data: clash } = await supabase.from("articles").select("id").eq("site_id", site.id).eq("slug", slug).neq("id", id).maybeSingle();
  if (clash) return { error: "같은 주소(slug)를 쓰는 글이 이미 있어요." };
  const { error } = await supabase
    .from("articles")
    .update({
      title: s(d.title, 200),
      keyword: s(d.keyword, 100),
      slug,
      seo_title: s(d.seo_title, 200),
      meta_description: s(d.meta_description, 500),
      tags: (Array.isArray(d.tags) ? d.tags : []).map((t) => s(t, 40)).filter(Boolean).slice(0, 10),
      header_image: { url: safeUrl(s(d.header_image?.url, 2000)), alt: s(d.header_image?.alt, 300), prompt: s(d.header_image?.prompt, 2000) },
      blocks: sanitizeBlocks(d.blocks),
      faq: sanitizeFaq(d.faq),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath("/dashboard/writer");
  return { slug };
}

export async function setArticlePublished(id: string, published: boolean) {
  const { supabase } = await requireSite();
  const { data: cur } = await supabase.from("articles").select("published_at").eq("id", id).single();
  await supabase
    .from("articles")
    .update({ status: published ? "published" : "draft", published_at: published ? (cur?.published_at ?? new Date().toISOString()) : cur?.published_at ?? null })
    .eq("id", id);
  revalidatePath("/dashboard/writer");
  revalidatePath(`/dashboard/writer/${id}`);
}

export async function deleteArticle(id: string) {
  const { supabase } = await requireSite();
  await supabase.from("articles").delete().eq("id", id);
  revalidatePath("/dashboard/writer");
  redirect("/dashboard/writer");
}

type Ctx = { title: string; keyword: string; language: string };
const lang = (v: string) => (v === "en" ? "en" : "ko") as Brief["language"];
const ACTIONS: TransformAction[] = ["rewrite", "expand", "shorten", "friendly", "professional", "concise"];

export async function aiTransform(action: string, text: string, ctx: Ctx): Promise<{ text?: string; error?: string }> {
  const { supabase, site } = await requireSite();
  if (!ACTIONS.includes(action as TransformAction)) return { error: "알 수 없는 작업이에요." };
  if (!text.trim()) return { error: "다시 쓸 내용이 없어요." };
  try {
    const out = await transformText(
      action as TransformAction,
      { text: s(text, 8000), title: s(ctx.title, 200), keyword: s(ctx.keyword, 100), language: lang(ctx.language) },
      await loadWriterSettings(supabase, site.id),
    );
    return { text: out };
  } catch (e) {
    return { error: aiError(e, "AI가 다시 쓰지 못했어요.") };
  }
}

export async function aiTitles(blocks: Block[], ctx: Ctx): Promise<{ titles?: string[]; error?: string }> {
  const { supabase, site } = await requireSite();
  try {
    const titles = await suggestTitles(
      { title: s(ctx.title, 200), keyword: s(ctx.keyword, 100), body: articleText(sanitizeBlocks(blocks)), language: lang(ctx.language) },
      await loadWriterSettings(supabase, site.id),
    );
    return { titles };
  } catch (e) {
    return { error: aiError(e, "제목을 만들지 못했어요.") };
  }
}

export async function aiSeo(blocks: Block[], ctx: Ctx) {
  const { supabase, site } = await requireSite();
  try {
    const seo = await suggestSeo(
      { title: s(ctx.title, 200), keyword: s(ctx.keyword, 100), body: articleText(sanitizeBlocks(blocks)), language: lang(ctx.language) },
      await loadWriterSettings(supabase, site.id),
    );
    return { seo };
  } catch (e) {
    return { error: aiError(e, "SEO 항목을 만들지 못했어요.") };
  }
}

export async function saveWriterSettings(_: unknown, formData: FormData): Promise<{ saved?: boolean; error?: string }> {
  const { supabase, user, site } = await requireSite();
  const { error } = await supabase.from("writer_settings").upsert({
    site_id: site.id, user_id: user.id,
    brand_voice: s(formData.get("brand_voice"), 2000),
    banned_words: s(formData.get("banned_words"), 1000),
    tone: pick(formData.get("tone"), TONES, "friendly"),
    length: pick(formData.get("length"), LENGTHS, "medium"),
    language: pick(formData.get("language"), LANGUAGES, "ko"),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "저장하지 못했어요: " + error.message };
  revalidatePath("/dashboard/writer");
  return { saved: true };
}
