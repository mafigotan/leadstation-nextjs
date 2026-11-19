import Link from "next/link";
import type { Metadata } from "next";
import { COMPANY, MarketingShell, MockScreen } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "이용 매뉴얼 | LEADstation 리드스테이션",
  description: "가입부터 AI로 프로모션 만들기, AI로 뉴스레터 보내기, AI로 사이트 글 쓰기까지 리드스테이션 사용 방법을 순서대로 안내합니다.",
};

type Section = { id: string; title: string; lead: string; subs: string[]; steps: string[]; shots: string[] };

const SECTIONS: Section[] = [
  {
    id: "start",
    title: "1. 시작하기",
    lead: "가입하고 사이트 주소를 만들면 FREE 플랜 30일이 시작됩니다.",
    subs: ["회원가입과 로그인", "사이트 주소 만들기"],
    steps: [
      "leadstation.kr 에서 30일 무료로 시작하기를 누르고 이메일로 가입합니다.",
      "회사 이름과 사이트 주소(회사명.leadstation.kr)를 정합니다.",
      "대시보드에서 이번 달 AI 사용량을 확인하고, 첫 프로모션을 AI에게 요청해 봅니다.",
    ],
    shots: ["사이트 주소 만들기"],
  },
  {
    id: "promotion",
    title: "2. AI로 프로모션 만들기",
    lead: "기획, 이벤트 게임, 신청폼, 페이지 내용까지 AI가 만들고, 참여한 고객은 자동으로 리드가 됩니다.",
    subs: ["AI에게 프로모션 요청하기", "AI 이벤트 게임과 신청폼", "게시하고 리드 확인하기"],
    steps: [
      "프로모션 메뉴에서 새로 만들기를 누르고, 하고 싶은 프로모션을 한 문장으로 적습니다. 예: “신제품 출시 기념 3주간 룰렛 이벤트로 사전 신청자 모으기”",
      "AI가 제안한 기획안(목표, 대상, 기간, 혜택)을 확인하고 필요한 곳만 고쳐 달라고 요청합니다.",
      "AI가 만든 이벤트 게임(룰렛, 캡슐 뽑기, 슬롯머신 등)의 경품과 당첨 확률을 확인합니다.",
      "AI가 구성한 신청 항목과 개인정보 수집 동의를 확인합니다.",
      "AI가 채운 페이지 문구와 이미지를 확인하고 게시합니다.",
      "리드 메뉴에서 신청자와 게임 결과를 확인하고 파일로 내려받습니다.",
    ],
    shots: ["AI 요청 입력", "AI 기획안과 게임", "리드 목록"],
  },
  {
    id: "newsletter",
    title: "3. AI로 뉴스레터 보내기",
    lead: "모은 리드에게 AI가 쓴 뉴스레터를 보냅니다.",
    subs: ["리드를 구독자로", "AI 작성과 발송"],
    steps: [
      "구독자 메뉴에서 프로모션 리드를 불러와 그룹을 만듭니다. 기존 고객 목록은 파일로 한 번에 등록할 수 있습니다.",
      "뉴스레터 메뉴에서 전할 소식과 톤을 적으면 AI가 제목, 본문, 이미지를 작성합니다. 예: “이벤트 참여자에게 감사 인사와 신제품 소개”",
      "고칠 곳은 AI에게 다시 요청해 다듬고, 받을 그룹을 골라 발송합니다.",
    ],
    shots: ["AI가 작성한 뉴스레터와 발송"],
  },
  {
    id: "writer",
    title: "4. AI로 사이트 글 쓰기",
    lead: "AI가 쓴 글을 내 사이트 블로그에 게시합니다.",
    subs: [],
    steps: [
      "글쓰기 메뉴에서 주제와 키워드를 적습니다. 예: “신제품 특징 3가지를 고객 입장에서 소개”",
      "AI가 쓴 초안과 이미지를 확인하고, 고칠 곳은 다시 요청합니다.",
      "게시하면 회사명.leadstation.kr/blog 에 올라갑니다.",
    ],
    shots: ["글 작성 화면"],
  },
  {
    id: "manage",
    title: "5. 사이트 관리",
    lead: "이미지, 멤버, 요금제를 관리합니다.",
    subs: ["미디어, 멤버 초대", "요금제와 사용량"],
    steps: [
      "미디어: AI가 만든 이미지와 올린 이미지를 모아 페이지, 뉴스레터, 글에 다시 씁니다.",
      "멤버: 동료를 초대해 함께 관리합니다. 인원은 요금제에 따라 다릅니다.",
      "요금제: 현재 요금제, 남은 기간, 이번 달 사용량을 확인하고 변경을 신청합니다.",
    ],
    shots: ["요금제와 사용량"],
  },
];

export default function GuidePage() {
  return (
    <MarketingShell active="/guide">
      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold text-indigo-600">이용 매뉴얼</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">AI에게 요청하고, 확인하고, 게시하세요</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
            가입부터 AI 프로모션, AI 뉴스레터, AI 글쓰기까지 순서대로 따라 해 보세요. 모든 단계는 AI에게 요청하고, 결과를 확인하고, 게시하거나 보내는 흐름입니다.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-wrap gap-12 px-4 py-12">
        <nav aria-label="매뉴얼 목차" className="w-full shrink-0 md:sticky md:top-24 md:w-64 md:self-start">
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            {SECTIONS.map((s) => (
              <div key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg px-3 py-2 font-semibold text-slate-900 hover:bg-slate-50">{s.title}</a>
                {s.subs.map((sub) => (
                  <a key={sub} href={`#${s.id}`} className="block rounded-lg py-1.5 pl-7 pr-3 text-slate-500 hover:bg-slate-50">{sub}</a>
                ))}
              </div>
            ))}
            <a href="#help" className="block rounded-lg px-3 py-2 font-semibold text-slate-900 hover:bg-slate-50">6. 문의하기</a>
          </div>
        </nav>

        <div className="min-w-0 flex-[999_1_560px] divide-y divide-slate-200">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 py-10 first:pt-0">
              <h2 className="text-2xl font-bold text-slate-900">{s.title}</h2>
              <p className="mt-2 text-slate-600">{s.lead}</p>
              <ol className="mt-5 list-decimal space-y-2 pl-6 leading-relaxed text-slate-700">
                {s.steps.map((st) => (
                  <li key={st}>{st}</li>
                ))}
              </ol>
              <div className={`mt-6 grid gap-4 ${s.shots.length > 1 ? "sm:grid-cols-3" : ""}`}>
                {s.shots.map((shot) => (
                  <MockScreen key={shot} title={shot} rows={s.shots.length > 1 ? 3 : 5} />
                ))}
              </div>
            </section>
          ))}
          <section id="help" className="scroll-mt-24 py-10">
            <h2 className="text-2xl font-bold text-slate-900">6. 문의하기</h2>
            <p className="mt-2 leading-relaxed text-slate-600">
              매뉴얼에서 답을 찾지 못했다면 연락 주세요.
              <br />
              대표전화 {COMPANY.phone} · 이메일{" "}
              <a href={`mailto:${COMPANY.email}`} className="font-medium text-indigo-600 hover:underline">{COMPANY.email}</a>
            </p>
            <Link href="/login" className="btn-primary mt-6">30일 무료로 시작하기</Link>
          </section>
        </div>
      </div>
    </MarketingShell>
  );
}
