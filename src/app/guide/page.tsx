import Link from "next/link";
import type { Metadata } from "next";
import { AiBadge, COMPANY, MarketingShell } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "이용 매뉴얼 | LEADstation 리드스테이션",
  description: "가입부터 AI로 프로모션 만들기, 리드 관리, AI 뉴스레터 발송, AI 글쓰기, 요금제 관리까지 리드스테이션 사용 방법을 실제 화면과 함께 안내합니다.",
};

// Screenshots live in public/guide/<name>.png (captured from staging with a demo account).
type Shot = { src: string; alt: string };
type Step = { title: string; body: string; tip?: string; shot?: Shot };
type Chapter = { id: string; title: string; lead: string; ai?: boolean; steps: Step[] };

const shot = (name: string, alt: string): Shot => ({ src: `/guide/${name}.png`, alt });

const CHAPTERS: Chapter[] = [
  {
    id: "start",
    title: "시작하기",
    lead: "이메일로 가입하고 내 사이트 주소를 만들면 FREE 플랜 30일이 바로 시작됩니다.",
    steps: [
      {
        title: "회원가입",
        body: "leadstation.kr 오른쪽 위의 '30일 무료로 시작하기'를 누르고 이메일과 비밀번호(8자 이상)로 가입합니다. 받은 확인 메일의 링크를 누르면 가입이 끝납니다.",
        shot: shot("login", "로그인과 회원가입 화면"),
      },
      {
        title: "내 사이트 만들기",
        body: "처음 로그인하면 사이트 만들기 화면이 열립니다. 회사 이름과 사이트 주소를 정하면 회사명.leadstation.kr 주소가 생기고, 프로모션 페이지와 블로그 글이 이 주소 아래에 게시됩니다.",
        tip: "동료가 이미 만든 사이트가 있다면 '기존 사이트 이용 신청'으로 그 사이트의 멤버가 될 수 있어요.",
        shot: shot("welcome", "사이트 주소 만들기 화면"),
      },
      {
        title: "대시보드 둘러보기",
        body: "대시보드에서 최근 리드, 진행 중인 프로모션, 이번 달 AI 사용량과 뉴스레터 발송량, 남은 이용 기간을 한눈에 볼 수 있습니다. 왼쪽 메뉴에서 각 기능으로 이동합니다.",
        shot: shot("dashboard", "대시보드 화면"),
      },
    ],
  },
  {
    id: "promotion",
    title: "AI로 프로모션 만들기",
    ai: true,
    lead: "프로모션 내용과 신청폼, 이벤트 게임까지 AI가 만들어 줍니다. 확인하고 고칠 곳만 다듬은 뒤 공개하면 됩니다.",
    steps: [
      {
        title: "새 프로모션 정보 입력",
        body: "프로모션 메뉴에서 '+ 새 프로모션'을 누릅니다. 프로모션 제목, 상품 및 서비스 설명, 타깃 고객, 톤을 적고 신청 폼에 넣을 항목(이름, 연락처, 이메일 등)을 고릅니다. 원하는 내용이 있으면 '지시 사항'에 적어 주세요.",
        tip: "예: 제목 '홈트레이닝 PT 앱 핏메이트 사전 신청 이벤트', 타깃 '운동을 시작하고 싶은 30대 직장인', 톤 '활기차고 유쾌한'",
        shot: shot("promo-new", "새 프로모션 정보 입력 화면"),
      },
      {
        title: "AI가 프로모션 페이지 생성",
        body: "'AI로 프로모션 만들기'를 누르면 보통 10~30초 안에 헤드라인, 소개 문구, 혜택 카드, 신청 폼이 들어간 페이지가 만들어집니다. 편집 화면에서 문구를 직접 고치거나, 고칠 칸을 골라 'AI로 다시 쓰기'로 다듬을 수 있습니다.",
        shot: shot("promo-editor", "AI가 만든 프로모션 페이지 편집 화면"),
      },
      {
        title: "이벤트 게임 넣기",
        body: "이벤트 탭에서 룰렛, 카드 맞추기, 긁는 복권, 사다리 타기, 선물 상자 고르기 같은 게임 템플릿을 고릅니다. 'AI로 한 번에 채우기'를 누르면 프로모션 내용에 맞춰 경품과 문구를 AI가 채워 줍니다. 노란 칸을 확인하고 필요하면 고친 뒤 저장하세요.",
        tip: "원하는 게임이 없으면 '새 템플릿 요청하기'로 요청할 수 있어요.",
        shot: shot("promo-event", "이벤트 게임 템플릿 선택과 설정 화면"),
      },
      {
        title: "약관, 기간, 안내 메일 설정",
        body: "공개·설정 탭에서 개인정보 수집 동의 약관을 고르고, 프로모션 기간과 공개 주소를 정합니다. 신청자에게 보낼 안내 메일의 제목과 본문을 정하고 '내 메일로 테스트 발송'으로 미리 받아 볼 수 있습니다.",
        tip: "약관은 왼쪽 '약관 관리' 메뉴에서 미리 만들어 두면 여러 프로모션에서 같이 쓸 수 있어요.",
        shot: shot("promo-settings", "약관, 기간, 안내 메일 설정 화면"),
      },
      {
        title: "페이지 공개",
        body: "'페이지 공개하기'를 누르면 회사명.leadstation.kr 아래 주소로 프로모션이 열립니다. '페이지 열기'로 실제 화면을 확인하고 주소를 SNS나 광고에 공유하세요.",
        shot: shot("promo-public", "공개된 프로모션 페이지"),
      },
    ],
  },
  {
    id: "leads",
    title: "리드 확인과 내려받기",
    lead: "프로모션에 참여한 고객은 자동으로 리드가 됩니다.",
    steps: [
      {
        title: "리드 목록 보기",
        body: "리드 관리 메뉴에서 모든 프로모션의 신청자를 한 번에 봅니다. 프로모션별, 마케팅 동의 여부로 거르고 이름, 이메일, 연락처로 검색할 수 있습니다. '상세'를 누르면 신청 내용과 약관 동의 기록, 게임 결과를 확인합니다.",
        shot: shot("leads", "리드 관리 화면"),
      },
      {
        title: "파일로 내려받기",
        body: "'CSV 내보내기'를 누르면 지금 보고 있는 목록을 파일로 내려받습니다. 엑셀에서 바로 열 수 있습니다.",
      },
      {
        title: "방문 통계",
        body: "방문 통계 메뉴에서 프로모션 페이지별 방문 수와 신청 전환을 확인하고, 통계도 파일로 내려받을 수 있습니다.",
        shot: shot("analytics", "방문 통계 화면"),
      },
    ],
  },
  {
    id: "newsletter",
    title: "AI로 뉴스레터 보내기",
    ai: true,
    lead: "모은 리드에게 AI가 쓴 뉴스레터를 보내 관계를 이어갑니다.",
    steps: [
      {
        title: "발신 정보 등록 (처음 한 번)",
        body: "AI 뉴스레터 메뉴의 '발신 정보'에서 보내는 사람 이름, 로고, 강조 색상, 머리글과 푸터, 브랜드 정보를 등록합니다. 브랜드 정보는 AI가 뉴스레터를 쓸 때 참고합니다.",
        shot: shot("newsletter-settings", "뉴스레터 발신 정보 화면"),
      },
      {
        title: "수신자와 그룹 준비",
        body: "수신자 메뉴에서 '리드 가져오기'로 프로모션 리드를 불러오거나, 'CSV로 가져오기'로 기존 고객 목록을 한 번에 등록합니다. 그룹을 만들어 두면 대상별로 나눠 보낼 수 있습니다.",
        tip: "CSV는 첫 줄에 제목, 둘째 줄부터 데이터가 있어야 해요. 가져올 때 이메일, 이름, 회사 열을 골라 줍니다.",
        shot: shot("recipients", "수신자와 그룹 화면"),
      },
      {
        title: "AI로 뉴스레터 작성",
        body: "'+ 새 뉴스레터'를 누르고 왼쪽 'AI·설정'에서 디자인 템플릿을 고른 뒤 전할 내용을 적고 'AI로 뉴스레터 만들기'를 누릅니다. 30초~1분이면 제목, 본문, 이미지가 채워집니다. 고칠 곳은 'AI로 뉴스레터 수정하기'로 요청하거나 블록을 직접 고칩니다.",
        tip: "예: '이벤트 참여자에게 감사 인사를 하고, 신제품 3개를 카드로 보여준 뒤 마지막에 구매 버튼을 넣어줘'",
        shot: shot("newsletter-editor", "AI 뉴스레터 편집 화면"),
      },
      {
        title: "발송 또는 예약",
        body: "'보내기'에서 받을 그룹을 고르고 발송 대상을 확인한 뒤 '지금 발송하기' 또는 '예약하기'를 누릅니다. 발송 기록에서 성공과 실패 건수를 확인하고 실패한 주소에 다시 보낼 수 있습니다.",
        shot: shot("newsletter-send", "뉴스레터 발송 화면"),
      },
    ],
  },
  {
    id: "writer",
    title: "AI로 사이트 글 쓰기",
    ai: true,
    lead: "AI가 쓴 글을 내 사이트 블로그에 게시합니다.",
    steps: [
      {
        title: "주제와 키워드 입력",
        body: "AI 글쓰기 메뉴에서 '새 글 쓰기'를 누르고 주제, 포커스 키워드, 대상 독자, 글 유형, 톤, 분량을 정합니다.",
        tip: "예: 주제 '초보자를 위한 홈카페 원두 고르는 법', 포커스 키워드 '홈카페 원두'",
        shot: shot("writer-new", "새 글 쓰기 화면"),
      },
      {
        title: "개요 확인 후 본문 생성",
        body: "'개요 먼저 생성'을 누르면 AI가 글의 목차를 제안합니다. 순서를 바꾸거나 항목을 지운 뒤 '이 개요로 본문 생성'을 누르면 1~3분 안에 본문이 완성되어 초안으로 저장됩니다.",
        shot: shot("writer-outline", "AI가 만든 개요 확인 화면"),
      },
      {
        title: "편집하고 게시",
        body: "편집 화면에서 문장을 다듬고 이미지를 넣은 뒤 '발행하기'를 누르면 회사명.leadstation.kr/blog 에 글이 올라갑니다.",
        shot: shot("writer-editor", "AI 글 편집 화면"),
      },
    ],
  },
  {
    id: "manage",
    title: "사이트 관리와 요금제",
    lead: "이미지, 멤버, 요금제와 사용량을 관리합니다.",
    steps: [
      {
        title: "이미지 라이브러리",
        body: "이미지 메뉴에 올린 이미지와 AI로 만든 이미지가 모입니다. 프로모션, 뉴스레터, 글에서 다시 골라 쓸 수 있습니다.",
        shot: shot("media", "이미지 라이브러리 화면"),
      },
      {
        title: "멤버 초대",
        body: "마이 프로필의 '사이트 멤버'에서 동료를 초대하면 같은 사이트를 함께 관리할 수 있습니다. 초대할 수 있는 인원은 요금제에 따라 다릅니다.",
      },
      {
        title: "요금제와 사용량",
        body: "요금제 메뉴에서 현재 요금제, 이용 기간, 이번 달 한도와 사용량, 결제 내역을 확인합니다. 연장이나 변경은 이 화면에서 신청하면 담당자가 안내해 드립니다.",
        shot: shot("plan", "요금제와 사용량 화면"),
      },
    ],
  },
];

/** Screenshots that have been captured so far; others show text only. */
const CAPTURED = new Set<string>([]);

export default function GuidePage() {
  return (
    <MarketingShell active="/guide">
      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold text-indigo-600">이용 매뉴얼</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">AI에게 요청하고, 확인하고, 게시하세요</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
            가입부터 AI 프로모션, 리드 관리, AI 뉴스레터, AI 글쓰기까지 실제 화면과 함께 순서대로 안내합니다.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-wrap gap-12 px-4 py-12">
        <nav aria-label="매뉴얼 목차" className="w-full shrink-0 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:w-64 md:self-start md:overflow-y-auto">
          <ol className="rounded-xl border border-slate-200 p-3 text-sm">
            {CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="block rounded-lg px-3 py-2 font-semibold text-slate-900 hover:bg-slate-50">
                  {i + 1}. {c.title}
                </a>
                <ol>
                  {c.steps.map((s, j) => (
                    <li key={s.title}>
                      <a href={`#${c.id}-${j + 1}`} className="block rounded-lg py-1.5 pl-7 pr-3 text-slate-500 hover:bg-slate-50">{s.title}</a>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
            <li>
              <a href="#help" className="block rounded-lg px-3 py-2 font-semibold text-slate-900 hover:bg-slate-50">{CHAPTERS.length + 1}. 문의하기</a>
            </li>
          </ol>
        </nav>

        <div className="min-w-0 flex-[999_1_560px] divide-y divide-slate-200">
          {CHAPTERS.map((c, i) => (
            <section key={c.id} id={c.id} className="scroll-mt-24 py-12 first:pt-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">{i + 1}. {c.title}</h2>
                {c.ai && <AiBadge />}
              </div>
              <p className="mt-2 text-slate-600">{c.lead}</p>
              <ol className="mt-8 space-y-10">
                {c.steps.map((s, j) => (
                  <li key={s.title} id={`${c.id}-${j + 1}`} className="scroll-mt-24">
                    <div className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{j + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                        <p className="mt-1 leading-relaxed text-slate-700">{s.body}</p>
                        {s.tip && <p className="mt-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-indigo-900">{s.tip}</p>}
                        {s.shot && CAPTURED.has(s.shot.src) && (
                          <figure className="mt-4">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots, no image optimizer on Workers */}
                            <img src={s.shot.src} alt={s.shot.alt} loading="lazy" className="w-full rounded-xl border border-slate-200 shadow-sm" />
                            <figcaption className="mt-2 text-sm text-slate-500">{s.shot.alt}</figcaption>
                          </figure>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <section id="help" className="scroll-mt-24 py-12">
            <h2 className="text-2xl font-bold text-slate-900">{CHAPTERS.length + 1}. 문의하기</h2>
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
