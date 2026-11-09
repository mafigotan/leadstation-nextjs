import { z } from "zod";

export const THEMES = ["indigo", "emerald", "rose", "amber", "slate"] as const;
export type Theme = (typeof THEMES)[number];

export const PageContentSchema = z.object({
  badge: z.string().describe("Short label above the headline, e.g. '기간 한정 이벤트'"),
  headline: z.string().describe("Main headline, under 30 characters"),
  subheadline: z.string().describe("One or two sentences that expand on the headline"),
  benefits: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .describe("Three or four key benefits"),
  details: z.string().describe("A short paragraph with offer details, conditions or schedule"),
  cta_label: z.string().describe("Submit button text, under 12 characters"),
  form_title: z.string().describe("Title above the sign-up form"),
  form_description: z.string().describe("One sentence telling visitors what they get by signing up"),
  theme: z.enum(THEMES).describe("Accent color that fits the product and tone"),
});

export type PageContent = z.infer<typeof PageContentSchema>;

export const BriefSchema = z.object({
  product: z.string().trim().min(1, "상품 또는 서비스명을 입력해 주세요.").max(200),
  description: z.string().trim().min(1, "설명을 입력해 주세요.").max(3000),
  audience: z.string().trim().max(500).default(""),
  offer: z.string().trim().max(1000).default(""),
  tone: z.string().trim().max(100).default("신뢰감 있고 친근한"),
});

export type Brief = z.infer<typeof BriefSchema>;

export type PageRow = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  brief: Brief;
  content: PageContent;
  created_at: string;
  updated_at: string;
};

export type LeadRow = {
  id: string;
  page_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  marketing_consent: boolean;
  created_at: string;
};

export const THEME_CLASSES: Record<Theme, { bg: string; text: string; soft: string; ring: string }> = {
  indigo: { bg: "bg-indigo-600 hover:bg-indigo-700", text: "text-indigo-600", soft: "bg-indigo-50", ring: "focus:ring-indigo-500" },
  emerald: { bg: "bg-emerald-600 hover:bg-emerald-700", text: "text-emerald-600", soft: "bg-emerald-50", ring: "focus:ring-emerald-500" },
  rose: { bg: "bg-rose-600 hover:bg-rose-700", text: "text-rose-600", soft: "bg-rose-50", ring: "focus:ring-rose-500" },
  amber: { bg: "bg-amber-600 hover:bg-amber-700", text: "text-amber-700", soft: "bg-amber-50", ring: "focus:ring-amber-500" },
  slate: { bg: "bg-slate-800 hover:bg-slate-900", text: "text-slate-800", soft: "bg-slate-100", ring: "focus:ring-slate-500" },
};
