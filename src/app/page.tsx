import Link from "next/link";
import type { Metadata } from "next";
import { AiBadge, CtaBand, MarketingShell, MockScreen, Prompt, SectionTitle } from "@/components/marketing/chrome";
import { PlanSummary } from "@/components/marketing/plans";

// Plan prices are read from the database on each request (no incremental cache on Cloudflare yet).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LEADstation 리드스테이션 | AI로 끝내는 온라인 마케팅",
  description:
    "프로모션 기획, 이벤트 게임, 신청폼, 페이지 제작부터 리드 수집, 뉴스레터 발송, 사이트 글 게시까지. 온라인 마케팅의 모든 과정을 AI로 쉽게 처리하는 리드스테이션.",
};

const PROMO_STEPS = [
  { title: "프로모션 기획", desc: "목표와 대상을 알려주면 AI가 기간, 혜택, 참여 방법을 담은 기획안을 제안합니다." },
  { title: "이벤트 게임", desc: "룰렛, 캡슐 뽑기, 슬롯머신, 카드 짝 맞추기 같은 간단한 게임을 AI가 만들어 페이지에 넣습니다." },
  { title: "신청폼 구성", desc: "프로모션 목적에 맞는 신청 항목과 개인정보 수집 동의를 AI가 알아서 구성합니다." },
  { title: "프로모션 내용과 페이지", desc: "제목, 소개 문구, 이미지까지 AI가 채운 프로모션 페이지가 내 사이트에 바로 열립니다." },
];

const AI_FEATURES = [
  { badge: "AI 프로모션", title: "AI가 기획부터 페이지까지 만들어 줍니다", desc: "기획안, 이벤트 게임, 신청폼, 페이지 문구를 한 번에 생성합니다.", mock: "새 프로모션" },
  { badge: "리드 수집", title: "참여한 고객은 자동으로 리드가 됩니다", desc: "신청자 정보와 게임 결과가 프로모션별로 쌓이고, 언제든 내려받을 수 있습니다.", mock: "리드 목록" },
  { badge: "AI 글쓰기", title: "AI가 사이트에 올릴 글을 씁니다", desc: "주제만 정하면 제품 소개, 업계 소식, 활용 사례 글과 이미지를 AI가 만들고 내 사이트 블로그에 게시합니다.", mock: "새 글" },
  { badge: "AI 뉴스레터", title: "AI가 뉴스레터를 쓰고, 바로 보냅니다", desc: "모은 리드를 구독자 그룹으로 묶고, AI가 쓴 뉴스레터를 잠재 고객에게 발송합니다.", mock: "새 뉴스레터" },
  { badge: "AI 이미지", title: "필요한 이미지도 AI가 그립니다", desc: "프로모션, 글, 뉴스레터에 들어갈 이미지를 만들어 미디어 라이브러리에 모아 둡니다.", mock: "미디어 라이브러리" },
  { badge: "한눈에 관리", title: "모든 결과를 한 화면에서 확인합니다", desc: "방문, 신청, 발송 현황과 이번 달 AI 사용량을 대시보드에서 바로 봅니다.", mock: "대시보드" },
];

const CYCLE = [
  { badge: "AI", title: "프로모션 생성", desc: "기획, 게임, 신청폼, 페이지" },
  { badge: "자동", title: "리드 수집", desc: "참여자 정보가 바로 쌓임" },
  { badge: "AI", title: "뉴스레터 발송", desc: "리드에게 맞춤 소식 전달" },
  { badge: "AI", title: "사이트 글 게시", desc: "검색과 재방문을 부르는 콘텐츠" },
];

export default function Home() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 pb-20 pt-16 sm:pt-24">
          <div className="min-w-0 flex-1 basis-[28rem]">
            <p className="text-sm font-semibold text-indigo-600">AI Powered Marketing Platform</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              온라인 마케팅의 모든 과정,
              <br />
              이제 AI에게 말하면 됩니다
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              프로모션 기획, 이벤트 게임, 신청폼, 페이지 내용까지 AI가 한 번에 만들어 드립니다. 모은 리드에게 보낼 뉴스레터와 사이트에 올릴 글도 AI가
              쓰고, 발송과 게시까지 리드스테이션 한 곳에서 끝납니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary px-6 py-3 text-base">30일 무료로 시작하기</Link>
              <a href="#ai-promo" className="btn-secondary px-6 py-3 text-base">AI 프로모션 생성 보기</a>
            </div>
            <p className="mt-3 text-sm text-slate-500">카드 등록 없이 FREE 플랜으로 30일간 사용할 수 있어요.</p>
          </div>
          <div className="min-w-0 flex-1 basis-[30rem] space-y-3 rounded-2xl border border-indigo-100 bg-white/70 p-5 shadow-sm">
            <Prompt>&ldquo;신제품 출시 기념으로 3주 동안 룰렛 이벤트를 열고, 사전 신청자를 모으고 싶어요.&rdquo;</Prompt>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["프로모션 기획안", "목표, 대상, 기간, 경품"],
                ["룰렛 이벤트 게임", "경품과 당첨 확률 설정"],
                ["신청폼", "이름, 연락처, 개인정보 동의"],
                ["프로모션 페이지", "문구, 이미지, 버튼까지"],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
                    {t}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{d}</p>
                </div>
              ))}
            </div>
            <MockScreen title="회사명.leadstation.kr/event/spring" rows={2} />
          </div>
        </div>
      </section>

      {/* One sentence → whole promotion */}
      <section id="ai-promo" className="scroll-mt-20 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle
            eyebrow="AI 프로모션 생성"
            title="한 문장이면 프로모션이 완성됩니다"
            desc="기획서, 디자인, 게임 개발, 폼 도구가 따로 필요 없습니다. 무엇을 하고 싶은지 말하면 AI가 프로모션의 전 과정을 만들어 드리고, 고칠 곳만 다듬으면 바로 게시할 수 있어요."
          />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROMO_STEPS.map((s, i) => (
              <li key={s.title} className="card flex flex-col gap-3 p-6">
                <AiBadge>{`AI ${i + 1}`}</AiBadge>
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* AI in every step */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionTitle
          eyebrow="AI 기능"
          title="마케팅의 모든 단계에서 AI가 일합니다"
          desc="리드를 모으는 일부터 관계를 이어가는 일까지, 손이 많이 가던 작업을 AI가 대신합니다."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f) => (
            <article key={f.title} className="card flex flex-col gap-3 p-6">
              <MockScreen title={f.mock} rows={2} />
              <div className="mt-2"><AiBadge>{f.badge}</AiBadge></div>
              <h3 className="text-lg font-bold leading-snug text-slate-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </article>
          ))}
        </div>
        <Link href="/features" className="mt-8 inline-block font-semibold text-indigo-600 hover:underline">핵심 기능 자세히 보기</Link>
      </section>

      {/* Marketing cycle */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle
            eyebrow="하나로 이어지는 마케팅"
            title="모으고, 쓰고, 보내고. 다시 모입니다"
            desc="프로모션으로 모은 리드가 뉴스레터와 글을 통해 다시 다음 프로모션으로 이어지는 흐름을 AI와 함께 반복합니다."
          />
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CYCLE.map((c) => (
              <li key={c.title} className="card p-5">
                <AiBadge>{c.badge}</AiBadge>
                <div className="mt-3 text-lg font-bold text-slate-900">{c.title}</div>
                <div className="text-sm text-slate-500">{c.desc}</div>
              </li>
            ))}
            <li className="rounded-xl border border-dashed border-indigo-300 bg-white p-5">
              <div className="mt-8 text-lg font-bold text-slate-900">다음 프로모션으로</div>
              <div className="text-sm text-slate-500">돌아온 고객이 다시 리드로</div>
            </li>
          </ol>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="font-semibold text-slate-500">지금까지는</div>
              <p className="mt-2 leading-relaxed text-slate-700">
                기획서는 문서로, 페이지는 외주로, 게임은 개발로, 신청은 폼 도구로, 고객 명단은 엑셀로, 뉴스레터는 메일 도구로 따로따로 처리했습니다.
              </p>
            </div>
            <div className="rounded-xl border-2 border-indigo-600 bg-white p-6">
              <div className="font-semibold text-indigo-600">리드스테이션에서는</div>
              <p className="mt-2 leading-relaxed text-slate-700">
                AI에게 요청하고, 결과를 확인하고, 게시하거나 보내면 됩니다. 모든 데이터는 내 관리 화면 한 곳에 남습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Own site */}
      <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 py-20">
        <div className="min-w-0 flex-1 basis-96">
          <SectionTitle
            eyebrow="나만의 사이트"
            title="AI가 만든 모든 결과는 내 사이트에 게시됩니다"
            desc="가입할 때 정한 주소 아래에 프로모션 페이지와 블로그 글이 모입니다."
          />
          <div className="mt-6 space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 font-mono text-sm text-slate-800">
            <div>회사명.leadstation.kr</div>
            <div>회사명.leadstation.kr/event/<span className="text-slate-500">프로모션</span></div>
            <div>회사명.leadstation.kr/blog/<span className="text-slate-500">게시글</span></div>
          </div>
        </div>
        <div className="grid min-w-0 flex-1 basis-96 gap-3">
          <MockScreen title="회사명.leadstation.kr" rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <MockScreen title="/event/spring" rows={2} />
            <MockScreen title="/blog/new-product" rows={2} />
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="요금제" title="모든 요금제에서 모든 AI 기능을 씁니다" />
            <Link href="/pricing" className="font-semibold text-indigo-600 hover:underline">요금제 자세히 보기</Link>
          </div>
          <div className="mt-8">
            <PlanSummary />
          </div>
        </div>
      </section>

      {/* How to start */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <SectionTitle eyebrow="시작하는 방법" title="가입하고 첫 프로모션을 AI에게 맡겨 보세요" />
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["회원가입과 사이트 주소", "회사 이름으로 주소를 정하면 FREE 30일이 바로 시작됩니다."],
            ["AI에게 프로모션 요청", "하고 싶은 프로모션을 한 문장으로 적으면 AI가 전부 만들어 줍니다."],
            ["리드에게 뉴스레터 발송", "모인 리드에게 AI가 쓴 뉴스레터를 보내 관계를 이어갑니다."],
          ].map(([t, d], i) => (
            <li key={t} className="card p-6">
              <div className="text-3xl font-bold text-indigo-200">{i + 1}</div>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{t}</h3>
              <p className="mt-1 text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
        <Link href="/guide" className="mt-6 inline-block font-semibold text-indigo-600 hover:underline">이용 매뉴얼 보기</Link>
      </section>

      <CtaBand title="온라인 마케팅, 이제 AI와 함께 쉽게" />
    </MarketingShell>
  );
}
