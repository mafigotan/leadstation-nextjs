"use server";

import { revalidatePath } from "next/cache";
import { requireSite, requireUser } from "@/lib/supabase/server";

export async function markNotificationRead(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/dashboard");
}

/** Admin approves or declines a request to use the site. */
export async function answerJoinRequest(requestId: string, approve: boolean) {
  const { supabase, role } = await requireSite();
  if (role !== "admin") return;
  const { error } = await supabase.rpc("answer_join_request", { p_id: requestId, p_approve: approve });
  if (error) console.error("answer join request failed", error);
  revalidatePath("/dashboard", "layout");
}
