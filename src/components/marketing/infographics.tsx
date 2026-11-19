// Small illustrated diagrams for the marketing cards: each one draws what its paragraph says.
// Pure markup (no images) so they stay sharp at any size.

function Frame({ children, aspect = "aspect-[4/3]" }: { children: React.ReactNode; aspect?: string }) {
  return (
    <div aria-hidden="true" className={`relative ${aspect} w-full overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 ring-1 ring-indigo-100`}>
      {children}
    </div>
  );
}

function Spark({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor">
      <path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z" />
    </svg>
  );
}

function AiNode({ label = "AI" }: { label?: string }) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-indigo-200">
      <Spark /> {label}
    </div>
  );
}

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 text-indigo-300 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16M6 14l6 6 6-6" />
    </svg>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
      <div className="text-[11px] font-bold text-slate-800">{title}</div>
      {children}
    </div>
  );
}

/** 한 문장 요청 → AI → 기획안, 이벤트 게임, 신청폼, 페이지 문구 */
export function PromoInfographic() {
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-between p-3">
        <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[11px] text-slate-700 shadow-sm ring-1 ring-slate-200">
          &ldquo;신제품 출시 이벤트 열어줘&rdquo;
        </div>
        <Arrow className="-my-1" />
        <AiNode />
        <Arrow className="-my-1" />
        <div className="grid w-full grid-cols-4 gap-1.5">
          <Tile title="기획안">
            <div className="space-y-1">
              <div className="h-1 w-full rounded bg-indigo-200" />
              <div className="h-1 w-4/5 rounded bg-slate-200" />
              <div className="h-1 w-3/5 rounded bg-slate-200" />
            </div>
          </Tile>
          <Tile title="이벤트 게임">
            <div
              className="mx-auto h-7 w-7 rounded-full ring-2 ring-white"
              style={{ background: "conic-gradient(#6366f1 0 16.6%, #f59e0b 0 33.3%, #ec4899 0 50%, #10b981 0 66.6%, #8b5cf6 0 83.3%, #f97316 0)" }}
            />
          </Tile>
          <Tile title="신청폼">
            <div className="space-y-1">
              <div className="h-1.5 rounded border border-slate-300" />
              <div className="h-1.5 rounded border border-slate-300" />
              <div className="h-1.5 rounded bg-indigo-500" />
            </div>
          </Tile>
          <Tile title="페이지">
            <div className="space-y-1">
              <div className="h-2 rounded bg-indigo-100" />
              <div className="h-1 w-3/4 rounded bg-slate-200" />
              <div className="h-1 w-1/2 rounded bg-slate-200" />
            </div>
          </Tile>
        </div>
      </div>
    </Frame>
  );
}

const PEOPLE = ["#6366f1", "#ec4899", "#f59e0b", "#10b981"];
const LEADS: [string, string][] = [
  ["김지훈", "당첨"],
  ["박서연", "꽝"],
  ["이준호", "당첨"],
];

/** 참여자 → 자동으로 리드 목록 → 내려받기 */
export function LeadsInfographic() {
  return (
    <Frame>
      <div className="flex h-full items-center gap-2 p-3">
        <div className="flex w-14 shrink-0 flex-col items-center gap-1">
          <div className="grid grid-cols-2 gap-1">
            {PEOPLE.map((c) => (
              <svg key={c} viewBox="0 0 20 20" className="h-6 w-6">
                <circle cx="10" cy="7" r="4" fill={c} />
                <path d="M3 18c1-4 4-6 7-6s6 2 7 6" fill={c} opacity="0.7" />
              </svg>
            ))}
          </div>
          <div className="text-center text-[10px] font-semibold leading-tight text-slate-600">이벤트<br />참여</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Arrow className="-rotate-90" />
          <span className="rounded bg-emerald-100 px-1 text-[9px] font-bold text-emerald-700">자동</span>
        </div>
        <div className="min-w-0 flex-1 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800">리드 목록</span>
            <span className="text-[10px] text-slate-500">프로모션별</span>
          </div>
          <div className="space-y-1">
            {LEADS.map(([name, result], i) => (
              <div key={name} className="flex items-center gap-1.5 rounded bg-slate-50 px-1.5 py-1">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PEOPLE[i] }} />
                <span className="text-[10px] font-medium text-slate-700">{name}</span>
                <span className="ml-auto rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700">🎮 {result}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-1 rounded bg-indigo-600 py-1 text-[10px] font-bold text-white">
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
            </svg>
            CSV 내려받기
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** 주제 → AI가 글과 이미지 작성 → 내 사이트 블로그에 게시 */
export function WriterInfographic() {
  return (
    <Frame>
      <div className="flex h-full items-center gap-2 p-3">
        <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2">
          <div className="w-full rounded-lg bg-white px-2 py-1.5 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-[9px] text-slate-500">주제</div>
            <div className="text-[11px] font-bold leading-tight text-slate-800">신제품<br />활용법</div>
          </div>
          <AiNode label="AI 작성" />
        </div>
        <Arrow className="-rotate-90 shrink-0" />
        <div className="min-w-0 flex-1 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="ml-1 truncate text-[9px] text-slate-500">회사명.leadstation.kr/blog</span>
          </div>
          <div className="space-y-1.5 p-2">
            <div className="h-2 w-4/5 rounded bg-slate-800" />
            <div className="flex h-10 items-center justify-center rounded bg-gradient-to-br from-amber-200 via-rose-200 to-indigo-200">
              <span className="flex items-center gap-0.5 rounded bg-white/80 px-1 text-[9px] font-semibold text-indigo-700"><Spark className="h-2 w-2" /> AI 이미지</span>
            </div>
            <div className="h-1 rounded bg-slate-200" />
            <div className="h-1 w-11/12 rounded bg-slate-200" />
            <div className="h-1 w-3/4 rounded bg-slate-200" />
          </div>
          <div className="mx-2 mb-2 rounded bg-emerald-50 py-0.5 text-center text-[10px] font-bold text-emerald-700">✓ 블로그에 게시됨</div>
        </div>
      </div>
    </Frame>
  );
}

const BARS = [38, 52, 45, 70, 62, 84, 76];

/** 방문, 신청, 발송, AI 사용량을 한 화면에서 */
export function DashboardInfographic() {
  return (
    <Frame>
      <div className="flex h-full flex-col gap-2 p-3">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            ["방문", "1,284", "text-indigo-600"],
            ["신청", "126", "text-emerald-600"],
            ["발송", "2,450", "text-violet-600"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-200">
              <div className="text-[10px] text-slate-500">{label}</div>
              <div className={`text-sm font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <div className="text-[10px] font-semibold text-slate-600">최근 7일</div>
          <div className="flex min-h-0 flex-1 items-end gap-1.5 pt-1">
            {BARS.map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-violet-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1 font-semibold text-slate-700"><Spark className="h-2.5 w-2.5 text-indigo-600" /> 이번 달 AI 사용량</span>
            <span className="text-slate-500">42%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 w-[42%] rounded-full bg-indigo-600" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Browser({ url, children, className = "" }: { url: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="ml-1 truncate text-[9px] text-slate-500">{url}</span>
      </div>
      {children}
    </div>
  );
}

function Wheel({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="h-full w-full rounded-full ring-2 ring-white shadow"
        style={{ background: "conic-gradient(#6366f1 0 16.6%, #f59e0b 0 33.3%, #ec4899 0 50%, #10b981 0 66.6%, #8b5cf6 0 83.3%, #f97316 0)" }}
      />
      <div className="absolute left-1/2 top-1/2 h-1/4 w-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
      <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[7px] border-x-transparent border-t-slate-800" />
    </div>
  );
}

function FormMock() {
  return (
    <div className="space-y-1">
      {["이름", "연락처", "이메일"].map((f) => (
        <div key={f} className="rounded border border-slate-200 px-1 py-0.5 text-[8px] text-slate-400">{f}</div>
      ))}
      <div className="flex items-center gap-1 text-[8px] text-slate-500"><span className="h-1.5 w-1.5 rounded-sm bg-indigo-500" /> 개인정보 수집 동의</div>
      <div className="rounded bg-indigo-600 py-0.5 text-center text-[9px] font-bold text-white">신청하기</div>
    </div>
  );
}

/** Hero: the promotion page AI made, live on the user's own address. */
export function PromoPageInfographic() {
  return (
    <Frame aspect="aspect-[16/8]">
      <div className="flex h-full items-center justify-center p-3">
        <Browser url="회사명.leadstation.kr/event/spring" className="relative w-full">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-500 px-3 py-2 text-white">
            <div className="text-[9px] font-semibold opacity-80">봄 시즌 이벤트</div>
            <div className="text-[13px] font-bold leading-tight">신제품 사전 신청하고 경품 받아가세요</div>
          </div>
          <div className="grid grid-cols-[1fr_1fr] gap-3 p-3">
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-amber-50 py-2">
              <Wheel />
              <div className="text-[9px] font-semibold text-amber-700">룰렛 돌리기</div>
            </div>
            <FormMock />
          </div>
          <div className="absolute right-2 top-7 flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 shadow">
            <Spark className="h-2.5 w-2.5" /> AI가 만든 페이지
          </div>
        </Browser>
      </div>
    </Frame>
  );
}

/** 프롬프트 → AI 이미지 → 라이브러리에 모아 프로모션·글·뉴스레터에 사용 */
export function ImageInfographic() {
  const tiles = ["from-amber-200 to-rose-300", "from-sky-200 to-indigo-300", "from-emerald-200 to-teal-300", "from-violet-200 to-fuchsia-300"];
  return (
    <Frame>
      <div className="flex h-full flex-col items-center justify-between p-3">
        <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-1.5 text-[11px] text-slate-700 shadow-sm ring-1 ring-slate-200">
          &ldquo;창가에 놓인 신제품 사진&rdquo;
        </div>
        <Arrow className="-my-1" />
        <AiNode label="AI 이미지" />
        <Arrow className="-my-1" />
        <div className="w-full rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-800">미디어 라이브러리</span>
            <span className="text-[9px] text-slate-500">프로모션 · 글 · 뉴스레터</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {tiles.map((t) => (
              <div key={t} className={`aspect-square rounded bg-gradient-to-br ${t}`} />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** 리드 그룹 → AI가 쓴 뉴스레터 → 발송 */
export function NewsletterInfographic() {
  return (
    <Frame>
      <div className="flex h-full items-center gap-2 p-3">
        <div className="flex w-16 shrink-0 flex-col items-center gap-2">
          <div className="w-full rounded-lg bg-white px-1.5 py-1.5 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-[9px] text-slate-500">받는 그룹</div>
            <div className="text-[11px] font-bold text-slate-800">리드</div>
            <div className="text-[10px] font-semibold text-indigo-600">128명</div>
          </div>
          <AiNode label="AI 작성" />
        </div>
        <Arrow className="-rotate-90 shrink-0" />
        <div className="min-w-0 flex-1 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 pb-1 text-[9px] text-slate-500">
            제목 <span className="font-semibold text-slate-800">이번 달 새 소식을 전해드려요</span>
          </div>
          <div className="mt-1.5 h-7 rounded bg-gradient-to-br from-sky-200 to-indigo-300" />
          <div className="mt-1.5 grid grid-cols-3 gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-0.5 rounded bg-slate-50 p-1">
                <div className="h-3 rounded bg-indigo-100" />
                <div className="h-0.5 rounded bg-slate-300" />
              </div>
            ))}
          </div>
          <div className="mx-auto mt-1.5 w-2/3 rounded bg-indigo-600 py-0.5 text-center text-[9px] font-bold text-white">자세히 보기</div>
          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700">
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor"><path d="M1 7.5 15 1l-4 14-3-5.5L1 7.5Zm7 2 1.6 3 2.4-8.6L8 9.5Z" /></svg>
            128명에게 발송 완료
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** 내 사이트 홈: 프로모션과 블로그 글이 한 주소에 모임 */
export function SiteHomeInfographic() {
  return (
    <Frame aspect="aspect-[16/8]">
      <div className="flex h-full items-center p-3">
        <Browser url="회사명.leadstation.kr" className="w-full">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <span className="text-[11px] font-bold text-slate-800">회사명</span>
            <span className="flex gap-2 text-[9px] font-semibold text-slate-500"><span className="text-indigo-600">프로모션</span><span>블로그</span></span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <div>
              <div className="mb-1 text-[9px] font-bold text-slate-600">진행 중인 프로모션</div>
              {["봄 시즌 사전 신청", "신규 고객 할인"].map((t, i) => (
                <div key={t} className="mb-1 flex items-center gap-1.5 rounded bg-slate-50 p-1">
                  <div className={`h-5 w-7 shrink-0 rounded bg-gradient-to-br ${i ? "from-emerald-200 to-teal-300" : "from-indigo-200 to-violet-300"}`} />
                  <span className="truncate text-[9px] text-slate-700">{t}</span>
                  <span className="ml-auto rounded bg-emerald-100 px-1 text-[8px] font-bold text-emerald-700">진행 중</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[9px] font-bold text-slate-600">블로그</div>
              {["신제품 활용법 5가지", "업계 소식 정리"].map((t, i) => (
                <div key={t} className="mb-1 flex items-center gap-1.5 rounded bg-slate-50 p-1">
                  <div className={`h-5 w-7 shrink-0 rounded bg-gradient-to-br ${i ? "from-sky-200 to-indigo-300" : "from-amber-200 to-rose-300"}`} />
                  <span className="truncate text-[9px] text-slate-700">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </Browser>
      </div>
    </Frame>
  );
}

/** 이벤트 페이지 한 장 */
export function EventPageInfographic() {
  return (
    <Frame>
      <div className="flex h-full items-center p-2">
        <Browser url="/event/spring" className="w-full">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-500 px-2 py-1 text-[10px] font-bold text-white">봄 시즌 이벤트</div>
          <div className="flex items-center gap-2 p-2">
            <Wheel className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1"><FormMock /></div>
          </div>
        </Browser>
      </div>
    </Frame>
  );
}

/** 블로그 글 한 장 */
export function BlogPostInfographic() {
  return (
    <Frame>
      <div className="flex h-full items-center p-2">
        <Browser url="/blog/new-product" className="w-full">
          <div className="space-y-1 p-2">
            <div className="h-2 w-4/5 rounded bg-slate-800" />
            <div className="h-9 rounded bg-gradient-to-br from-amber-200 via-rose-200 to-indigo-200" />
            <div className="h-1 rounded bg-slate-200" />
            <div className="h-1 w-11/12 rounded bg-slate-200" />
            <div className="h-1 w-2/3 rounded bg-slate-200" />
          </div>
        </Browser>
      </div>
    </Frame>
  );
}
