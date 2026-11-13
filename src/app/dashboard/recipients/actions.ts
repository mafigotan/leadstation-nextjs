"use server";

import { revalidatePath } from "next/cache";
import { requireSite } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type RecipientInput = { email: string; name?: string; phone?: string; company?: string; memo?: string; group?: string };

async function resolveGroups(supabase: Awaited<ReturnType<typeof requireSite>>["supabase"], siteId: string, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 200);
  if (!unique.length) return new Map<string, string>();
  await supabase.from("recipient_groups").upsert(
    unique.map((name) => ({ site_id: siteId, name: name.slice(0, 100) })),
    { onConflict: "site_id,name", ignoreDuplicates: true },
  );
  const { data } = await supabase.from("recipient_groups").select("id, name").in("name", unique);
  return new Map((data ?? []).map((g) => [g.name, g.id]));
}

/** Adds or updates recipients. `overwrite` updates name/phone/company/memo of existing addresses. */
export async function importRecipients(rows: RecipientInput[], groupId: string | null, overwrite: boolean, source: "manual" | "import" | "lead" = "import") {
  const { supabase, user, site } = await requireSite();
  const clean = rows
    .slice(0, 20000)
    .map((r) => ({
      email: s(r.email, 200).toLowerCase(),
      name: s(r.name, 190),
      phone: s(r.phone, 50),
      company: s(r.company, 190),
      memo: s(r.memo, 1000),
      group: s(r.group, 100),
    }))
    .filter((r) => EMAIL_RE.test(r.email));
  const byEmail = new Map(clean.map((r) => [r.email, r]));
  const list = [...byEmail.values()];
  const invalid = rows.length - clean.length;
  if (!list.length) return { error: "올바른 이메일 주소가 없어요.", added: 0, updated: 0, invalid };

  const { count: before } = await supabase.from("recipients").select("id", { count: "exact", head: true });
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500).map((r) => ({
      email: r.email,
      name: r.name,
      phone: r.phone,
      company: r.company,
      memo: r.memo,
      site_id: site.id, user_id: user.id,
      source,
    }));
    const { error } = await supabase.from("recipients").upsert(chunk, { onConflict: "site_id,email", ignoreDuplicates: !overwrite });
    if (error) {
      console.error("import recipients failed", error);
      return { error: "저장 중 오류가 발생했어요.", added: 0, updated: 0, invalid };
    }
  }
  const { count: after } = await supabase.from("recipients").select("id", { count: "exact", head: true });
  const added = (after ?? 0) - (before ?? 0);

  // Group membership: the selected group, plus a per-row "group" column.
  const groupNames = list.map((r) => r.group).filter(Boolean);
  const groupMap = await resolveGroups(supabase, site.id, groupNames);
  if (groupId || groupMap.size) {
    const members: { group_id: string; recipient_id: string }[] = [];
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500);
      const { data } = await supabase.from("recipients").select("id, email").in("email", chunk.map((r) => r.email));
      const idByEmail = new Map((data ?? []).map((r) => [r.email, r.id]));
      for (const r of chunk) {
        const rid = idByEmail.get(r.email);
        if (!rid) continue;
        if (groupId) members.push({ group_id: groupId, recipient_id: rid });
        if (r.group && groupMap.get(r.group)) members.push({ group_id: groupMap.get(r.group)!, recipient_id: rid });
      }
    }
    for (let i = 0; i < members.length; i += 1000) {
      await supabase.from("recipient_group_members").upsert(members.slice(i, i + 1000), { ignoreDuplicates: true });
    }
  }

  revalidatePath("/dashboard/recipients");
  return { ok: true, added, updated: overwrite ? list.length - added : 0, skipped: overwrite ? 0 : list.length - added, invalid };
}

/** Copies Lead Collector leads that agreed to marketing into recipients. */
export async function importLeads(groupName: string) {
  const { supabase } = await requireSite();
  const { data: leads } = await supabase
    .from("leads")
    .select("email, name, phone, pages(title)")
    .eq("marketing_consent", true)
    .limit(20000);
  if (!leads?.length) return { error: "마케팅 수신에 동의한 리드가 없어요.", added: 0 };
  const name = s(groupName, 100);
  const rows: RecipientInput[] = leads.map((l) => ({
    email: l.email,
    name: l.name,
    phone: l.phone ?? "",
    memo: `리드: ${(l.pages as unknown as { title: string } | null)?.title ?? ""}`,
    group: name,
  }));
  const res = await importRecipients(rows, null, false, "lead");
  return res;
}

export async function addRecipient(_: unknown, formData: FormData) {
  const groupIds = formData.getAll("groups").map(String);
  const res = await importRecipients(
    [
      {
        email: String(formData.get("email") ?? ""),
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        company: String(formData.get("company") ?? ""),
        memo: String(formData.get("memo") ?? ""),
      },
    ],
    null,
    true,
    "manual",
  );
  if (res.error) return res;
  if (groupIds.length) {
    const { supabase } = await requireSite();
    const { data } = await supabase
      .from("recipients")
      .select("id")
      .eq("email", String(formData.get("email")).trim().toLowerCase())
      .single();
    if (data) await supabase.from("recipient_group_members").upsert(groupIds.map((g) => ({ group_id: g, recipient_id: data.id })), { ignoreDuplicates: true });
  }
  revalidatePath("/dashboard/recipients");
  return { ok: true };
}

export async function bulkAction(ids: string[], action: "delete" | "unsubscribe" | "resubscribe" | "add-group" | "remove-group", groupId?: string) {
  const { supabase } = await requireSite();
  const list = ids.slice(0, 5000);
  if (!list.length) return { error: "선택한 수신자가 없어요." };
  if (action === "delete") await supabase.from("recipients").delete().in("id", list);
  if (action === "unsubscribe") await supabase.from("recipients").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).in("id", list);
  if (action === "resubscribe") await supabase.from("recipients").update({ status: "subscribed", unsubscribed_at: null }).in("id", list);
  if (action === "add-group" && groupId) {
    await supabase.from("recipient_group_members").upsert(list.map((id) => ({ group_id: groupId, recipient_id: id })), { ignoreDuplicates: true });
  }
  if (action === "remove-group" && groupId) {
    await supabase.from("recipient_group_members").delete().eq("group_id", groupId).in("recipient_id", list);
  }
  revalidatePath("/dashboard/recipients");
  return { ok: true };
}

export async function createGroup(name: string) {
  const { supabase, user, site } = await requireSite();
  const n = s(name, 100);
  if (!n) return { error: "그룹 이름을 입력해 주세요." };
  const { error } = await supabase.from("recipient_groups").insert({ site_id: site.id, user_id: user.id, name: n });
  if (error) return { error: error.code === "23505" ? "같은 이름의 그룹이 있어요." : "그룹을 만들지 못했어요." };
  revalidatePath("/dashboard/recipients");
  return { ok: true };
}

export async function renameGroup(id: string, name: string) {
  const { supabase } = await requireSite();
  const n = s(name, 100);
  if (!n) return { error: "그룹 이름을 입력해 주세요." };
  const { error } = await supabase.from("recipient_groups").update({ name: n }).eq("id", id);
  if (error) return { error: "이름을 바꾸지 못했어요." };
  revalidatePath("/dashboard/recipients");
  return { ok: true };
}

export async function deleteGroup(id: string) {
  const { supabase } = await requireSite();
  await supabase.from("recipient_groups").delete().eq("id", id);
  revalidatePath("/dashboard/recipients");
  return { ok: true };
}
