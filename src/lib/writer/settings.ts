import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WRITER_SETTINGS, type WriterSettings } from "./types";

export async function loadWriterSettings(supabase: SupabaseClient, siteId: string): Promise<WriterSettings> {
  const { data } = await supabase.from("writer_settings").select("*").eq("site_id", siteId).maybeSingle();
  return { ...DEFAULT_WRITER_SETTINGS, ...(data ?? {}) } as WriterSettings;
}
