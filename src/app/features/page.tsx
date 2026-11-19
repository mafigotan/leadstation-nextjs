import type { Metadata } from "next";
import { AiBadge, CtaBand, MarketingShell, MockScreen, Prompt, SectionTitle } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "핵심 기능 | LEADstation 리드스테이션",
  description: "AI 프로모션 생성(기획, 이벤트 게임, 신청폼, 페이지), 리드 자동 수집, AI 뉴스레터, AI 글쓰기. 온라인 마케팅의 모든 단계를 AI가 만듭니다.",
};

const JUMP = [
  ["#promo", "AI 프로모션 생성"],
  ["#leads", "리드 수집"],
  ["#newsletter", "AI 뉴스레터"],
  ["#writer", "AI 글쓰기"],
  ["#common", "함께 쓰는 기능"],
];

const PROMO_STEPS = [
  ["프로모션 기획", "목표, 대상, 기간, 혜택, 참여 방법을 담은 기획안을 AI가 제안합니다."],
  ["이벤트 게임", "룰렛, 캡슐 뽑기, 슬롯머신, 카드 짝 맞추기 등 간단한 게임을 AI가 만들고 경품과 확률까지 설정합니다."],
  ["신청폼 구성", "목적에 맞는 신청 항목과 개인정보 수집 동의 약관을 AI가 구성합니다."],
  ["페이지 내용", "제목, 소개 문구, 이미지를 AI가 채운 페이지가 내 사이트에 바로 게시됩니다."],
];

const GAMES = ["룰렛", "캡슐 뽑기", "슬롯머신", "카드 짝 맞추기"];

function FeatureList({ items }: { items: [string, string][] }) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([t, d]) => (
        <li key={t} className="rounded-xl border border-slate-200 bg-white p-5">
          <strong className="block text-slate-900">{t}</strong>
          <span className="mt-1 block text-sm leading-relaxed text-slate-600">{d}</span>
        </li>
      ))}
    </ul>
  );
}

function Split({
  id,
  badge,
  title,
  desc,
  prompt,
  mock,
  reverse,
  gray,
  children,
}: {
  id: string;
  badge: string;
  title: React.ReactNode;
  desc: string;
  prompt?: string;
  mock: string;
  reverse?: boolean;
  gray?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-20 py-20 ${gray ? "bg-slate-50" : ""}`}>
      <div className="mx-auto max-w-6xl px-4">
        <div className={`flex flex-wrap items-center gap-10 ${reverse ? "flex-row-reverse" : ""}`}>
          <div className="min-w-0 flex-1 basis-96">
            <AiBadge>{badge}</AiBadge>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-slate-900">{title}</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{desc}</p>
            {prompt && <div className="mt-6"><Prompt>&ldquo;{prompt}&rdquo;</Prompt></div>}
          </div>
          <MockScreen title={mock} rows={6} className="min-w-0 flex-1 basis-96" />
        </div>
        {children}
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <MarketingShell active="/features">
      <section className="bg-gradient-to-b from-indigo-50 to-white px-4 pb-12 pt-16 text-center sm:pt-20">
        <p className="text-sm font-semibold text-indigo-600">핵심 기능</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">요청은 한 문장, 나머지는 AI가 합니다</h1>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">
          프로모션 기획과 이벤트 게임, 신청폼, 페이지 내용 생성부터 사이트 글 작성, 리드에게 보내는 뉴스레터까지. 온라인 마케팅의 모든 단계에서 AI가 직접
          결과물을 만들어 드립니다.
        </p>
        <nav aria-label="기능 바로가기" className="mt-8 flex flex-wrap justify-center gap-2">
          {JUMP.map(([href, label]) => (
            <a key={href} href={href} className="btn-secondary">{label}</a>
          ))}
        </nav>
      </section>

      <Split
        id="promo"
        gray
        badge="AI 프로모션"
        title={<>기획부터 게임, 신청폼, 페이지까지<br />프로모션 전 과정을 AI가 만듭니다</>}
        desc="하고 싶은 프로모션을 적으면 AI가 기획안을 세우고, 이벤트 게임과 신청폼을 구성하고, 페이지 문구와 이미지를 채웁니다. 결과를 확인하고 고칠 곳만 말하면 AI가 다시 다듬어 드려요."
        prompt="봄 시즌 할인 이벤트를 2주 동안 열고, 캡슐 뽑기 게임으로 쿠폰을 나눠 주고 싶어요."
        mock="새 프로모션 · AI 기획안"
      >
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROMO_STEPS.map(([t, d], i) => (
            <li key={t} className="card flex flex-col gap-2 p-6">
              <AiBadge>{`AI ${i + 1}`}</AiBadge>
              <strong className="mt-1 text-lg text-slate-900">{t}</strong>
              <span className="text-sm leading-relaxed text-slate-600">{d}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-bold text-slate-900">AI가 만드는 이벤트 게임</h3>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {GAMES.map((g) => (
              <li key={g} className="flex h-24 items-center justify-center rounded-xl bg-indigo-50 font-semibold text-indigo-800">{g}</li>
            ))}
          </ul>
        </div>
      </Split>

      <Split
        id="leads"
        reverse
        badge="자동 수집"
        title="참여한 고객은 바로 리드가 됩니다"
        desc="따로 정리할 필요 없이, 신청 정보와 게임 결과가 프로모션별로 자동으로 쌓이고 다음 뉴스레터의 받는 사람이 됩니다."
        mock="리드 목록"
      >
        <FeatureList
          items={[
            ["프로모션별 리드 관리", "신청자 정보와 게임 결과를 한 화면에서 확인합니다."],
            ["파일로 내려받기", "리드 목록을 언제든 파일로 내려받습니다."],
            ["방문 분석", "페이지별 방문과 신청 전환을 확인합니다."],
            ["뉴스레터로 바로 연결", "모은 리드를 구독자 그룹으로 옮겨 관계를 이어갑니다."],
          ]}
        />
      </Split>

      <Split
        id="newsletter"
        gray
        badge="AI 뉴스레터"
        title={<>모은 리드에게 보낼 뉴스레터,<br />AI가 쓰고 바로 보냅니다</>}
        desc="전할 소식과 톤만 정하면 AI가 제목, 본문, 이미지를 작성합니다. 받을 그룹을 고르면 잠재 고객에게 바로 발송됩니다."
        prompt="이번 이벤트 참여자에게 감사 인사와 신제품 소개를 보내 주세요."
        mock="새 뉴스레터"
      >
        <FeatureList
          items={[
            ["AI 뉴스레터 작성", "요청 한 줄로 제목, 본문, 이미지를 만듭니다."],
            ["리드를 구독자로", "수집한 리드를 그룹으로 묶고, 기존 고객 목록도 파일로 불러옵니다."],
            ["발송과 결과 확인", "그룹을 골라 보내고 발송 내역을 확인합니다."],
          ]}
        />
      </Split>

      <Split
        id="writer"
        reverse
        badge="AI 글쓰기"
        title="사이트에 올릴 글도 AI가 씁니다"
        desc="주제와 키워드만 알려주면 제품 소개, 업계 소식, 활용 사례 글과 이미지를 AI가 만들고, 내 사이트 블로그에 바로 게시합니다."
        prompt="우리 신제품의 특징 3가지를 고객 입장에서 소개하는 글을 써 주세요."
        mock="새 글"
      >
        <FeatureList
          items={[
            ["AI 글 초안", "웹사이트 글, 제품 소개 포스트를 주제만으로 작성합니다."],
            ["AI 이미지", "글 내용에 맞는 이미지를 만들어 넣습니다."],
            ["바로 게시", "회사명.leadstation.kr/blog 에 바로 올라갑니다."],
          ]}
        />
      </Split>

      <section id="common" className="scroll-mt-20 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle eyebrow="함께 쓰는 기능" title="AI가 만든 결과를 한 곳에서 관리합니다" />
          <FeatureList
            items={[
              ["내 사이트 주소", "프로모션과 글이 회사명.leadstation.kr 아래에 모입니다."],
              ["미디어 라이브러리", "AI가 만든 이미지와 올린 이미지를 모아 다시 씁니다."],
              ["팀 멤버", "동료를 초대해 하나의 사이트를 함께 관리합니다."],
              ["대시보드와 AI 사용량", "최근 활동과 이번 달 AI, 발송 사용량을 한눈에 봅니다."],
            ]}
          />
        </div>
      </section>

      <CtaBand title="첫 프로모션을 AI에게 맡겨 보세요. 30일 무료입니다" secondary={{ href: "/pricing", label: "요금제 보기" }} />
    </MarketingShell>
  );
}
