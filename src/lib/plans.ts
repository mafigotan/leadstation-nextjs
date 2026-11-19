import type { SupabaseClient } from "@supabase/supabase-js";

// Plans (요금제). Rows live in the `plans` table (0019_plans.sql); super admins apply them with offline payments.

export type PlanCode = "free" | "basic" | "standard" | "pro" | "custom";

export type Plan = {
  code: PlanCode;
  name: string;
  monthly_price: number | null;
  trial_days: number | null;
  ai_token_limit: number | null;
  newsletter_limit: number | null;
  subscriber_limit: number | null;
  storage_mb_limit: number | null;
  member_limit: number | null;
  sort: number;
};

export const PLAN_COLUMNS =
  "code, name, monthly_price, trial_days, ai_token_limit, newsletter_limit, subscriber_limit, storage_mb_limit, member_limit, sort";

/** Per-site limit columns that override the plan's value when set. */
export const LIMIT_COLUMNS = ["ai_token_limit", "newsletter_limit", "subscriber_limit", "storage_mb_limit", "member_limit"] as const;
export type LimitColumn = (typeof LIMIT_COLUMNS)[number];

export const LIMIT_LABEL: Record<LimitColumn, [string, string]> = {
  ai_token_limit: ["AI 사용량", "토큰/월"],
  newsletter_limit: ["뉴스레터 발송", "통/월"],
  subscriber_limit: ["구독자 수", "명"],
  storage_mb_limit: ["미디어 용량", "MB"],
  member_limit: ["멤버", "명"],
};

/** Tokens counted for one AI image (images cost about three times as much per token as text). */
export const IMAGE_TOKENS = 4000;

export function planName(code?: string | null) {
  return code ? code.toUpperCase() : "미지정";
}

export async function loadPlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data } = await supabase.from("plans").select(PLAN_COLUMNS).order("sort");
  return ((data ?? []) as Plan[]).map((p) => ({
    ...p,
    monthly_price: p.monthly_price === null ? null : Number(p.monthly_price),
    ai_token_limit: num(p.ai_token_limit),
    newsletter_limit: num(p.newsletter_limit),
    subscriber_limit: num(p.subscriber_limit),
    storage_mb_limit: num(p.storage_mb_limit),
    member_limit: num(p.member_limit),
  }));
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** "1,300,000" → "130만", used in short labels. */
export function shortCount(n: number) {
  if (n >= 10000 && n % 10000 === 0) return `${(n / 10000).toLocaleString()}만`;
  return n.toLocaleString();
}

export function formatMb(mb: number) {
  return mb >= 1024 ? `${+(mb / 1024).toFixed(1)}GB` : `${mb}MB`;
}

export function formatBytes(b: number) {
  if (b >= 1024 ** 3) return `${+(b / 1024 ** 3).toFixed(2)}GB`;
  if (b >= 1024 ** 2) return `${+(b / 1024 ** 2).toFixed(1)}MB`;
  return `${Math.round(b / 1024)}KB`;
}

/** Display value of one plan limit. */
export function limitText(col: LimitColumn, v: number | null) {
  if (v === null) return "무제한";
  if (col === "storage_mb_limit") return formatMb(v);
  if (col === "ai_token_limit") return `${shortCount(v)} 토큰`;
  const unit = col === "newsletter_limit" ? "통" : "명";
  return `${v.toLocaleString()}${unit}`;
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(d: string, n: number) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** End date of a period of `months` months starting on `from` (the day before the same date N months later). */
export function periodEnd(from: string, months: number) {
  const t = new Date(from + "T00:00:00Z");
  const day = t.getUTCDate();
  t.setUTCDate(1);
  t.setUTCMonth(t.getUTCMonth() + months);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return addDays(t.toISOString().slice(0, 10), -1);
}
