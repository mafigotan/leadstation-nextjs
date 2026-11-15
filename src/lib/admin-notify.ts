import "server-only";

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Super admin email addresses (service role), plus ADMIN_NOTIFY_EMAIL if set. */
export async function superAdminEmails() {
  const out = new Set((process.env.ADMIN_NOTIFY_EMAIL ?? "").split(/[,\s]+/).filter(Boolean));
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.from("platform_admins").select("user_id");
    for (const r of data ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(r.user_id);
      if (u.user?.email) out.add(u.user.email);
    }
  }
  return [...out];
}

