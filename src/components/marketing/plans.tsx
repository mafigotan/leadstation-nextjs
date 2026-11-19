import Link from "next/link";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { LIMIT_COLUMNS, LIMIT_LABEL, loadPlans, shortCount, limitText, type Plan } from "@/lib/plans";

// Plan cards and table for the public pages. Values come from the `plans` table so super-admin
// changes show up here; the fallback mirrors 0019_plans.sql for when the table can't be read.

const FALLBACK: Plan[] = [
  { code: "free", name: "FREE", monthly_price: 0, trial_days: 30, ai_token_limit: 350000, newsletter_limit: 300, subscriber_limit: 300, storage_mb_limit: 500, member_limit: 1, sort: 1 },
  { code: "basic", name: "BASIC", monthly_price: 50000, trial_days: null, ai_token_limit: 750000, newsletter_limit: 3000, subscriber_limit: 2000, storage_mb_limit: 2048, member_limit: 2, sort: 2 },
  { code: "standard", name: "STANDARD", monthly_price: 70000, trial_days: null, ai_token_limit: 1300000, newsletter_limit: 8000, subscriber_limit: 5000, storage_mb_limit: 5120, member_limit: 5, sort: 3 },
  { code: "pro", name: "PRO", monthly_price: 100000, trial_days: null, ai_token_limit: 2200000, newsletter_limit: 15000, subscriber_limit: 15000, storage_mb_limit: 20480, member_limit: 10, sort: 4 },
  { code: "custom", name: "CUSTOM", monthly_price: null, trial_days: null, ai_token_limit: null, newsletter_limit: null, subscriber_limit: null, storage_mb_limit: null, member_limit: null, sort: 5 },
];

const RECOMMENDED = "standard";

export async function getPublicPlans(): Promise<Plan[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return FALLBACK;
  try {
    const supabase = createAnonClient(url, key, { auth: { persistSession: false } });
    const plans = await loadPlans(supabase);
    return plans.length ? plans : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

const isCustom = (p: Plan) => p.code === "custom";

export function priceText(p: Plan) {
  if (p.monthly_price === null) return "협의";
  return `${p.monthly_price.toLocaleString()}원`;
}

export function periodText(p: Plan) {
  if (p.trial_days) return `가입 후 ${p.trial_days}일`;
  if (isCustom(p)) return "맞춤 사용량";
  return "월";
}

/** Cell text for the plan table: CUSTOM shows 협의 instead of 무제한. */
function cell(p: Plan, col: (typeof LIMIT_COLUMNS)[number]) {
  const v = p[col];
  if (v === null && isCustom(p)) return "협의";
  return limitText(col, v);
}

export async function PlanSummary() {
  const plans = await getPublicPlans();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {plans.map((p) => (
        <div key={p.code} className={`rounded-xl bg-white p-5 ${p.code === RECOMMENDED ? "border-2 border-indigo-600" : "border border-slate-200"}`}>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            {p.name}
            {p.code === RECOMMENDED && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">추천</span>}
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{priceText(p)}</div>
          <div className="text-sm text-slate-500">
            {periodText(p)}
            {p.ai_token_limit !== null && ` · AI ${shortCount(p.ai_token_limit)} 토큰`}
          </div>
        </div>
      ))}
    </div>
  );
}

export async function PlanCards() {
  const plans = await getPublicPlans();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {plans.map((p) => {
        const rec = p.code === RECOMMENDED;
        return (
          <article key={p.code} className={`flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ${rec ? "border-2 border-indigo-600" : "border border-slate-200"}`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {p.name}
              {rec && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">추천</span>}
            </h2>
            <div>
              <div className="text-3xl font-bold text-slate-900">{priceText(p)}</div>
              <div className="text-sm text-slate-500">{periodText(p)}</div>
            </div>
            {isCustom(p) ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>사용량과 멤버 수를 필요에 맞게 조정</li>
                <li>도입 상담 후 견적</li>
              </ul>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {LIMIT_COLUMNS.map((c) => (
                  <li key={c}>
                    {LIMIT_LABEL[c][0]} {cell(p, c)}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={p.code === "free" ? "/login" : "#contact"}
              className={`${rec ? "btn-primary" : "btn-secondary"} mt-auto py-2.5`}
            >
              {p.code === "free" ? "무료로 시작하기" : isCustom(p) ? "문의하기" : "신청하기"}
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export async function PlanTable() {
  const plans = await getPublicPlans();
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-slate-900">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-semibold">항목</th>
            {plans.map((p) => (
              <th key={p.code} scope="col" className="px-4 py-3 text-center font-semibold">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">월 요금</th>
            {plans.map((p) => (
              <td key={p.code} className="px-4 py-3 text-center">
                {priceText(p)}
                {p.trial_days ? ` (${p.trial_days}일)` : ""}
              </td>
            ))}
          </tr>
          {LIMIT_COLUMNS.map((c) => (
            <tr key={c}>
              <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">
                {LIMIT_LABEL[c][0]}
                {(c === "ai_token_limit" || c === "newsletter_limit") && " (월)"}
              </th>
              {plans.map((p) => (
                <td key={p.code} className="px-4 py-3 text-center">{cell(p, c)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium text-slate-900">AI 프로모션 · AI 글쓰기 · AI 뉴스레터</th>
            {plans.map((p) => (
              <td key={p.code} className="px-4 py-3 text-center">모두 포함</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
