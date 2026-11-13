import { requireSite } from "@/lib/supabase/server";
import { queryLeads } from "@/lib/leads";
import { DashboardView, type Activity, type Member, type Notification } from "./view";

export const metadata = { title: "대시보드 | LEADstation" };

export default async function DashboardHome() {
  const { supabase, user, profile, site, role } = await requireSite();
  const isAdmin = role === "admin";

  const [notes, pages, articles, newsletters, media, leads, members, logs] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, ref_id, created_at").eq("user_id", user.id).is("read_at", null)
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("pages").select("id, title, status, created_at").eq("site_id", site.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("articles").select("id, title, keyword, status, created_at").eq("site_id", site.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("newsletters").select("id, title, subject, status, created_at").eq("site_id", site.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("media").select("id, url, prompt").eq("site_id", site.id).order("created_at", { ascending: false }).limit(6),
    queryLeads(supabase, { limit: 10 }),
    supabase.rpc("site_member_list", { p_site: site.id }),
    supabase.from("activity_logs").select("id, user_id, action, target_type, target_id, title, created_at").eq("site_id", site.id)
      .order("created_at", { ascending: false }).limit(300),
  ]);

  const notifications = (notes.data ?? []) as Notification[];
  // Join requests that are still open (an admin may have answered from another account).
  const requestIds = notifications.filter((n) => n.kind === "join_request" && n.ref_id).map((n) => n.ref_id!);
  const { data: openRequests } = requestIds.length
    ? await supabase.from("site_join_requests").select("id").in("id", requestIds).eq("status", "pending")
    : { data: [] };
  const open = new Set((openRequests ?? []).map((r) => r.id));

  const memberList = (members.data ?? []) as Member[];
  const byUser = new Map<string, Activity[]>();
  for (const a of (logs.data ?? []) as Activity[]) {
    if (!a.user_id) continue;
    const list = byUser.get(a.user_id) ?? [];
    if (list.length < 5) list.push(a);
    byUser.set(a.user_id, list);
  }
  const people = memberList
    .map((m) => ({ ...m, items: byUser.get(m.user_id) ?? [] }))
    .sort((a, b) => (b.items[0]?.created_at ?? "").localeCompare(a.items[0]?.created_at ?? ""));

  return (
    <DashboardView
      name={profile.full_name}
      site={site}
      isAdmin={isAdmin}
      notifications={notifications}
      open={open}
      pages={pages.data ?? []}
      articles={articles.data ?? []}
      newsletters={newsletters.data ?? []}
      media={media.data ?? []}
      leads={leads}
      people={people}
    />
  );
}
