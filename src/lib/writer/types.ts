// Neo AI Writer: article model shared by the server, the editor and the public blog.

export const POST_TYPES = {
  info: "정보형",
  list: "리스트형",
  review: "리뷰",
  howto: "방법 안내",
  compare: "비교형",
} as const;
export const TONES = { friendly: "친근하게", professional: "전문적으로", concise: "간결하게" } as const;
export const LENGTHS = {
  short: ["짧게 (약 1,000자)", 1000],
  medium: ["보통 (약 2,500자)", 2500],
  long: ["길게 (약 5,000자)", 5000],
} as const;
export const LANGUAGES = { ko: "한국어", en: "English" } as const;

export type PostType = keyof typeof POST_TYPES;
export type Tone = keyof typeof TONES;
export type Length = keyof typeof LENGTHS;
export type Language = keyof typeof LANGUAGES;

export type Brief = {
  topic: string;
  keyword: string;
  subkw: string;
  type: PostType;
  tone: Tone;
  length: Length;
  language: Language;
  audience: string;
  extra: string;
};

export type Outline = { title: string; paragraphs: string[]; closing: string };

export const BLOCK_TYPES = [
  "h2", "h3", "p", "ul", "ol", "quote", "table", "box", "img", "keys", "steps", "procon", "stats", "say", "check", "thumbs",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  h2: "소제목", h3: "작은 소제목", p: "문단", ul: "글머리 목록", ol: "번호 목록", quote: "인용",
  table: "표", box: "강조 상자", img: "이미지", keys: "핵심 카드", steps: "단계", procon: "장단점",
  stats: "숫자 강조", say: "한마디", check: "체크리스트", thumbs: "이미지 목록",
};

export const BOX_STYLES = { summary: "핵심 요약", tip: "팁", info: "알아두기", warning: "주의" } as const;

/**
 * Text fields use a tiny markup: **bold** and [label](https://url). Everything else is plain text.
 * rows: table rows (first row = header); keys/steps/stats: [title, text]; procon: [pros[], cons[]];
 * thumbs: [title, text, image prompt]. images: one image url per thumbs row.
 */
export type Block = {
  id: string;
  type: BlockType;
  style: string;
  label: string;
  text: string;
  prompt: string;
  items: string[];
  rows: string[][];
  image_url: string;
  images: string[];
};

export type Faq = { question: string; answer: string };
export type HeaderImage = { url: string; alt: string; prompt: string };

export type Article = {
  id: string;
  user_id: string;
  site_id: string;
  status: "draft" | "published";
  slug: string;
  title: string;
  keyword: string;
  brief: Partial<Brief> & { outline?: Outline };
  seo_title: string;
  meta_description: string;
  tags: string[];
  header_image: Partial<HeaderImage>;
  blocks: Block[];
  faq: Faq[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WriterSettings = {
  brand_voice: string;
  banned_words: string;
  tone: Tone;
  length: Length;
  language: Language;
};

export const DEFAULT_WRITER_SETTINGS: WriterSettings = {
  brand_voice: "",
  banned_words: "",
  tone: "friendly",
  length: "medium",
  language: "ko",
};

export const ARTICLE_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/;

export function newBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyBlock(type: BlockType): Block {
  const b: Block = { id: newBlockId(), type, style: "none", label: "", text: "", prompt: "", items: [], rows: [], image_url: "", images: [] };
  if (type === "box") b.style = "tip";
  if (type === "thumbs") b.style = "side";
  if (type === "ul" || type === "ol" || type === "check") b.items = [""];
  if (type === "table") b.rows = [["항목", "내용"], ["", ""]];
  if (type === "keys" || type === "steps" || type === "stats") b.rows = [["", ""]];
  if (type === "procon") b.rows = [[""], [""]];
  if (type === "thumbs") b.rows = [["", "", ""]];
  return b;
}

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const strArr = (v: unknown, max = 50) => (Array.isArray(v) ? v.slice(0, max).map((x) => str(x)) : []);

export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 200).flatMap((raw) => {
    const b = (raw ?? {}) as Record<string, unknown>;
    const type = BLOCK_TYPES.includes(b.type as BlockType) ? (b.type as BlockType) : null;
    if (!type) return [];
    return [{
      id: str(b.id, 40) || newBlockId(),
      type,
      style: str(b.style, 20) || "none",
      label: str(b.label, 60),
      text: str(b.text, 20000),
      prompt: str(b.prompt, 2000),
      items: strArr(b.items),
      rows: Array.isArray(b.rows) ? b.rows.slice(0, 30).map((r) => strArr(r, 30)) : [],
      image_url: safeUrl(str(b.image_url, 2000)),
      images: strArr(b.images, 10).map(safeUrl),
    }];
  });
}

export function sanitizeFaq(input: unknown): Faq[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((q) => ({ question: str((q as Faq)?.question, 500), answer: str((q as Faq)?.answer, 3000) }))
    .filter((q) => q.question.trim());
}

export function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
}

/** Converts the model's inline HTML (<strong>, <em>, <a>) to the article markup and drops other tags. */
export function fromInlineHtml(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<(strong|b)>(.*?)<\/\1>/gi, "**$2**")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** Plain text of a field (for search snippets and meta tags). */
export function plain(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "");
}

/** Plain text of the whole article body. */
export function articleText(blocks: Block[]): string {
  return blocks
    .map((b) => [b.label, b.text, ...b.items, ...b.rows.map((r) => (b.type === "thumbs" ? r.slice(0, 2) : r).join(" "))].filter(Boolean).join(" "))
    .map(plain)
    .join("\n");
}
