import { requireSite } from "@/lib/supabase/server";
import { daysLeft } from "@/lib/site";
import { LIMIT_COLUMNS, LIMIT_LABEL, limitText, loadPlans, planName } from "@/lib/plans";
import { PlanRequestButton } from "./request-button";

export const metadata = { title: "요금제 | LEADstation" };

const METHOD: Record<string, string> = { transfer: "계좌이체", card: "카드(오프라인)", cash: "현금", other: "기타" };

export default async function PlanPage() {
  const { supabase, site, role } = await requireSite();
  const isAdmin = role === "admin";
  const [plans, { data: payments }] = await Promise.all([
    loadPlans(supabase),
    isAdmin
      ? supabase.from("site_payments").select("id, plan, paid_on, amount, method, period_from, period_to").eq("site_id", site.id).order("paid_on", { ascending: false }).limit(24)
      : Promise.resolve({ data: [] as { id: string; plan: string | null; paid_on: string; amount: number; method: string; period_from: string | null; period_to: string | null }[] }),
  ]);
  const left = daysLeft(site.active_until);
  const shown = plans;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">요금제</h1>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm text-slate-500">현재 요금제</p>
          <p className="mt-0.5 text-2xl font-bold">{planName(site.plan ?? null)}</p>
          <p className="mt-1 text-sm">
            이용 기간 {site.active_from || site.active_until ? `${site.active_from ?? "-"} ~ ${site.active_until ?? "-"}` : "기간 제한 없음"}
            {left !== null && left >= 0 && (
              <span className={`ml-2 font-semibold ${left <= 30 ? "text-red-700" : left <= 60 ? "text-amber-700" : "text-slate-600"}`}>
                {left === 0 ? "오늘 종료" : `${left}일 남음`}
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <PlanRequestButton kind="plan_change" />
            <PlanRequestButton kind="renewal" primary />
          </div>
        )}
      </section>
      <p className="-mt-3 text-sm text-slate-500">
        결제는 운영팀과 따로 진행해요. 문의를 보내면 운영팀이 연락드리고, 결제가 확인되면 요금제와 기간이 바로 바뀌어요.
        {!isAdmin && " 연장과 변경 문의는 사이트 관리자가 할 수 있어요."}
      </p>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">월 한도</th>
              {shown.map((p) => (
                <th key={p.code} className={`px-4 py-3 font-bold ${p.code === site.plan ? "bg-indigo-50 text-indigo-800" : ""}`}>
                  {p.name}{p.code === site.plan ? " (현재)" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-2.5 text-slate-600">요금</td>
              {shown.map((p) => (
                <td key={p.code} className={`whitespace-nowrap px-4 py-2.5 ${p.code === site.plan ? "bg-indigo-50" : ""}`}>
                  {p.trial_days ? `무료 ${p.trial_days}일` : p.monthly_price === null ? "협의" : `월 ${p.monthly_price.toLocaleString()}원`}
                </td>
              ))}
            </tr>
            {LIMIT_COLUMNS.map((col) => (
              <tr key={col}>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{LIMIT_LABEL[col][0]}</td>
                {shown.map((p) => (
                  <td key={p.code} className={`whitespace-nowrap px-4 py-2.5 ${p.code === site.plan ? "bg-indigo-50" : ""}`}>
                    {p.code === "custom" ? "협의" : limitText(col, p[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="-mt-3 text-xs text-slate-500">
        AI 사용량은 글·페이지·뉴스레터·이벤트 생성에 쓴 토큰과 이미지(1장 = 4,000토큰)를 합산해요. 예: 130만 토큰은 글·페이지 약 65건과 이미지 80장 정도예요.
        AI 사용량과 뉴스레터 발송은 매달 1일에 초기화되고, 구독자·용량·멤버는 누적 기준이에요. 운영팀이 사이트별로 한도를 따로 조정했다면 대시보드의 이용량에 보이는 값이 적용돼요.
      </p>

      {isAdmin && (
        <section className="space-y-2">
          <h2 className="font-bold">결제 내역</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">결제일</th>
                  <th className="px-4 py-2 font-medium">요금제</th>
                  <th className="px-4 py-2 text-right font-medium">금액</th>
                  <th className="px-4 py-2 font-medium">이용 기간</th>
                  <th className="px-4 py-2 font-medium">방법</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{p.paid_on}</td>
                    <td className="px-4 py-2">{p.plan ? planName(p.plan) : "-"}</td>
                    <td className="px-4 py-2 text-right">{Number(p.amount).toLocaleString("ko-KR")}원</td>
                    <td className="px-4 py-2 text-slate-600">{p.period_from || p.period_to ? `${p.period_from ?? "-"} ~ ${p.period_to ?? "-"}` : "-"}</td>
                    <td className="px-4 py-2 text-slate-600">{METHOD[p.method] ?? p.method}</td>
                  </tr>
                ))}
                {!payments?.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">결제 내역이 없어요.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
