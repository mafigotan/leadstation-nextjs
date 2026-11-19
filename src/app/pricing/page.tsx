import type { Metadata } from "next";
import { COMPANY, MarketingShell, SectionTitle } from "@/components/marketing/chrome";
import { PlanCards, PlanTable } from "@/components/marketing/plans";
import { IMAGE_TOKENS } from "@/lib/plans";

// Plan values are read from the database on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "요금제 | LEADstation 리드스테이션",
  description: "모든 요금제에서 모든 AI 기능을 씁니다. FREE 30일, BASIC, STANDARD, PRO, CUSTOM 요금제와 신청 방법을 확인하세요.",
};

const INCLUDED = ["AI 프로모션 기획", "AI 이벤트 게임", "AI 신청폼 구성", "AI 페이지 내용", "리드 자동 수집", "AI 글쓰기와 게시", "AI 뉴스레터 작성과 발송", "AI 이미지"];

const STEPS = [
  ["요금제 신청", "관리 화면의 요금제 메뉴나 전화, 이메일로 신청합니다."],
  ["결제 안내", "담당자가 이용 기간과 금액, 입금 방법을 안내해 드립니다."],
  ["입금 확인", "입금이 확인되면 요금제와 이용 기간을 적용합니다."],
  ["바로 이용", "늘어난 사용량을 바로 쓰고, 만료 전에 연장 안내를 받습니다."],
];

const FAQ = [
  ["FREE 30일이 끝나면 어떻게 되나요?", "만료 전에 안내를 드립니다. 요금제를 신청하면 만든 프로모션과 리드를 그대로 이어서 쓸 수 있습니다."],
  ["이번 달 사용량을 다 쓰면 어떻게 되나요?", "AI 생성이나 뉴스레터 발송처럼 한도가 있는 작업만 다음 달 1일까지 멈춥니다. 대시보드에서 이용 한도 늘리기를 요청하거나 요금제 변경을 문의할 수 있습니다."],
  ["중간에 요금제를 바꿀 수 있나요?", "관리 화면에서 변경을 신청하면 담당자가 금액과 적용일을 안내해 드립니다."],
  ["온라인 카드 결제가 되나요?", "현재는 신청 후 담당자 안내에 따라 결제하는 방식으로 운영합니다."],
];

export default function PricingPage() {
  return (
    <MarketingShell active="/pricing">
      <section className="bg-gradient-to-b from-indigo-50 to-white px-4 pb-12 pt-16 text-center sm:pt-20">
        <p className="text-sm font-semibold text-indigo-600">요금제</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">모든 요금제에서 모든 AI 기능을 씁니다</h1>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
          AI 프로모션 생성부터 리드 수집, AI 글쓰기, AI 뉴스레터 발송까지 기능 제한 없이 쓰고, 요금제에 따라 AI 사용량과 발송량, 멤버 수만 달라집니다. 처음
          30일은 FREE로 무료입니다.
        </p>
        <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
          {INCLUDED.map((f) => (
            <li key={f} className="rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-sm font-medium text-indigo-800">{f}</li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <PlanCards />
        <p className="mt-4 text-sm text-slate-500">AI 사용량과 뉴스레터 발송량은 매월 1일에 새로 채워집니다.</p>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="요금제 한눈에 비교" />
          <div className="mt-8">
            <PlanTable />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            AI 사용량은 프로모션 기획, 이벤트 게임, 신청폼, 페이지 내용, 글, 뉴스레터를 만드는 데 쓰인 토큰과 AI 이미지(1장당 {IMAGE_TOKENS.toLocaleString()}{" "}
            토큰)를 합한 값입니다.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionTitle title="신청과 결제는 이렇게 진행됩니다" desc="온라인 카드 결제 없이, 신청을 받은 뒤 담당자가 안내해 드립니다." />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card p-6">
              <div className="text-sm font-semibold text-indigo-600">STEP {i + 1}</div>
              <div className="mt-1 text-lg font-bold text-slate-900">{t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <SectionTitle title="자주 묻는 질문" />
          <div className="mt-8 space-y-3">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <summary className="cursor-pointer font-semibold text-slate-900">{q}</summary>
                <p className="mt-2 leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-2xl bg-slate-900 px-8 py-12 text-white sm:px-12">
          <div className="min-w-0 flex-1 basis-96">
            <h2 className="text-2xl font-bold leading-snug sm:text-3xl">우리 회사 마케팅에 맞는 AI 사용량, 상담해 드립니다</h2>
            <p className="mt-3 text-slate-300">
              요금제 신청과 CUSTOM 견적 · 대표전화 {COMPANY.phone} · {COMPANY.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`tel:${COMPANY.phone.replaceAll("-", "")}`} className="inline-flex items-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              전화 문의
            </a>
            <a href={`mailto:${COMPANY.email}?subject=${encodeURIComponent("[리드스테이션] 요금제 문의")}`} className="inline-flex items-center rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              이메일 문의
            </a>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
