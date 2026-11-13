export const BLOCK_TYPES = ["hero", "heading", "text", "image", "cards", "thumbs", "button", "divider"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "대표 이미지",
  heading: "소제목",
  text: "본문",
  image: "이미지",
  cards: "카드 목록",
  thumbs: "썸네일 리스트",
  button: "버튼",
  divider: "구분선",
};

export const TONES = {
  friendly: "친근한",
  classic: "격식 있는",
  witty: "재치 있는",
  professional: "전문적인",
} as const;
export type Tone = keyof typeof TONES;

export const TEMPLATES = {
  card: "카드",
  modern: "모던",
  minimal: "미니멀",
  text: "텍스트 중심",
} as const;
export type Template = keyof typeof TEMPLATES;

export type BlockItem = {
  title: string;
  text: string;
  image_keyword: string;
  image_url: string;
  url: string;
};

export type Block = {
  id: string;
  type: BlockType;
  heading: string;
  text: string;
  image_keyword: string;
  image_url: string;
  button_label: string;
  button_url: string;
  items: BlockItem[];
};

export type Newsletter = {
  id: string;
  user_id: string;
  site_id: string;
  title: string;
  subject: string;
  preheader: string;
  topic: string;
  prompt: string;
  tone: Tone;
  template: Template;
  greeting: boolean;
  blocks: Block[];
  previous_blocks: Block[] | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SenderSettings = {
  from_name: string;
  reply_to: string;
  footer_text: string;
  logo_url: string;
  accent_color: string;
  brand_context: string;
};

export const DEFAULT_SETTINGS: SenderSettings = {
  from_name: "",
  reply_to: "",
  footer_text: "",
  logo_url: "",
  accent_color: "#2f5d8a",
  brand_context: "",
};



export function newBlockId() {
  return "b" + Math.random().toString(36).slice(2, 10);
}

export function emptyItem(): BlockItem {
  return { title: "", text: "", image_keyword: "", image_url: "", url: "" };
}

export function emptyBlock(type: BlockType): Block {
  const block: Block = {
    id: newBlockId(),
    type,
    heading: "",
    text: "",
    image_keyword: "",
    image_url: "",
    button_label: "",
    button_url: "",
    items: [],
  };
  if (type === "cards") block.items = [emptyItem(), emptyItem()];
  if (type === "thumbs") block.items = [emptyItem(), emptyItem(), emptyItem()];
  if (type === "button") block.button_label = "자세히 보기";
  return block;
}

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const safeUrl = (v: unknown) => {
  const s = str(v, 2000).trim();
  return /^https?:\/\//i.test(s) ? s : "";
};

/** Normalizes untrusted block data (from the browser or the AI) into the Block shape. */
export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 50).flatMap((raw): Block[] => {
    if (!raw || typeof raw !== "object") return [];
    const b = raw as Record<string, unknown>;
    const type = BLOCK_TYPES.includes(b.type as BlockType) ? (b.type as BlockType) : null;
    if (!type) return [];
    const items = Array.isArray(b.items)
      ? b.items.slice(0, 12).map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          return {
            title: str(o.title, 300),
            text: str(o.text, 2000),
            image_keyword: str(o.image_keyword, 200),
            image_url: safeUrl(o.image_url),
            url: safeUrl(o.url),
          };
        })
      : [];
    return [
      {
        id: str(b.id, 40) || newBlockId(),
        type,
        heading: str(b.heading, 500),
        text: str(b.text, 10000),
        image_keyword: str(b.image_keyword, 200),
        image_url: safeUrl(b.image_url),
        button_label: str(b.button_label, 100),
        button_url: safeUrl(b.button_url),
        items,
      },
    ];
  });
}
