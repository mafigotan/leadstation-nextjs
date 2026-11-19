// Small illustrated diagrams for the marketing cards: each one draws what its paragraph says.
// Pure markup (no images) so they stay sharp at any size.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true" className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 ring-1 ring-indigo-100">
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
