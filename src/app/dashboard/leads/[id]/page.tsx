import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { leadExtra, type LeadWithPage } from "@/lib/leads";
import { TERM_KIND_LABEL, isTermKind } from "@/lib/terms";
import { PrintButton } from "./print-button";

export const metadata = { title: "리드 상세 | LEADstation" };

type Consent = {
  id: string;
  required: boolean;
  agreed: boolean;
  agreed_at: string | null;
  term_versions: {
    id: string;
    version: number;
    label: string;
    body: string;
    body_hash: string;
    published_at: string | null;
    terms: { id: string; title: string; kind: string; current_version_id: string | null; archived_at: string | null } | null;
  } | null;
};

const when = (s: string) => new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSite();
  // Row level security limits leads to the working site.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, page_id, name, email, phone, message, address, gender, age, nationality, event, marketing_consent, created_at, pages(title)")
    .eq("id", id)
    .maybeSingle<LeadWithPage>();
  if (!lead) notFound();
  const { data: consents } = await supabase
    .from("lead_consents")
    .select("id, required, agreed, agreed_at, term_versions(id, version, label, body, body_hash, published_at, terms:terms!term_versions_term_id_fkey(id, title, kind, current_version_id, archived_at))")
    .eq("lead_id", id)
    .order("created_at")
    .returns<Consent[]>();

  const info: [string, string | number | null][] = [
    ["이메일", lead.email || null],
    ["전화번호", lead.phone],
    ["주소", lead.address],
    ["성별 · 나이 · 국적", leadExtra({ ...lead, address: null }) || null],
    ["이벤트 결과", lead.event],
    ["마케팅 수신", lead.marketing_consent ? "동의" : "동의 안 함"],
  ];

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/leads" className="text-sm text-slate-500 hover:underline print:hidden">← 리드 관리</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lead.name || "(이름 없음)"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {lead.pages?.title ?? "프로모션"} · {when(lead.created_at)} 신청
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="card mb-6 grid gap-4 p-5 sm:grid-cols-2">
        {info.map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-sm">{v ?? "-"}</p>
          </div>
        ))}
        {lead.message && (
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500">기타</p>
            <p className="whitespace-pre-line text-sm">{lead.message}</p>
          </div>
        )}
      </section>

      <h2 className="mb-2 font-semibold">약관 동의 내역</h2>
      {!consents?.length ? (
        <div className="card p-6 text-sm text-slate-600">이 리드에는 약관 동의 기록이 없어요.</div>
      ) : (
        <div className="space-y-3">
          {consents.map((c) => {
            const v = c.term_versions;
            const t = v?.terms;
            const newer = t?.current_version_id && v && t.current_version_id !== v.id;
            return (
              <details key={c.id} className="card group p-0 print:break-inside-avoid" open={consents.length === 1}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-sm">
                  <span className="min-w-48 flex-1 font-medium">
                    {t?.title ?? "약관"}
                    {t && isTermKind(t.kind) && <span className="ml-2 text-xs font-normal text-slate-500">{TERM_KIND_LABEL[t.kind]}</span>}
                  </span>
                  <span className="text-slate-600">{c.required ? "필수" : "선택"}</span>
                  <span className={c.agreed ? "font-medium text-emerald-700" : "text-slate-500"}>{c.agreed ? "동의" : "동의 안 함"}</span>
                  <span>v{v?.version ?? "?"}</span>
                  <span className="text-slate-500">{c.agreed_at ? when(c.agreed_at) : "-"}</span>
                  <span className="text-xs text-indigo-600 group-open:hidden print:hidden">전문 보기</span>
                  <span className="hidden text-xs text-indigo-600 group-open:inline print:hidden">전문 접기</span>
                </summary>
                {v && (
                  <div className="space-y-3 border-t border-slate-100 px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        [{c.required ? "필수" : "선택"}] {v.label}
                      </p>
                      {newer && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">동의 이후 약관이 새 버전으로 바뀌었어요</span>}
                    </div>
                    <p className="whitespace-pre-line leading-relaxed text-slate-700">{v.body || "(전문 없음)"}</p>
                    <p className="text-xs text-slate-500">
                      v{v.version}
                      {v.published_at && ` · ${when(v.published_at)} 발행`} · 본문 지문(SHA-256) {v.body_hash.slice(0, 16)}…
                      {t?.archived_at && " · 지금은 보관된 약관"}
                    </p>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500 print:hidden">전문은 지금 버전이 아니라 이 리드가 동의할 때 보였던 버전 그대로예요. 약관을 고치거나 보관해도 바뀌지 않아요.</p>
    </div>
  );
}
