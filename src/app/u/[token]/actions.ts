"use server";

import { createClient } from "@/lib/supabase/server";

export async function setSubscription(token: string, subscribed: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "잘못된 링크예요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_subscription", { p_token: token, p_subscribed: subscribed });
  if (error || !data) return { error: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." };
  return { ok: true };
}
