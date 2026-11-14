import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { Pager, Table, Th, UserStatus, fmtDate, fmtDateTime } from "../ui";

const SIZE = 30;

type Row = {
  user_id: string; email: string; full_name: string; phone: string; company: string;
  created_at: string; last_sign_in_at: string | null; suspended_at: string | null; sites: string; total: number;
};

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = ["suspended", "normal"].includes(sp.status ?? "") ? sp.status! : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase } = await requireSuperAdmin();
  const { data, error } = await supabase.rpc("admin_user_list", { p_query: q, p_status: status, p_limit: SIZE, p_offset: (page - 1) * SIZE });
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total ?? 0;
  const href = (p: number) => `/admin/users?${new URLSearchParams({ q, status, page: String(p) })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">유저 <span className="text-base font-normal text-slate-500">{total.toLocaleString()}명</span></h1>
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="이름, 이메일, 회사, 전화번호, 사이트 주소" className="input w-72" />
          <select name="status" defaultValue={status} className="input w-auto">
            <option value="all">전체</option>
            <option value="normal">정상</option>
            <option value="suspended">정지</option>
          </select>
          <button className="btn-primary">검색</button>
        </form>
      </div>
      {error && <p className="text-sm text-red-600">불러오지 못했어요: {error.message}</p>}
      <Table head={<><Th>이름</Th><Th>이메일</Th><Th>회사</Th><Th>전화번호</Th><Th>사이트</Th><Th>가입일</Th><Th>최근 로그인</Th><Th>상태</Th></>}>
        {rows.map((r) => (
          <tr key={r.user_id} className="hover:bg-slate-50">
            <td className="px-3 py-2 font-medium"><Link href={`/admin/users/${r.user_id}`} className="text-indigo-600 hover:underline">{r.full_name || "(미입력)"}</Link></td>
            <td className="px-3 py-2 text-slate-600">{r.email}</td>
            <td className="px-3 py-2">{r.company || "-"}</td>
            <td className="whitespace-nowrap px-3 py-2">{r.phone || "-"}</td>
            <td className="max-w-[14rem] truncate px-3 py-2 text-slate-600" title={r.sites}>{r.sites || "-"}</td>
            <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(r.created_at)}</td>
            <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDateTime(r.last_sign_in_at)}</td>
            <td className="px-3 py-2"><UserStatus suspended={!!r.suspended_at} /></td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">유저가 없어요.</td></tr>}
      </Table>
      <Pager page={page} total={total} size={SIZE} href={href} />
    </div>
  );
}
