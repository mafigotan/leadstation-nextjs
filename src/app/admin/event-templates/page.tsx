import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { Table, Th, fmtDateTime } from "../ui";
import { TemplateStatus } from "./status";
import { NewTemplateForm, RequestAnswer } from "./forms";

export const metadata = { title: "이벤트 템플릿 | 슈퍼 관리자" };

type Req = { id: string; game_type: string; description: string; usage: string; status: string; admin_note: string; created_at: string; site_id: string; sites: { handle: string; name: string } | null };

export default async function EventTemplates({ searchParams }: { searchParams: Promise<{ from?: string; done?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireSuperAdmin();
  let reqQuery = supabase
    .from("event_template_requests")
    .select("id, game_type, description, usage, status, admin_note, created_at, site_id, sites(handle, name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!sp.done) reqQuery = reqQuery.eq("status", "pending");
  const { data: reqData } = await reqQuery;
  const requests = (reqData ?? []) as unknown as Req[];
  const from = requests.find((r) => r.id === sp.from);
  const { data } = await supabase
    .from("event_templates")
    .select("id, name, description, status, is_public, sort_order, updated_at, revising_since, job_batch_id")
    .order("sort_order")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const readyTemplates = rows.filter((t) => t.status === "ready").map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">이벤트 템플릿</h1>
        <p className="mt-1 text-sm text-slate-500">AI로 고품질 이벤트 게임 템플릿을 만들고, 공개한 템플릿을 모든 유저가 프로모션의 이벤트 요소에서 고를 수 있어요.</p>
      </div>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">유저의 템플릿 요청 {!sp.done && <span className="text-sm font-normal text-slate-500">대기 {requests.length}건</span>}</h2>
          <Link href={sp.done ? "/admin/event-templates" : "/admin/event-templates?done=1"} className="text-sm text-indigo-600 hover:underline">{sp.done ? "대기 중인 요청만 보기" : "처리한 요청도 보기"}</Link>
        </div>
        {requests.length === 0 ? (
          <p className="card p-6 text-center text-sm text-slate-500">대기 중인 요청이 없어요.</p>
        ) : (
          <div className="card divide-y divide-slate-100">
            {requests.map((r) => (
              <div key={r.id} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/sites/${r.site_id}`} className="font-medium text-indigo-600 hover:underline">{r.sites?.name || r.sites?.handle}</Link>
                  {r.game_type && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.game_type}</span>}
                  <span className="text-xs text-slate-400">{fmtDateTime(r.created_at)}</span>
                  {r.status !== "pending" && <span className="text-xs text-slate-500">{r.status === "done" ? "완료" : "반려"}{r.admin_note ? ` · ${r.admin_note}` : ""}</span>}
                </div>
                <p className="whitespace-pre-line">{r.description}</p>
                {r.usage && <p className="whitespace-pre-line text-xs text-slate-500">사용할 프로모션: {r.usage}</p>}
                {r.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/admin/event-templates?from=${r.id}`} className="text-xs font-medium text-indigo-600 hover:underline">이 요청으로 템플릿 만들기 →</Link>
                    <div className="min-w-0 flex-1"><RequestAnswer id={r.id} templates={readyTemplates} /></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <NewTemplateForm
        key={from?.id ?? "new"}
        initial={from ? { name: from.game_type || "요청 템플릿", description: "", prompt: [from.game_type && `게임 종류: ${from.game_type}`, from.description, from.usage && `사용할 프로모션: ${from.usage}`].filter(Boolean).join("\n\n") } : undefined}
      />
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
