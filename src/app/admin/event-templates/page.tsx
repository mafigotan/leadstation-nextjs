import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { Table, Th, fmtDateTime } from "../ui";
import { TemplateStatus } from "./status";
import { NewTemplateForm } from "./forms";

export const metadata = { title: "이벤트 템플릿 | 슈퍼 관리자" };

export default async function EventTemplates() {
  const { supabase } = await requireSuperAdmin();
  const { data } = await supabase
    .from("event_templates")
    .select("id, name, description, status, is_public, sort_order, updated_at, revising_since, job_batch_id")
    .order("sort_order")
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">이벤트 템플릿</h1>
        <p className="mt-1 text-sm text-slate-500">AI로 고품질 이벤트 게임 템플릿을 만들고, 공개한 템플릿을 모든 유저가 프로모션의 이벤트 요소에서 고를 수 있어요.</p>
      </div>
      <NewTemplateForm />
      <Table
        head={
          <>
            <Th>이름</Th>
            <Th>설명</Th>
            <Th>상태</Th>
            <Th right>순서</Th>
            <Th>수정일</Th>
          </>
        }
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-4 py-10 text-center text-slate-500">아직 템플릿이 없어요.</td>
          </tr>
        ) : (
          rows.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium">
                <Link href={`/admin/event-templates/${t.id}`} className="text-indigo-600 hover:underline">{t.name}</Link>
              </td>
              <td className="max-w-sm truncate px-4 py-3 text-slate-600">{t.description || "-"}</td>
              <td className="px-4 py-3"><TemplateStatus t={t} /></td>
              <td className="px-4 py-3 text-right text-slate-500">{t.sort_order}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDateTime(t.updated_at)}</td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
