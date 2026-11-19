import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IMAGE_TOKENS, formatBytes } from "@/lib/plans";

/** What is limited for a site. ai and newsletter are monthly; the rest are totals. storage is in bytes. */
export type UsageKind = "ai" | "newsletter" | "subscribers" | "storage" | "members";
/** What AI and newsletter work records (text and image both count toward "ai"). */
export type RecordKind = "newsletter" | "text" | "image";

export const USAGE_LABEL: Record<UsageKind, string> = {
  ai: "AI 사용량",
  newsletter: "뉴스레터 발송 건수",
  subscribers: "구독자 수",
  storage: "미디어 용량",
  members: "멤버 수",
};

const KINDS = new Set<string>(Object.keys(USAGE_LABEL));

export type UsageRow = { kind: UsageKind; used: number; limit_value: number | null };

type Meter = { text: number; image: number };
const store = new AsyncLocalStorage<Meter>();

/** Called by the AI helpers with the tokens a call used; counted when running inside metered(). */
export function addUsage(kind: "text" | "image", tokens: number | undefined | null) {
  const m = store.getStore();
  if (m && tokens && tokens > 0) m[kind] += Math.round(tokens);
}

/** Usage and limits for a site (this month for ai and newsletter). */
export async function loadUsage(supabase: SupabaseClient, siteId: string): Promise<UsageRow[]> {
  const { data } = await supabase.rpc("site_usage", { p_site: siteId });
  return ((data ?? []) as UsageRow[])
    .filter((r) => KINDS.has(r.kind))
    .map((r) => ({ ...r, used: Number(r.used), limit_value: r.limit_value === null ? null : Number(r.limit_value) }));
}

export class LimitError extends Error {}

function amount(kind: UsageKind, n: number) {
  if (kind === "storage") return formatBytes(n);
  const unit = kind === "ai" ? "토큰" : kind === "newsletter" ? "건" : "명";
  return `${n.toLocaleString()}${unit}`;
}

/** Throws a LimitError when the site has used up a limit (or would, for `need` more units). */
export async function checkLimit(supabase: SupabaseClient, siteId: string, kind: UsageKind, need = 1) {
  const row = (await loadUsage(supabase, siteId)).find((r) => r.kind === kind);
  if (!row || row.limit_value === null) return;
  const left = row.limit_value - row.used;
  if (left <= 0 || need > left) {
    const label = USAGE_LABEL[kind];
    const monthly = kind === "ai" || kind === "newsletter" ? "이번 달 " : "";
    throw new LimitError(
      left <= 0
        ? `${monthly}${label} 한도(${amount(kind, row.limit_value)})를 모두 사용했어요. 대시보드에서 '이용 한도 늘리기'를 요청하거나 요금제 변경을 문의해주세요.`
        : `${monthly}${label}가 ${amount(kind, left)} 남아 이번 작업(${amount(kind, need)})을 할 수 없어요. 대시보드에서 '이용 한도 늘리기'를 요청하거나 요금제 변경을 문의해주세요.`,
    );
  }
}

export async function recordUsage(supabase: SupabaseClient, kind: RecordKind, amount: number) {
  if (amount > 0) {
    const { error } = await supabase.rpc("record_usage", { p_kind: kind, p_amount: Math.round(amount) });
    if (error) console.error("record usage failed", error);
  }
}

/**
 * Runs an AI task for the site: refuses when the AI limit is used up, then records the tokens the task used
 * (also when it fails part-way, since the tokens were spent). An image task needs room for one image.
 */
export async function metered<T>(supabase: SupabaseClient, siteId: string, kinds: ("text" | "image")[], fn: () => Promise<T>): Promise<T> {
  await checkLimit(supabase, siteId, "ai", kinds.includes("image") ? IMAGE_TOKENS : 1);
  const meter: Meter = { text: 0, image: 0 };
  try {
    return await store.run(meter, fn);
  } finally {
    await recordUsage(supabase, "text", meter.text);
    await recordUsage(supabase, "image", meter.image);
  }
}

export function limitMessage(e: unknown) {
  return e instanceof LimitError ? e.message : null;
}
