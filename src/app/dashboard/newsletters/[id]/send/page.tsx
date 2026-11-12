import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { SendPanel } from "./send-panel";

export const maxDuration = 60;

export default async function SendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: nl } = await supabase.from("newsletters").select("id, title, subject, status, blocks").eq("id", id).single();
  if (!nl) notFound();

  const [{ data: groups }, { data: campaigns }, { count: subscribed }, { data: settings }] = await Promise.all([
    supabase.from("recipient_groups").select("id, name, recipient_group_members(count)").order("name"),
    supabase
      .from("campaigns")
      .select("id, type, subject, total, sent, failed, status, scheduled_at, started_at, finished_at, created_at")
      .eq("newsletter_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("recipients").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
    supabase.from("newsletter_settings").select("from_name").maybeSingle(),
  ]);

  const failedLogs: Record<string, { email: string; error: string }[]> = {};
  for (const c of campaigns ?? []) {
    if (c.failed > 0) {
      const { data } = await supabase.from("send_logs").select("email, error").eq("campaign_id", c.id).eq("status", "failed").limit(50);
      failedLogs[c.id] = data ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/newsletters/${id}`} className="text-sm text-slate-500 hover:underline">← 편집으로</Link>
      <h1 className="mt-1 text-2xl font-bold">발송</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        {nl.title} · 제목: {nl.subject || <span className="text-red-600">미입력</span>}
      </p>
      {!settings?.from_name && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          보내는 사람 이름이 비어 있어요. <Link href="/dashboard/newsletters/settings" className="underline">발신 정보</Link>를 먼저 설정하는 걸 추천해요.
        </p>
      )}
      <SendPanel
        newsletterId={id}
        hasBody={Array.isArray(nl.blocks) && nl.blocks.length > 0}
        subscribed={subscribed ?? 0}
        groups={(groups ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          count: (g.recipient_group_members as unknown as { count: number }[])?.[0]?.count ?? 0,
        }))}
        campaigns={campaigns ?? []}
        failedLogs={failedLogs}
      />
    </div>
  );
}
