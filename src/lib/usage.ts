import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

/** What is counted against a site's monthly limits. */
export type UsageKind = "newsletter" | "text" | "image";

export const USAGE_LABEL: Record<UsageKind, string> = {
  newsletter: "뉴스레터 발송 건수",
  text: "AI 본문 생성 토큰",
  image: "AI 이미지 생성 토큰",
};

export type UsageRow = { kind: UsageKind; used: number; limit_value: number | null };

type Meter = { text: number; image: number };
const store = new AsyncLocalStorage<Meter>();

/** Called by the AI helpers with the tokens a call used; counted when running inside metered(). */
export function addUsage(kind: "text" | "image", tokens: number | undefined | null) {
  const m = store.getStore();
  if (m && tokens && tokens > 0) m[kind] += Math.round(tokens);
}

/** This month's usage and limits for a site. */
export async function loadUsage(supabase: SupabaseClient, siteId: string): Promise<UsageRow[]> {
  const { data } = await supabase.rpc("site_usage", { p_site: siteId });
  return ((data ?? []) as UsageRow[]).map((r) => ({ ...r, used: Number(r.used), limit_value: r.limit_value === null ? null : Number(r.limit_value) }));
}

export class LimitError extends Error {}

/** Throws a LimitError when the site has used up a limit (or would, for `need` more units). */
export async function checkLimit(supabase: SupabaseClient, siteId: string, kind: UsageKind, need = 1) {
  const row = (await loadUsage(supabase, siteId)).find((r) => r.kind === kind);
  if (!row || row.limit_value === null) return;
  const left = row.limit_value - row.used;
  if (left <= 0 || need > left) {
    const unit = kind === "newsletter" ? "건" : "토큰";
    throw new LimitError(
      left <= 0
        ? `이번 달 ${USAGE_LABEL[kind]} 한도(${row.limit_value.toLocaleString()}${unit})를 모두 사용했어요. 대시보드에서 '이용 한도 늘리기'를 요청해주세요.`
        : `이번 달 ${USAGE_LABEL[kind]}가 ${left.toLocaleString()}${unit} 남아 이번 작업(${need.toLocaleString()}${unit})을 할 수 없어요. 대시보드에서 '이용 한도 늘리기'를 요청해주세요.`,
    );
  }
}

export async function recordUsage(supabase: SupabaseClient, kind: UsageKind, amount: number) {
  if (amount > 0) {
    const { error } = await supabase.rpc("record_usage", { p_kind: kind, p_amount: Math.round(amount) });
    if (error) console.error("record usage failed", error);
  }
}

/**
 * Runs an AI task for the site: refuses when a limit is used up, then records the tokens the task used
 * (also when it fails part-way, since the tokens were spent).
 */
export async function metered<T>(supabase: SupabaseClient, siteId: string, kinds: ("text" | "image")[], fn: () => Promise<T>): Promise<T> {
  for (const k of kinds) await checkLimit(supabase, siteId, k);
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
