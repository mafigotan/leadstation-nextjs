import Link from "next/link";
import { daysLeft, endsWithinTwoMonths } from "@/lib/site";
import { planName } from "@/lib/plans";
import { PlanRequestButton } from "./request-button";

/** Shown to every member from two months before the site's period ends: yellow, then red in the last 30 days. */
export function PlanBanner({ site, isAdmin }: { site: { plan?: string | null; active_until?: string | null }; isAdmin: boolean }) {
  if (!endsWithinTwoMonths(site.active_until)) return null;
  const d = daysLeft(site.active_until) ?? 0;
  const red = d <= 30;
  const free = site.plan === "free";
  const left = d <= 0 ? "오늘 끝나요" : `${d}일 남았어요`;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${red ? "border-red-300 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <div>
        <p className="font-semibold">
          {free ? `무료 체험이 ${left}` : `${planName(site.plan ?? null)} 이용 기간이 ${left}`} ({site.active_until} 종료)
        </p>
        <p className="mt-0.5 text-sm">
          {free
            ? "체험이 끝나면 대시보드와 공개 페이지, 블로그를 이용할 수 없어요. 계속 쓰려면 요금제를 선택해 운영팀에 문의해주세요."
            : "기간이 끝나면 대시보드와 공개 페이지, 블로그를 이용할 수 없어요. 계속 이용하려면 운영팀에 연장을 문의해주세요."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/plan" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-white/70">요금제 보기</Link>
        {isAdmin && <PlanRequestButton kind={free ? "plan_change" : "renewal"} primary />}
      </div>
    </div>
  );
}
