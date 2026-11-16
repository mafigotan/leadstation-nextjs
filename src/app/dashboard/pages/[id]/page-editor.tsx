"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { applyEventTemplate, listEventTemplates, listTemplateRequests, requestEventTemplate, type TemplateRequest, savePageSections, type TemplateOption } from "../actions";
import { gameDocument, type EventGame } from "@/lib/event-game";
import { THEMES, THEME_CLASSES, type PageContent, type Theme } from "@/lib/types";
import { SECTION_LABELS, emptySection, hasEvent, toSections, type Section, type SectionType } from "@/lib/page-sections";
import { SectionView } from "@/components/promo-page";
import { ImageMenu } from "@/components/image-field";
import { LEAD_FIELDS, formFields, type LeadField } from "@/lib/lead-fields";
import { EventField, LeadFormFields } from "@/app/p/[slug]/lead-form";
import { ToolBtn, ToolInput, VisualEditor, type PaletteItem } from "@/components/visual-editor";
import type { TermOption } from "@/lib/terms";
import { TermsPicker, formTermsOf, previewTerms, termsProblem } from "./terms-picker";

const THEME_LABELS: Record<string, string> = { indigo: "인디고", emerald: "에메랄드", rose: "로즈", amber: "앰버", slate: "슬레이트" };
const THEME_SWATCH: Record<string, string> = { indigo: "#4f46e5", emerald: "#059669", rose: "#e11d48", amber: "#d97706", slate: "#1e293b" };

const PALETTE: PaletteItem[] = [
  { type: "hero", label: SECTION_LABELS.hero, icon: "★", hint: "배지, 헤드라인, 버튼" },
  { type: "image", label: SECTION_LABELS.image, icon: "🖼", hint: "라이브러리, AI 생성" },
  { type: "benefits", label: SECTION_LABELS.benefits, icon: "①", hint: "번호가 붙은 혜택 카드" },
  { type: "cards", label: SECTION_LABELS.cards, icon: "▦", hint: "이미지가 있는 카드" },
  { type: "text", label: SECTION_LABELS.text, icon: "¶", hint: "제목 + 안내 문단" },
  { type: "quote", label: SECTION_LABELS.quote, icon: "❝" },
  { type: "button", label: SECTION_LABELS.button, icon: "▭", hint: "신청 폼이나 링크로 이동" },
  { type: "event", label: SECTION_LABELS.event, icon: "🎮", hint: "룰렛, 카드 맞추기 등 게임 템플릿" },
  { type: "form", label: SECTION_LABELS.form, icon: "✉", hint: "신청자 정보 수집 (페이지당 1개)" },
  { type: "divider", label: SECTION_LABELS.divider, icon: "—" },
];

function MockForm({ label, theme, fields, event, terms, agreeAll }: { label: string; theme: Theme; fields?: LeadField[]; event: boolean; terms: ReturnType<typeof previewTerms>; agreeAll: boolean }) {
  const t = THEME_CLASSES[theme] ?? THEME_CLASSES.indigo;
  return (
    <div className="pointer-events-none space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
      <LeadFormFields fields={fields} disabled />
      {event && <EventField value="" />}
      {terms.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
          {agreeAll && <p className="border-b border-slate-100 pb-1.5 font-semibold">☐ 약관 전체 동의</p>}
          {terms.map((x) => (
            <p key={x.key} className="flex justify-between gap-2">
              <span>☐ [{x.required ? "필수" : "선택"}] {x.label}</span>
              <span className="shrink-0 text-xs text-slate-400">v{x.version}{x.pinned ? " 고정" : ""} · 보기</span>
            </p>
          ))}
        </div>
      )}
      <div className={`rounded-lg py-2.5 text-center text-sm font-semibold text-white ${t.bg}`}>{label || "신청하기"}</div>
      <p className="text-center text-xs text-slate-400">편집 화면에서는 입력할 수 없어요.</p>
    </div>
  );
}

function SectionTools({ s, update, openImage, termOptions }: { s: Section; update: (p: Partial<Section>) => void; openImage: (key: string) => void; termOptions: TermOption[] }) {
  const newItem = { title: "", description: "", image_url: "" };
  switch (s.type) {
    case "hero":
      return (
        <>
          <ToolInput value={s.url} onChange={(url) => update({ url: url.trim() })} placeholder="버튼 링크 (비우면 신청 폼)" width={180} />
        </>
      );
    case "image":
      return <ToolBtn label="이미지 변경" onClick={() => openImage("main")}>🖼 이미지 변경</ToolBtn>;
    case "benefits":
    case "cards":
      return (
        <>
          <ToolBtn label="항목 추가" onClick={() => s.items.length < 12 && update({ items: [...s.items, newItem] })}>+ 항목</ToolBtn>
          <ToolBtn label="마지막 항목 삭제" onClick={() => s.items.length > 1 && update({ items: s.items.slice(0, -1) })}>− 항목</ToolBtn>
        </>
      );
    case "button":
      return <ToolInput value={s.url} onChange={(url) => update({ url: url.trim() })} placeholder="링크 (비우면 신청 폼)" width={200} />;
    case "event":
      return <ToolBtn label="이벤트 템플릿 고르기" onClick={() => openImage("game")}>🎮 {s.game ? "템플릿 바꾸기" : "템플릿 고르기"}</ToolBtn>;
    case "form": {
      const current = formFields(s.fields).fields;
      const toggle = (k: LeadField) => {
        const next = current.includes(k) ? current.filter((f) => f !== k) : [...current, k];
        if (next.length) update({ fields: LEAD_FIELDS.map((f) => f.key).filter((f) => next.includes(f)) });
      };
      return (
        <>
          <span className="ml-1 text-xs text-slate-400">필드</span>
          {LEAD_FIELDS.map((f) => (
            <ToolBtn key={f.key} label={`${f.label} 필드 ${current.includes(f.key) ? "빼기" : "넣기"}`} active={current.includes(f.key)} onClick={() => toggle(f.key)}>
              {f.label}
            </ToolBtn>
          ))}
          <span className="ml-1 text-xs text-slate-400">|</span>
          <ToolBtn label="신청 폼 약관 설정" danger={!!termsProblem(s, termOptions)} onClick={() => openImage("terms")}>
            📄 약관 {formTermsOf(s, termOptions).length}{termsProblem(s, termOptions) ? " ⚠" : ""}
          </ToolBtn>
        </>
      );
    }
  }
  return null;
}

const GAME_TYPES = ["룰렛", "카드 맞추기", "숨은그림찾기", "긁는 복권", "퀴즈", "슬롯머신", "사다리 타기", "선물 상자 고르기", "기타"];
const REQUEST_STATUS: Record<string, [string, string]> = {
  pending: ["검토 중", "bg-amber-50 text-amber-700"],
  done: ["완료", "bg-emerald-50 text-emerald-700"],
  rejected: ["반려", "bg-slate-100 text-slate-600"],
};

/** Asks the super admins for a template that is not in the list. */
function TemplateRequestForm({ onBack }: { onBack: () => void }) {
  const [gameType, setGameType] = useState("");
  const [description, setDescription] = useState("");
  const [usage, setUsage] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mine, setMine] = useState<TemplateRequest[]>([]);
  const [pending, start] = useTransition();
  useEffect(() => {
    listTemplateRequests().then(setMine);
  }, []);
  const send = () =>
    start(async () => {
      const r = await requestEventTemplate({ gameType, description, usage });
      if (r.error) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: "요청을 보냈어요. 템플릿이 준비되면 대시보드 알림으로 알려드릴게요." });
      setGameType("");
      setDescription("");
      setUsage("");
      listTemplateRequests().then(setMine);
    });
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:underline">← 템플릿 목록으로</button>
      <p className="text-sm text-slate-600">원하는 이벤트 게임을 알려주시면 운영팀이 템플릿으로 만들어 공개해 드려요.</p>
      <div>
        <span className="label">게임 종류</span>
        <div className="flex flex-wrap gap-1.5">
          {GAME_TYPES.map((g) => (
            <button key={g} type="button" onClick={() => setGameType(gameType === g ? "" : g)} className={`rounded-full border px-3 py-1 text-xs ${gameType === g ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tr-desc">원하는 게임 설명 *</label>
        <textarea
          id="tr-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          className="input"
          placeholder={"어떻게 진행되는 게임인지 자유롭게 적어주세요.\n예: 선물 상자 9개 중 하나를 고르면 열리면서 경품이 나와요. 상자가 흔들리는 효과가 있으면 좋겠어요. 경품은 3~5종, 꽝도 있어요."}
        />
      </div>
      <div>
        <label className="label" htmlFor="tr-usage">어떤 프로모션에 쓰실 건가요? (선택)</label>
        <input id="tr-usage" value={usage} onChange={(e) => setUsage(e.target.value)} maxLength={1000} className="input" placeholder="예: 12월 연말 감사 이벤트, 신규 가입자 대상" />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <button type="button" disabled={pending || !description.trim()} onClick={send} className="btn-primary w-full">{pending ? "보내는 중..." : "템플릿 요청하기"}</button>
      {mine.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">우리 사이트의 최근 요청</p>
          <ul className="space-y-2 text-sm">
            {mine.map((r) => {
              const [label, cls] = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.pending;
              return (
                <li key={r.id} className="flex items-start gap-2">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-slate-700">{r.game_type ? `[${r.game_type}] ` : ""}{r.description}</span>
                    {r.admin_note && <span className="block text-xs text-slate-500">답변: {r.admin_note}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function GameMaker({ s, update, close, context }: { s: Section; update: (p: Partial<Section>) => void; close: () => void; context: string }) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [picked, setPicked] = useState<string>(s.game?.template_id ?? "");
  const [requesting, setRequesting] = useState(false);
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    listEventTemplates().then((list) => {
      setTemplates(list);
      setPicked((p) => p || list[0]?.id || "");
    });
  }, []);
  const current = templates?.find((t) => t.id === picked);

  const run = (fn: () => Promise<{ game?: EventGame; error?: string }>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error || !r.game) return setError(r.error ?? "게임을 만들지 못했어요.");
      update({ game: r.game });
      close();
    });

  if (requesting) return <TemplateRequestForm onBack={() => setRequesting(false)} />;
  const requestLink = (
    <button type="button" onClick={() => setRequesting(true)} className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50">
      원하는 템플릿이 없나요? <span className="font-medium text-indigo-600">새 템플릿 요청하기</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {templates === null ? (
          <p className="py-8 text-center text-sm text-slate-400">템플릿을 불러오는 중...</p>
        ) : !templates.length ? (
          <>
            <p className="py-6 text-center text-sm text-slate-500">아직 공개된 이벤트 템플릿이 없어요.</p>
            {requestLink}
          </>
        ) : (
          <>
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => setPicked(t.id)} className={`rounded-lg border p-3 text-left text-sm ${picked === t.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <span className="block font-medium">🎮 {t.name}</span>
                  {t.description && <span className="mt-0.5 block text-xs text-slate-500">{t.description}</span>}
                </button>
              ))}
            </div>
            {current && (
              <iframe key={current.id} title="미리보기" srcDoc={gameDocument(current.game)} sandbox="allow-scripts" className="w-full rounded-lg border border-slate-200" style={{ height: 360 }} />
            )}
            <div>
              <label className="label" htmlFor="tpl-req">이 프로모션에 맞게 바꿀 내용 (선택)</label>
              <textarea id="tpl-req" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} className="input" placeholder="예: 경품은 1등 무료 이용권(5%), 2등 30% 할인(25%), 3등 10% 할인(70%). 색상은 초록 계열로." />
              <p className="mt-1 text-xs text-slate-500">비워 두면 템플릿 기본 설정 그대로 넣어요. 적으면 AI가 경품, 확률, 문구, 색상을 맞춰요.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="button" disabled={pending || !current} onClick={() => run(() => applyEventTemplate(picked, desc, context))} className="btn-primary w-full">
              {pending ? "AI가 설정을 맞추고 있어요..." : desc.trim() ? "AI로 맞춰서 넣기" : "이 템플릿 넣기"}
            </button>
            {requestLink}
          </>
        )}
      {s.game && !pending && <p className="text-xs text-slate-500">새로 넣으면 지금 게임이 바뀌어요. 저장해야 페이지에 반영돼요.</p>}
    </div>
  );
}

function SectionImage({ s, k, update, userId }: { s: Section; k: string; update: (p: Partial<Section>) => void; userId: string }) {
  if (k === "main") {
    return (
      <ImageMenu
        userId={userId}
        value={s.image_url}
        context={s.heading || s.text}
        ratio={s.type === "hero" ? "2:1" : "16:9"}
        onChange={(url) => update({ image_url: url })}
        alt={s.type === "image" ? s.text : undefined}
        onAlt={s.type === "image" ? (text) => update({ text }) : undefined}
      />
    );
  }
  const i = Number(k);
  const it = s.items[i];
  if (!it) return null;
  const moveItem = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= s.items.length) return;
    const items = [...s.items];
    [items[i], items[j]] = [items[j], items[i]];
    update({ items });
  };
  return (
    <>
      <p className="mb-3 text-xs text-slate-500">{it.title || `항목 ${i + 1}`}의 이미지</p>
      <ImageMenu
        userId={userId}
        value={it.image_url}
        context={it.title}
        ratio="4:3"
        onMove={moveItem}
        moveLabels={["앞 카드로", "뒤 카드로"]}
        onChange={(url) => update({ items: s.items.map((x, j) => (j === i ? { ...x, image_url: url } : x)) })}
      />
    </>
  );
}

export function PageEditor({
  id,
  title: initialTitle,
  content,
  userId,
  aside,
  termOptions,
}: {
  id: string;
  title: string;
  content: PageContent;
  userId: string;
  aside: ReactNode;
  termOptions: TermOption[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [theme, setTheme] = useState<Theme>(content.theme ?? "indigo");
  const [sections, setSections] = useState<Section[]>(() => toSections(content));
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const select = useCallback((sid: string | null) => setSelected(sid), []);

  const snapshot = JSON.stringify([title, theme, sections]);
  const [saved, setSaved] = useState(snapshot);
  const dirty = snapshot !== saved;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startTransition(async () => {
      const snap = snapshot;
      const r = await savePageSections(id, { title, theme, sections });
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setSaved(snap);
        setMsg({ ok: true, text: "저장했어요." });
      }
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const t = THEME_CLASSES[theme] ?? THEME_CLASSES.indigo;
  const formLabel = sections.find((s) => s.type === "form")?.label || "신청하기";

  const settings = (
    <>
      <section className="card space-y-3 p-4">
        <div>
          <label className="label">관리용 제목</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <span className="label">강조 색상</span>
          <div className="flex gap-2">
            {THEMES.map((th) => (
              <button
                key={th}
                type="button"
                title={THEME_LABELS[th]}
                onClick={() => setTheme(th)}
                className={`h-8 w-8 rounded-full ring-offset-2 ${theme === th ? "ring-2 ring-slate-900" : ""}`}
                style={{ background: THEME_SWATCH[th] }}
              />
            ))}
          </div>
        </div>
      </section>
      {aside}
    </>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        {dirty && <span className="text-xs text-amber-600">저장 안 된 변경 있음</span>}
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        <button className="btn-primary" disabled={pending} onClick={save}>{pending ? "저장 중…" : "저장"}</button>
      </div>
      <VisualEditor
        blocks={sections}
        onChange={setSections}
        palette={PALETTE}
        labels={(s) => SECTION_LABELS[s.type]}
        create={(type) => emptySection(type as SectionType)}
        selected={selected}
        onSelect={select}
        settings={settings}
        settingsLabel="공개·설정"
        canvasClassName="card bg-white pb-6"
        canDuplicate={(s) => s.type !== "form"}
        canAdd={(type) => (type === "form" && sections.some((s) => s.type === "form") ? "신청 폼은 프로모션에 하나만 넣을 수 있어요." : null)}
        modalTitle={(key) => (key === "game" ? "이벤트 템플릿 고르기" : key === "terms" ? "신청 폼 약관" : "이미지")}
        renderBlock={(s, _i, { onImage, ed }) => (
          <SectionView s={s} theme={t} ed={ed} onImage={onImage} form={<MockForm label={s.label || formLabel} theme={theme} fields={s.fields} event={hasEvent(sections)} terms={previewTerms(s, termOptions)} agreeAll={!!s.terms && !!s.agree_all} />} />
        )}
        renderTools={(s, update, openImage) => <SectionTools s={s} update={update} openImage={openImage} termOptions={termOptions} />}
        renderImage={(s, key, update, close) =>
          key === "terms" ? <TermsPicker s={s} update={update} options={termOptions} /> : key === "game" ? <GameMaker s={s} update={update} close={close} context={[title, content.subheadline].filter(Boolean).join("\n")} /> : <SectionImage s={s} k={key} update={update} userId={userId} />
        }
      />
      <p className="mt-3 text-center text-xs text-slate-400">글자를 누르면 바로 고칠 수 있어요. 요소를 누르면 위쪽에 메뉴가, 이미지를 누르면 이미지 창이 열려요. Ctrl+S로 저장해요.</p>
    </div>
  );
}
