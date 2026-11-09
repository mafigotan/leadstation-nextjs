"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";

export async function deleteLead(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("leads").delete().eq("id", id);
  revalidatePath("/dashboard/leads");
}
