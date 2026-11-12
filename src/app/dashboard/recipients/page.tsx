import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { RecipientsTable } from "./recipients-table";
import { ImportPanel } from "./import-panel";
import { GroupsPanel } from "./groups-panel";
import { AddRecipient } from "./add-recipient";

export const metadata = { title: "수신자 | LEADstation" };
export const maxDuration = 60;

const PAGE_SIZE = 50;

export default async function RecipientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; group?: string; page?: string }>;
}) {
  const { q, status, group, page } = await searchParams;
  const pageNo = Math.max(1, Number(page) || 1);
  const { supabase } = await requireUser();

  const { data: groups } = await supabase.from("recipient_groups").select("id, name, recipient_group_members(count)").order("name");

  let query = supabase
    .from("recipients")
    .select(
      group
        ? "id, email, name, phone, company, status, source, last_sent_at, created_at, gm:recipient_group_members!inner(group_id), groups:recipient_group_members(recipient_groups(name))"
        : "id, email, name, phone, company, status, source, last_sent_at, created_at, groups:recipient_group_members(recipient_groups(name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE - 1);
  if (group) query = query.eq("gm.group_id", group);
  if (status === "subscribed" || status === "unsubscribed") query = query.eq("status", status);
  const term = q?.trim().replace(/[%,()*]/g, " ");
  if (term) query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%,company.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data: rows, count } = await query;

  const [{ count: subscribed }, { count: unsubscribed }] = await Promise.all([
    supabase.from("recipients").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
    supabase.from("recipients").select("id", { count: "exact", head: true }).eq("status", "unsubscribed"),
  ]);

  const groupList = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    count: (g.recipient_group_members as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
  const recipients = (rows ?? []).map((r) => {
    const row = r as unknown as {
      id: string; email: string; name: string; phone: string; company: string; status: string; source: string;
      last_sent_at: string | null; created_at: string; groups: { recipient_groups: { name: string } | null }[];
    };
    return { ...row, groups: row.groups.map((g) => g.recipient_groups?.name).filter(Boolean) as string[] };
  });
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (group) sp.set("group", group);
    sp.set("page", String(p));
    return `?${sp}`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">수신자</h1>
        <p className="mt-1 text-sm text-slate-500">구독 {subscribed ?? 0}명 · 수신거부 {unsubscribed ?? 0}명</p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <AddRecipient groups={groupList} />
        <ImportPanel groups={groupList} />
        <GroupsPanel groups={groupList} />
      </div>

      <form className="card mb-4 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={q ?? ""} placeholder="이메일, 이름, 회사, 연락처 검색" className="input min-w-48 flex-1" />
        <select name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">전체 상태</option>
          <option value="subscribed">구독</option>
          <option value="unsubscribed">수신거부</option>
        </select>
        <select name="group" defaultValue={group ?? ""} className="input w-auto">
          <option value="">전체 그룹</option>
          {groupList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button className="btn-primary">검색</button>
      </form>

      <RecipientsTable recipients={recipients} groups={groupList} total={count ?? 0} />

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {pageNo > 1 && <Link className="btn-secondary" href={qs(pageNo - 1)}>이전</Link>}
          <span className="text-slate-500">{pageNo} / {pages}</span>
          {pageNo < pages && <Link className="btn-secondary" href={qs(pageNo + 1)}>다음</Link>}
        </div>
      )}
    </div>
  );
}
