import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { addUsage } from "@/lib/usage";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  BLOCK_TYPES,
  LENGTHS,
  POST_TYPES,
  TONES,
  fromInlineHtml,
  newBlockId,
  sanitizeBlocks,
  type Block,
  type Brief,
  type Outline,
  type WriterSettings,
} from "./types";

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

function system(lang: Brief["language"], s: WriterSettings) {
  const lines = [
    "You are a professional blog writer for a small business blog.",
    "Write natural, accurate, helpful content for human readers first and search engines second.",
    `Write in ${lang === "en" ? "English" : "Korean"}.`,
    "Do not invent statistics, prices, quotes or sources. If a fact would need checking, write it generally or leave a placeholder in square brackets.",
  ];
  if (s.brand_voice.trim()) lines.push("Brand voice to follow: " + s.brand_voice.trim());
  if (s.banned_words.trim()) lines.push("Never use these words: " + s.banned_words.trim());
  return lines.join("\n");
}

function briefText(b: Brief) {
  const out = [
    "Topic: " + (b.topic || b.keyword),
    "Focus keyword: " + b.keyword,
    "Post type: " + POST_TYPES[b.type],
    "Tone: " + TONES[b.tone],
    `Target length: about ${LENGTHS[b.length][1]} characters of body text`,
  ];
  if (b.subkw) out.push("Secondary keywords: " + b.subkw);
  if (b.audience) out.push("Audience: " + b.audience);
  if (b.extra) out.push("Extra instructions from the author: " + b.extra);
  return out.join("\n");
}

async function ask<T extends z.ZodType>(schema: T, sys: string, user: string, maxTokens: number, effort: "low" | "medium") {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort, format: zodOutputFormat(schema) },
    system: sys,
    messages: [{ role: "user", content: user }],
  });
  addUsage("text", res.usage.input_tokens + res.usage.output_tokens);
  if (res.stop_reason === "refusal") throw new Error("AI가 이 요청을 거절했어요. 주제를 바꿔 다시 시도해 주세요.");
  if (res.stop_reason === "max_tokens") throw new Error("글이 너무 길어 중간에 끊겼어요. 분량을 줄여 다시 시도해 주세요.");
  if (!res.parsed_output) throw new Error("AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
  return res.parsed_output as z.infer<T>;
}

const OutlineSchema = z.object({ title: z.string(), paragraphs: z.array(z.string()), closing: z.string() });

export async function generateOutline(b: Brief, s: WriterSettings): Promise<Outline> {
  const prompt =
    briefText(b) +
    "\n\nPlan the post. Return:\n" +
    "- title: a click-worthy post title that contains the focus keyword.\n" +
    "- paragraphs: 3 to 6 body sections in reading order, each a one-line summary of what that section covers.\n" +
    "- closing: a one-line summary of the conclusion.\n" +
    "Keep each summary under 60 characters.";
  const r = await ask(OutlineSchema, system(b.language, s), prompt, 4000, "low");
  return { title: r.title.trim(), paragraphs: r.paragraphs.map((p) => p.trim()).filter(Boolean), closing: r.closing.trim() };
}

const BlockSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  style: z.enum(["none", "summary", "tip", "info", "warning", "side", "card"]),
  label: z.string(),
  text: z.string(),
  prompt: z.string(),
  items: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const ArticleSchema = z.object({
  title: z.string(),
  seo_title: z.string(),
  meta_description: z.string(),
  slug: z.string(),
  header_image: z.object({ alt: z.string(), prompt: z.string() }),
  tags: z.array(z.string()),
  blocks: z.array(BlockSchema),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const BLOCK_RULES = [
  'Every block has all fields; leave the ones a type does not use empty ("" or []); "style" is "none" unless the type says otherwise; "label" is "" unless the type says otherwise.',
  "Block types:",
  '- "p": paragraph in "text".',
  '- "h2" / "h3": section heading / sub-heading in "text". An h2 may have a short "label".',
  '- "ul": bullet list, one bullet per entry in "items". "ol": numbered list, one entry per item in "items".',
  '- "quote": one memorable sentence or key message in "text", shown as a pull quote. Never invent a quotation from a real person.',
  '- "say": a sentence shown in large quotation marks, e.g. a common piece of advice; "text" is the sentence, "label" says whose words they are in general terms (e.g. "10년 차 캠퍼") or "". Never attribute words to a real, named person.',
  '- "table": comparison or spec table in "rows"; the first row is the header row; 2 to 4 columns and 3 to 6 body rows; every row has the same number of cells.',
  '- "box": highlighted box. "style" is "summary" (key takeaways), "tip" (practical tip), "info" (good to know) or "warning" (caution). Optional one-sentence lead in "text", points in "items".',
  '- "keys": 2 to 4 key-point cards in "rows", each row [short label, one-sentence point].',
  '- "steps": 3 to 6 numbered steps in "rows", each row [step title, one-sentence explanation].',
  '- "procon": two lists in "rows": rows[0] are the good points, rows[1] the drawbacks or cautions, 2 to 4 each.',
  '- "stats": 2 to 4 highlighted figures in "rows", each row [value with unit, short label].',
  '- "check": checklist items in "items" (4 to 8 short entries).',
  '- "thumbs": 2 to 4 items that each get a picture, in "rows", each row [title, one or two sentence description, English image-generator description]. "style" is "side" (picture left of the text, for detailed items) or "card" (picture above, for 3 or 4 short items).',
  '- "img": an image slot the author fills later. "text" is a one-sentence description of the image in the post language (alt text); "prompt" is an English description for an image generator: a photo-realistic or clean editorial scene, no text, letters, logos or watermarks. "prompt" stays "" for every other type.',
  'Inside "text", "items" and "rows" cells you may use only <strong> and <a href="..."> tags (no tags in image descriptions). No other HTML, no Markdown.',
].join("\n");

const TYPE_LAYOUT: Record<Brief["type"], string> = {
  info: "Post type layout: explain the topic in 3 to 5 sections from basics to practical use; prefer keys, table, box and thumbs.",
  list: 'Post type layout: a ranked or grouped list; present the main items with "thumbs" (style "side" for detailed items, "card" for short ones) and finish with a comparison "table" or "check".',
  review: 'Post type layout: overview, what it is like to use, a "procon" block, a spec or price "table", who it suits ("check"), and a verdict.',
  howto: 'Post type layout: what you need ("check"), the procedure as "steps", common mistakes ("box" warning) and tips.',
  compare: 'Post type layout: introduce the options ("thumbs" style "card"), compare them in a "table", give each a "procon" block or summary, then recommend which suits whom.',
};

export type GeneratedArticle = {
  title: string;
  seo_title: string;
  meta_description: string;
  slug: string;
  tags: string[];
  header_image: { url: string; alt: string; prompt: string };
  blocks: Block[];
  faq: { question: string; answer: string }[];
};

export function cleanSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
}

export async function generateArticle(b: Brief, s: WriterSettings, outline?: Outline | null): Promise<GeneratedArticle> {
  const rules = [
    "Write the full post as an ordered list of blocks.",
    BLOCK_RULES,
    "Lay the post out like a well-designed magazine article, not a wall of text:",
    "- Start with one or two short intro paragraphs (no heading). The first paragraph must contain the focus keyword naturally.",
    '- Right after the intro, add a "keys" block with 3 key takeaways.',
    '- Keep paragraphs short: 2 to 4 sentences each. Never put more than 3 "p" blocks in a row.',
    "- Give every h2 section at least one non-paragraph element that genuinely fits its content, and vary them: use at least 5 different element types across the post (for example steps, table, procon, stats, check, thumbs, say, box).",
    '- Use "steps" for any process, "table" or "procon" for comparisons, "stats" only for real, well-known figures (never invent numbers), "check" for things to prepare or verify, "thumbs" for 2 to 4 items, places or products that deserve a picture each.',
    '- Use at most one "quote" and one "say", 1 to 3 boxes, and 1 or 2 "img" blocks inside the body (never as the first block).',
    '- Give about half of the h2 headings a short "label" (2 to 8 characters, e.g. "STEP", "비교", "체크리스트", "TIP") that names the section\'s role; leave "label" empty for the others.',
    "- Highlight one or two key phrases per section with <strong>.",
    TYPE_LAYOUT[b.type] ?? TYPE_LAYOUT.info,
    "End with a short concluding section.",
    "Use the focus keyword naturally about once every 300 to 400 characters. Do not stuff it.",
    "seo_title: under 50 characters, contains the focus keyword near the start, no site name.",
    "meta_description: 80 to 150 characters, contains the focus keyword in the first half, invites the click.",
    "slug: 2 to 5 lowercase English words joined by hyphens that translate the focus keyword.",
    "tags: 3 to 5 short tags.",
    'header_image: a header image for the top of the post. "alt" is a one-sentence description of the image in the post language. "prompt" is an English description for an image generator: a photo-realistic or clean editorial scene that fits the topic, wide 3:2 composition, no text, letters, logos or watermarks.',
    'faq: 3 questions readers commonly ask about this topic, each with a 1 to 3 sentence answer. Do not repeat them inside "blocks".',
  ];

  let prompt = briefText(b) + "\n\n";
  if (outline?.paragraphs.length) {
    prompt += "Follow this approved outline in order (one section per item):\nTitle: " + outline.title + "\n";
    outline.paragraphs.forEach((p, i) => (prompt += `Section ${i + 1}: ${p}\n`));
    prompt += "Closing: " + outline.closing + "\nUse the outline title as the post title unless it lacks the focus keyword.\n\n";
  }
  prompt += rules.join("\n");

  const r = await ask(ArticleSchema, system(b.language, s), prompt, 20000, "medium");
  const blocks = sanitizeBlocks(
    r.blocks.map((blk) => ({
      ...blk,
      id: newBlockId(),
      text: blk.type === "img" ? blk.text : fromInlineHtml(blk.text),
      items: blk.items.map(fromInlineHtml).filter(Boolean),
      rows: blk.rows.map((row) => row.map((c, i) => (blk.type === "thumbs" && i === 2 ? c : fromInlineHtml(c)))),
      image_url: "",
      images: [],
    })),
  );
  if (!blocks.length) throw new Error("AI가 본문을 만들지 못했어요. 주제를 조금 더 구체적으로 적어 다시 시도해 주세요.");
  return {
    title: r.title.trim(),
    seo_title: r.seo_title.trim(),
    meta_description: r.meta_description.trim(),
    slug: cleanSlug(r.slug),
    tags: r.tags.map((t) => t.trim()).filter(Boolean).slice(0, 5),
    header_image: { url: "", alt: r.header_image.alt.trim(), prompt: r.header_image.prompt.trim() },
    blocks,
    faq: r.faq.map((q) => ({ question: q.question.trim(), answer: fromInlineHtml(q.answer) })).filter((q) => q.question),
  };
}

export type TransformAction = "rewrite" | "expand" | "shorten" | "friendly" | "professional" | "concise";

const TASKS: Record<TransformAction, string> = {
  rewrite: "Rewrite this passage so it reads better. Keep the meaning, length and any links.",
  expand: "Expand this passage to about twice its length with useful detail. Keep any links.",
  shorten: "Shorten this passage to about half its length, keeping the key point and any links.",
  friendly: "Rewrite this passage in a friendly, warm tone. Keep the meaning and any links.",
  professional: "Rewrite this passage in a professional, trustworthy tone. Keep the meaning and any links.",
  concise: "Rewrite this passage concisely. Keep the meaning and any links.",
};

export async function transformText(action: TransformAction, ctx: { text: string; title: string; keyword: string; language: Brief["language"] }, s: WriterSettings) {
  const prompt =
    `Post title: ${ctx.title}\nFocus keyword: ${ctx.keyword}\n\n${TASKS[action]}\n` +
    "The passage uses **bold** and [label](url) markup. Return only the new passage in \"text\" using the same markup, no other formatting.\n\nPassage:\n" +
    ctx.text;
  const r = await ask(z.object({ text: z.string() }), system(ctx.language, s), prompt, 4000, "low");
  return r.text.trim();
}

export async function suggestTitles(ctx: { title: string; keyword: string; body: string; language: Brief["language"] }, s: WriterSettings) {
  const prompt =
    `Post title: ${ctx.title}\nFocus keyword: ${ctx.keyword}\n\nOpening of the post: ${ctx.body.slice(0, 600)}\n\n` +
    "Write 5 better post titles that include the focus keyword and are under 40 characters.";
  const r = await ask(z.object({ titles: z.array(z.string()) }), system(ctx.language, s), prompt, 2000, "low");
  return r.titles.map((t) => t.trim()).filter(Boolean).slice(0, 5);
}

export async function suggestSeo(ctx: { title: string; keyword: string; body: string; language: Brief["language"] }, s: WriterSettings) {
  const prompt =
    `Post title: ${ctx.title}\nFocus keyword: ${ctx.keyword}\n\nPost body:\n${ctx.body.slice(0, 12000)}\n\n` +
    "Write SEO fields for this post.\n" +
    "seo_title: under 50 characters, focus keyword near the start, no site name.\n" +
    "meta_description: 80 to 150 characters, focus keyword in the first half.\n" +
    "slug: 2 to 5 lowercase English words joined by hyphens.\n" +
    "tags: 3 to 5 short tags.";
  const r = await ask(
    z.object({ seo_title: z.string(), meta_description: z.string(), slug: z.string(), tags: z.array(z.string()) }),
    system(ctx.language, s),
    prompt,
    2000,
    "low",
  );
  return { seo_title: r.seo_title.trim(), meta_description: r.meta_description.trim(), slug: cleanSlug(r.slug), tags: r.tags.slice(0, 5) };
}
