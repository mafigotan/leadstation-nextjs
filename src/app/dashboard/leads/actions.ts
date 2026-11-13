"use server";

import { revalidatePath } from "next/cache";
import { requireSite } from "@/lib/supabase/server";

export async function deleteLead(id: string) {
  const { supabase } = await requireSite();
  await supabase.from("leads").delete().eq("id", id);
  revalidatePath("/dashboard/leads");
}
