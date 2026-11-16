// Promotion page elements. Older pages store fixed fields only; toSections() builds elements from them.
import type { PageContent } from "./types";
import { cleanFields, type LeadField } from "./lead-fields";
import { sanitizeGame, type EventGame } from "./event-game";
import { sanitizeFormTerms, type FormTerm } from "./terms";

export const SECTION_TYPES = ["hero", "image", "benefits", "cards", "text", "quote", "button", "form", "event", "divider"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "상단 소개",
  image: "이미지",
  benefits: "혜택 목록",
  cards: "이미지 카드",
  text: "문단",
  quote: "강조 문구",
  button: "버튼",
  form: "신청 폼",
  event: "이벤트",
  divider: "구분선",
};

export type SectionItem = { title: string; description: string; image_url: string };
export type Section = {
  id: string;
  type: SectionType;
  badge: string;
  heading: string;
  text: string;
  image_url: string;
  label: string;
  url: string;
  items: SectionItem[];
  /** Lead form fields (form sections only). Empty means the legacy set. */
  fields?: LeadField[];
  /** Lead form fields that must be filled in (form sections only). Missing means all but 기타. */
  required?: LeadField[];
  /** Terms on the lead form (form sections only). Missing means the site's default terms. */
  terms?: FormTerm[];
  /** Show an "agree to all" checkbox above the terms (form sections only). */
  agree_all?: boolean;
  /** AI-made game (event sections only). */
  game?: EventGame;
};

export const newSectionId = () => "s" + Math.random().toString(36).slice(2, 10);

export function emptySection(type: SectionType): Section {
  const s: Section = { id: newSectionId(), type, badge: "", heading: "", text: "", image_url: "", label: "", url: "", items: [] };
  if (type === "benefits") s.items = [1, 2, 3].map(() => ({ title: "", description: "", image_url: "" }));
  if (type === "cards") s.items = [1, 2, 3].map(() => ({ title: "", description: "", image_url: "" }));
  if (type === "button") s.label = "자세히 보기";
  if (type === "event") {
    s.heading = "이벤트에 참여하세요";
    s.text = "게임에 참여하고 결과를 확인한 뒤 아래 신청 폼을 작성해 주세요.";
  }
  if (type === "form") {
    s.heading = "지금 신청하세요";
    s.label = "신청하기";
  }
  return s;
}

/** The intro has no image of its own: an image saved on an older intro becomes an image element right below it. */
function splitHeroImages(sections: Section[]): Section[] {
  return sections.flatMap((s) =>
    s.type === "hero" && s.image_url
      ? [{ ...s, image_url: "" }, { ...emptySection("image"), id: `${s.id}i`.slice(0, 40), image_url: s.image_url }]
      : [s],
  );
}

export function toSections(c: PageContent): Section[] {
  if (Array.isArray(c.sections) && c.sections.length) return splitHeroImages(sanitizeSections(c.sections));
  const out: Section[] = [
    { ...emptySection("hero"), badge: c.badge ?? "", heading: c.headline ?? "", text: c.subheadline ?? "", label: c.cta_label ?? "" },
    { ...emptySection("image"), image_url: c.hero_image ?? "" },
  ];
  if (c.benefits?.length) out.push({ ...emptySection("benefits"), items: c.benefits.map((b) => ({ title: b.title, description: b.description, image_url: "" })) });
  if (c.details) out.push({ ...emptySection("text"), text: c.details });
  out.push({ ...emptySection("form"), heading: c.form_title ?? "", text: c.form_description ?? "", label: c.cta_label || "신청하기" });
  return out;
}

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const url = (v: unknown) => {
  const s = str(v, 2000).trim();
  return /^https?:\/\//i.test(s) || s.startsWith("#") ? s : "";
};

export function sanitizeSections(input: unknown): Section[] {
  if (!Array.isArray(input)) return [];
  let forms = 0;
  return input.slice(0, 60).flatMap((raw): Section[] => {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (!SECTION_TYPES.includes(r.type as SectionType)) return [];
    // A promotion has one lead form.
    if (r.type === "form" && forms++ > 0) return [];
    return [
      {
        id: str(r.id, 40) || newSectionId(),
        type: r.type as SectionType,
        badge: str(r.badge, 100),
        heading: str(r.heading, 300),
        text: str(r.text, 5000),
        image_url: url(r.image_url),
        label: str(r.label, 60),
        url: url(r.url),
        ...(r.type === "form" && cleanFields(r.fields).length ? { fields: cleanFields(r.fields) } : {}),
        ...(r.type === "form" && Array.isArray(r.required) ? { required: cleanFields(r.required) } : {}),
        ...(r.type === "form" && Array.isArray(r.terms) ? { terms: sanitizeFormTerms(r.terms), agree_all: r.agree_all === true } : {}),
        ...(r.type === "event" && sanitizeGame(r.game) ? { game: sanitizeGame(r.game) } : {}),
        items: Array.isArray(r.items)
          ? r.items.slice(0, 12).map((it) => {
              const o = (it ?? {}) as Record<string, unknown>;
              return { title: str(o.title, 200), description: str(o.description, 1000), image_url: url(o.image_url) };
            })
          : [],
      },
    ];
  });
}

/** Keeps the fixed fields (used for page titles, lists and search) in step with the elements. */
export function withSections(c: PageContent, sections: Section[]): PageContent {
  const hero = sections.find((s) => s.type === "hero");
  const image = sections.find((s) => s.type === "image" && s.image_url);
  const form = sections.find((s) => s.type === "form");
  const benefits = sections.find((s) => s.type === "benefits");
  return {
    ...c,
    badge: hero?.badge ?? c.badge,
    headline: hero?.heading || c.headline,
    subheadline: hero?.text ?? c.subheadline,
    hero_image: image?.image_url ?? "",
    cta_label: form?.label || hero?.label || c.cta_label,
    form_title: form?.heading ?? c.form_title,
    form_description: form?.text ?? c.form_description,
    benefits: benefits ? benefits.items.map((b) => ({ title: b.title, description: b.description })) : c.benefits,
    lead_form: !!form,
    sections,
  };
}

/** Pages with an event element record the game result in the lead form. */
export const hasEvent = (sections: Section[]) => sections.some((s) => s.type === "event");
