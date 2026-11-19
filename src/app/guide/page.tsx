import Link from "next/link";
import type { Metadata } from "next";
import { AiBadge, COMPANY, MarketingShell } from "@/components/marketing/chrome";

export const metadata: Metadata = {
  title: "이용 매뉴얼 | LEADstation 리드스테이션",
  description: "가입부터 AI로 프로모션 만들기, 리드 관리, AI 뉴스레터 발송, AI 글쓰기, 요금제 관리까지 리드스테이션 사용 방법을 실제 화면과 함께 안내합니다.",
};

// Screenshots live in public/guide/<name>.jpg (captured from leadstation.kr with a demo account).
type Shot = { src: string; alt: string };
type Step = { title: string; body: string; tip?: string; shots?: Shot[] };
type Chapter = { id: string; title: string; lead: string; ai?: boolean; steps: Step[] };

const shot = (name: string, alt: string): Shot => ({ src: `/guide/${name}.jpg`, alt });

const CHAPTERS: Chapter[] = [
  {
    id: "start",
    title: "시작하기",
    lead: "이메일로 가입하고 내 사이트 주소를 만들면 FREE 플랜 30일이 바로 시작됩니다.",
    steps: [
      {
        title: "회원가입과 로그인",
        body: "leadstation.kr 오른쪽 위의 '30일 무료로 시작하기'를 누르고 이메일과 비밀번호(8자 이상)로 가입합니다. 받은 확인 메일의 링크를 누르면 가입이 끝나고, 다음부터는 같은 화면에서 로그인합니다.",
        tip: "비밀번호가 생각나지 않으면 로그인 화면의 '비밀번호를 잊으셨나요?'를 눌러 재설정 메일을 받으세요.",
        shots: [shot("login", "로그인 화면")],
      },
      {
        title: "내 사이트 만들기",
        body: "처음 로그인하면 사이트 만들기 화면이 열립니다. 회사 이름과 사이트 주소를 정하면 회사명.leadstation.kr 주소가 생기고, 프로모션 페이지와 블로그 글이 이 주소 아래에 게시됩니다.",
        tip: "동료가 이미 만든 사이트가 있다면 '기존 사이트 이용 신청'으로 그 사이트의 멤버가 될 수 있어요.",
      },
      {
        title: "대시보드 둘러보기",
        body: "대시보드에서 남은 무료 체험 기간, 이번 달 AI 사용량과 뉴스레터 발송량, 최근 7일 방문 통계, 최근 프로모션·AI 글·뉴스레터를 한눈에 봅니다. 오른쪽 위의 '프로모션 만들기', '글 쓰기', '뉴스레터' 버튼으로 바로 시작할 수 있고, 위쪽 메뉴에서 각 기능으로 이동합니다.",
        shots: [shot("dashboard", "대시보드 화면")],
      },
    ],
  },
  {
    id: "promotion",
    title: "AI로 프로모션 만들기",
    ai: true,
    lead: "프로모션 문구와 이미지, 이벤트 게임, 신청 폼까지 AI가 만들어 줍니다. 확인하고 고칠 곳만 다듬은 뒤 공개하면 됩니다.",
    steps: [
      {
        title: "새 프로모션 정보 입력",
        body: "프로모션 메뉴에서 새 프로모션을 만듭니다. 프로모션 제목, 상품 및 서비스 설명, 타깃 고객을 적고, AI에게 바라는 내용이 있으면 '지시 사항'에 적습니다. 톤을 고르고 신청 폼을 넣을지, 폼에 이름·이메일·전화번호 같은 어떤 항목을 받을지와 필수 여부를 정한 뒤 'AI로 프로모션 만들기'를 누릅니다.",
        tip: "예: 지시 사항 '신청자 전원에게 2주 무료 체험을 주고, 룰렛 이벤트로 추가 경품을 준다는 내용을 넣어줘'",
        shots: [shot("promo-new", "새 프로모션 정보 입력 화면")],
      },
      {
        title: "AI가 만든 페이지 다듬기",
        body: "보통 10~30초면 헤드라인, 소개 문구, 혜택 목록, 신청 폼이 들어간 페이지가 만들어집니다. 오른쪽 미리보기에서 글자를 눌러 바로 고치고, 왼쪽 '요소' 탭의 상단 소개, 이미지, 혜택 목록, 버튼, 이벤트, 신청 폼 같은 요소를 끌어다 놓아 구성을 바꿉니다. 수정 내용은 자동으로 저장됩니다.",
        shots: [shot("promo-editor", "AI가 만든 프로모션 편집 화면")],
      },
      {
        title: "AI로 이미지 만들기",
        body: "이미지 칸을 누르고 '⚙ 설정'에서 'AI로 생성'을 고릅니다. 원하는 장면을 문장으로 적고 스타일(사진, 일러스트, 3D 등)과 비율을 정한 뒤 '이미지 만들기'를 누르면 AI가 이미지를 그려 넣습니다. 만든 이미지는 이미지 라이브러리에도 저장돼 다른 곳에서 다시 쓸 수 있습니다.",
        tip: "라이브러리에서 고르거나, 내 파일을 업로드하거나, 이미지 주소를 붙여 넣을 수도 있어요.",
        shots: [shot("promo-image", "AI 이미지 생성 화면")],
      },
      {
        title: "이벤트 게임 고르기",
        body: "왼쪽 '요소'에서 '이벤트'를 페이지에 넣으면 이벤트 만들기 창이 열립니다. 룰렛 돌리기, 캡슐 뽑기(가챠), 슬롯머신, 카드 짝 맞추기, 퀴즈 챌린지, 타이밍 맞추기, 즉석 응모, 설문·투표, 심리·성향 테스트, 친구 초대·공유 중에서 고르면 바로 아래에서 직접 플레이해 볼 수 있습니다. 마음에 들면 '이 템플릿으로 내용 정하기'를 누릅니다.",
        shots: [shot("promo-event-pick", "이벤트 템플릿 고르기 화면")],
      },
      {
        title: "AI로 이벤트 내용 채우기",
        body: "'AI로 채우기'를 누르면 프로모션 내용에 맞춰 이벤트 제목, 경품 이름, 당첨 확률, 안내 문구를 AI가 한 번에 채웁니다. 원하는 경품 구성이 있으면 먼저 칸에 적어 주세요. AI가 바꾼 항목은 노란색으로 표시되니 확인하고 필요하면 고친 뒤 '이벤트에 적용하기'를 누릅니다.",
        tip: "예: '1등 2주 무료 체험권 30%, 2등 첫 달 10% 할인 25%, 나머지는 꽝'",
        shots: [shot("promo-event", "AI가 채운 이벤트 설정 화면")],
      },
      {
        title: "공개 설정과 기간",
        body: "'공개·설정' 탭에서 관리용 제목과 페이지의 강조 색상을 정하고, 프로모션 기간(시작일, 종료일)을 저장합니다. 기간에 따라 사이트 메인과 프로모션 목록에 '진행 중' 또는 '종료'로 표시됩니다.",
        tip: "개인정보 수집·이용 동의 문구는 위쪽 '약관 관리' 메뉴에서 미리 만들어 두면 신청 폼에 함께 표시돼요.",
        shots: [shot("promo-published", "공개·설정 탭 화면")],
      },
      {
        title: "페이지 공개",
        body: "'페이지 공개하기'를 누르면 회사명.leadstation.kr 아래 주소로 프로모션이 열립니다. '페이지 열기'로 실제 화면을 확인하고 주소를 SNS, 문자, 광고에 공유하세요. 다시 비공개로 돌리려면 같은 자리의 '비공개로 전환'을 누릅니다.",
        shots: [shot("promo-settings", "공개 중인 프로모션의 설정 화면"), shot("promo-public", "공개된 프로모션 페이지")],
      },
      {
        title: "고객이 참여하는 모습",
        body: "방문자는 페이지에서 게임에 참여해 결과를 확인하고, 이어서 신청 폼을 작성합니다. 신청이 끝나면 게임 결과와 함께 리드로 저장됩니다.",
        shots: [shot("promo-game", "공개 페이지의 룰렛 이벤트"), shot("promo-result", "게임 결과와 신청 완료 화면")],
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
        body: "리드 관리 메뉴에서 모든 프로모션의 신청자를 한 번에 봅니다. 프로모션별, 마케팅 동의 여부로 거르고 이름, 이메일, 주소로 검색할 수 있습니다. 목록에서 신청 시각, 연락처, 이벤트 결과, 약관 동의 내역을 확인하고 '상세'를 누르면 신청 내용 전체를 봅니다.",
        shots: [shot("leads", "리드 관리 화면")],
      },
      {
        title: "파일로 내려받기",
        body: "'CSV 내보내기'를 누르면 지금 보고 있는 목록을 파일로 내려받습니다. 엑셀에서 바로 열 수 있습니다.",
      },
      {
        title: "방문 통계",
        body: "방문 통계 메뉴에서 기간(7일, 28일, 90일 또는 직접 지정)을 골라 방문자, 세션, 페이지뷰, 평균 참여시간, 리드 전환율과 일별 추이, 유입 경로, 기기를 확인합니다. '엑셀 다운로드'로 통계를 파일로 받을 수 있습니다.",
        shots: [shot("analytics", "방문 통계 화면")],
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
        body: "AI 뉴스레터 메뉴의 '발신 정보'에서 보내는 사람 이름, 회신 받을 이메일, 푸터 문구, 로고, 강조 색상, 브랜드 정보를 등록합니다. 브랜드 정보는 AI가 뉴스레터를 쓸 때 참고하므로 회사 소개와 원하는 말투를 적어 두세요.",
        shots: [shot("newsletter-settings", "뉴스레터 발신 정보 화면")],
      },
      {
        title: "수신자와 그룹 준비",
        body: "수신자 메뉴에서 그룹의 '리드 가져오기'를 누르면 마케팅 수신에 동의한 리드가 수신자로 들어옵니다. 기존 고객 목록은 'CSV 가져오기'로 한 번에 등록하고, 한 명씩은 '수신자 추가'로 넣습니다. 그룹을 만들어 두면 대상별로 나눠 보낼 수 있습니다.",
        tip: "CSV는 첫 줄에 이메일, 이름, 연락처, 회사, 그룹, 메모 같은 제목이 있어야 해요. 엑셀에서 'CSV UTF-8'로 저장해 올려 주세요.",
        shots: [shot("recipients", "수신자와 그룹 화면")],
      },
      {
        title: "AI에게 뉴스레터 요청하기",
        body: "새 뉴스레터를 만들고 왼쪽 'AI·설정' 탭에서 이메일 내용을 적습니다. 구성에 바라는 점은 '명령 프롬프트'에 적고, 톤&매너와 디자인 템플릿을 고른 뒤 'AI로 뉴스레터 만들기'를 누릅니다.",
        tip: "예: 이메일 내용 '이벤트 참여자에게 감사 인사를 하고 핵심 기능 3가지를 소개, 마지막에 상담 신청 버튼', 명령 프롬프트 '핵심 기능은 카드로 보여줘'",
        shots: [shot("newsletter-ai", "AI·설정 탭에서 뉴스레터 내용 입력")],
      },
      {
        title: "AI가 쓴 뉴스레터 다듬기",
        body: "20초 안팎이면 이메일 제목, 미리보기 문구, 본문, 카드, 버튼이 채워집니다. 글자를 눌러 바로 고치고, '요소' 탭의 대표 이미지, 카드 목록, 버튼 같은 블록을 끌어다 넣습니다. 바꾸고 싶은 점을 적고 'AI로 뉴스레터 수정하기'를 누르면 AI가 전체를 고쳐 줍니다. 보내기 전에 '테스트 메일'로 내 메일함에서 먼저 확인하세요.",
        shots: [shot("newsletter-editor", "AI가 만든 뉴스레터 편집 화면")],
      },
      {
        title: "발송 또는 예약",
        body: "'발송하기'를 누르고 받는 사람(구독 중인 전체 수신자, 그룹 선택, 직접 입력)을 고른 뒤 '발송 대상 확인'으로 인원을 확인합니다. '지금 보내기' 또는 '예약'을 골라 발송하면 아래 발송 기록에서 결과를 볼 수 있습니다.",
        shots: [shot("newsletter-send", "뉴스레터 발송 화면")],
      },
    ],
  },
  {
    id: "writer",
    title: "AI로 사이트 글 쓰기",
    ai: true,
    lead: "AI가 검색에 잘 맞춘 글을 써서 내 사이트 블로그에 게시합니다.",
    steps: [
      {
        title: "주제와 키워드 입력",
        body: "AI 글쓰기 메뉴에서 '새 글 쓰기'를 누르고 주제, 포커스 키워드, 보조 키워드, 글 유형, 톤, 언어, 분량, 대상 독자를 정합니다. 꼭 넣고 싶은 내용은 '추가 지시사항'에 적습니다.",
        tip: "예: 주제 '작은 카페에 디지털 메뉴판을 도입하면 좋은 점', 포커스 키워드 '디지털 메뉴판'",
        shots: [shot("writer-new", "새 글 쓰기 화면")],
      },
      {
        title: "개요 확인 후 본문 생성",
        body: "'개요 먼저 생성'을 누르면 10초 안팎으로 AI가 글 제목, 문단, 맺음말 개요를 제안합니다. 문구를 고치고 ↑↓로 순서를 바꾸거나 문단을 추가·삭제한 뒤 '이 개요로 본문 생성'을 누르면 1분 안팎으로 본문이 완성되어 초안으로 저장됩니다. 개요 없이 '바로 본문 생성'도 할 수 있습니다.",
        shots: [shot("writer-outline", "AI가 만든 개요 확인 화면")],
      },
      {
        title: "편집하고 이미지 넣기",
        body: "편집 화면 위쪽에서 SEO 점수를 확인하며 문장을 다듬습니다. 왼쪽 '요소'에서 소제목, 이미지, 목록, 표, 핵심 카드 등을 끌어다 넣고, AI가 미리 잡아 둔 이미지 자리는 눌러서 AI로 그리거나 라이브러리에서 고릅니다.",
        shots: [shot("writer-editor", "AI 글 편집 화면")],
      },
      {
        title: "SEO 확인 후 발행",
        body: "'SEO·발행' 탭에서 AI가 만든 SEO 제목, 메타 설명, 주소(slug), 태그를 확인하고 'AI로 채우기'로 다시 만들 수도 있습니다. '초안 미리보기 열기'로 확인한 뒤 '발행하기'를 누르면 회사명.leadstation.kr 블로그에 글이 올라갑니다.",
        shots: [shot("writer-seo", "SEO·발행 탭 화면")],
      },
    ],
  },
  {
    id: "manage",
    title: "사이트 관리와 요금제",
    lead: "이미지, 내 정보와 멤버, 요금제와 사용량을 관리합니다.",
    steps: [
      {
        title: "이미지 라이브러리",
        body: "이미지 메뉴에 올린 이미지와 AI로 만든 이미지가 모입니다. '업로드'나 'AI로 만들기'로 미리 준비해 두고, 프로모션, 뉴스레터, 글에서 '라이브러리' 버튼으로 다시 골라 씁니다.",
        shots: [shot("media", "이미지 라이브러리 화면")],
      },
      {
        title: "내 정보, 비밀번호, 멤버",
        body: "마이 프로필에서 이름, 전화번호, 회사명을 고치고 '비밀번호 변경'에서 현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿉니다. 아래 '사이트 멤버'에서 동료를 초대하면 같은 사이트를 함께 관리할 수 있습니다. 초대할 수 있는 인원은 요금제에 따라 다릅니다.",
        shots: [shot("profile", "마이 프로필 화면")],
      },
      {
        title: "요금제와 사용량",
        body: "요금제 메뉴에서 현재 요금제와 이용 기간, 요금제별 월 한도, 결제 내역을 확인합니다. 이번 달 사용량은 대시보드에서 볼 수 있습니다. 연장이나 변경은 '연장 문의', '요금제 변경 문의'로 신청하면 담당자가 연락드리고, 결제가 확인되면 바로 바뀝니다.",
        shots: [shot("plan", "요금제 화면")],
      },
    ],
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
                        {s.shots?.map((sh) => (
                          <figure key={sh.src} className="mt-4">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots, no image optimizer on Workers */}
                            <img src={sh.src} alt={sh.alt} loading="lazy" className="w-full rounded-xl border border-slate-200 shadow-sm" />
                            <figcaption className="mt-2 text-sm text-slate-500">{sh.alt}</figcaption>
                          </figure>
                        ))}
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
