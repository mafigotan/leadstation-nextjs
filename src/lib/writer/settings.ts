import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WRITER_SETTINGS, type WriterSettings } from "./types";

export async function loadWriterSettings(supabase: SupabaseClient, userId: string): Promise<WriterSettings> {
  const { data } = await supabase.from("writer_settings").select("*").eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_WRITER_SETTINGS, ...(data ?? {}) } as WriterSettings;
}
