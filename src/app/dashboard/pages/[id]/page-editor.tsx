"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { generateEventGame, savePageSections } from "../actions";
import { THEMES, THEME_CLASSES, type PageContent, type Theme } from "@/lib/types";
import { SECTION_LABELS, emptySection, hasEvent, toSections, type Section, type SectionType } from "@/lib/page-sections";
import { SectionView } from "@/components/promo-page";
import { ImageMenu } from "@/components/image-field";
import { LEAD_FIELDS, formFields, type LeadField } from "@/lib/lead-fields";
import { EventField, LeadFormFields } from "@/app/p/[slug]/lead-form";
import { ToolBtn, ToolInput, VisualEditor, type PaletteItem } from "@/components/visual-editor";

const THEME_LABELS: Record<string, string> = { indigo: "인디고", emerald: "에메랄드", rose: "로즈", amber: "앰버", slate: "슬레이트" };
const THEME_SWATCH: Record<string, string> = { indigo: "#4f46e5", emerald: "#059669", rose: "#e11d48", amber: "#d97706", slate: "#1e293b" };

const PALETTE: PaletteItem[] = [
  { type: "hero", label: SECTION_LABELS.hero, icon: "★", hint: "배지, 헤드라인, 버튼, 이미지" },
  { type: "image", label: SECTION_LABELS.image, icon: "🖼", hint: "라이브러리, AI 생성" },
  { type: "benefits", label: SECTION_LABELS.benefits, icon: "①", hint: "번호가 붙은 혜택 카드" },
  { type: "cards", label: SECTION_LABELS.cards, icon: "▦", hint: "이미지가 있는 카드" },
  { type: "text", label: SECTION_LABELS.text, icon: "¶", hint: "제목 + 안내 문단" },
  { type: "quote", label: SECTION_LABELS.quote, icon: "❝" },
  { type: "button", label: SECTION_LABELS.button, icon: "▭", hint: "신청 폼이나 링크로 이동" },
  { type: "event", label: SECTION_LABELS.event, icon: "🎮", hint: "AI가 만드는 룰렛, 카드 맞추기 등" },
  { type: "form", label: SECTION_LABELS.form, icon: "✉", hint: "신청자 정보 수집 (페이지당 1개)" },
  { type: "divider", label: SECTION_LABELS.divider, icon: "—" },
];

function MockForm({ label, theme, fields, event }: { label: string; theme: Theme; fields?: LeadField[]; event: boolean }) {
  const t = THEME_CLASSES[theme] ?? THEME_CLASSES.indigo;
  return (
    <div className="pointer-events-none space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
      <LeadFormFields fields={fields} disabled />
      {event && <EventField value="" />}
      <div className={`rounded-lg py-2.5 text-center text-sm font-semibold text-white ${t.bg}`}>{label || "신청하기"}</div>
      <p className="text-center text-xs text-slate-400">편집 화면에서는 입력할 수 없어요.</p>
    </div>
  );
}

function SectionTools({ s, update, openImage }: { s: Section; update: (p: Partial<Section>) => void; openImage: (key: string) => void }) {
  const newItem = { title: "", description: "", image_url: "" };
  switch (s.type) {
    case "hero":
      return (
        <>
          <ToolInput value={s.url} onChange={(url) => update({ url: url.trim() })} placeholder="버튼 링크 (비우면 신청 폼)" width={180} />
          <ToolBtn label="이미지 변경" onClick={() => openImage("main")}>🖼 이미지</ToolBtn>
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
      return <ToolBtn label="AI로 게임 만들기" onClick={() => openImage("game")}>🎮 {s.game ? "게임 다시 만들기" : "AI로 게임 만들기"}</ToolBtn>;
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
        </>
      );
    }
  }
  return null;
}

function GameMaker({ s, update, close, context }: { s: Section; update: (p: Partial<Section>) => void; close: () => void; context: string }) {
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const make = () =>
    start(async () => {
      setError("");
      const r = await generateEventGame(desc, context);
      if (r.error || !r.game) return setError(r.error ?? "게임을 만들지 못했어요.");
      update({ game: r.game });
      close();
    });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">어떤 게임을 넣을지 적어주세요. AI가 게임을 만들고, 방문자의 게임 결과는 신청 폼의 이벤트 칸에 자동으로 기록돼요.</p>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={4}
        maxLength={1000}
        className="input"
        placeholder="예: 8칸 룰렛. 경품은 10% 할인 쿠폰, 20% 할인 쿠폰, 무료 체험권, 꽝. 한 번만 돌릴 수 있게."
      />
      <div className="flex flex-wrap gap-2 text-xs">
        {["8칸 룰렛, 경품은 할인 쿠폰과 꽝", "카드 짝 맞추기 (8쌍), 걸린 시간 기록", "숨은그림찾기, 숨은 아이콘 5개 찾기", "긁는 복권, 당첨 경품 3종"].map((x) => (
          <button key={x} type="button" onClick={() => setDesc(x)} className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50">{x}</button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={pending || !desc.trim()} onClick={make} className="btn-primary w-full">
        {pending ? "AI가 게임을 만들고 있어요... (1~2분 걸릴 수 있어요)" : s.game ? "게임 다시 만들기" : "AI로 게임 만들기"}
      </button>
      {s.game && !pending && <p className="text-xs text-slate-500">다시 만들면 지금 게임이 바뀌어요. 저장해야 페이지에 반영돼요.</p>}
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
}: {
  id: string;
  title: string;
  content: PageContent;
  userId: string;
  aside: ReactNode;
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
        modalTitle={(key) => (key === "game" ? "AI로 게임 만들기" : "이미지")}
        renderBlock={(s, _i, { onImage, ed }) => (
          <SectionView s={s} theme={t} ed={ed} onImage={onImage} form={<MockForm label={s.label || formLabel} theme={theme} fields={s.fields} event={hasEvent(sections)} />} />
        )}
        renderTools={(s, update, openImage) => <SectionTools s={s} update={update} openImage={openImage} />}
        renderImage={(s, key, update, close) =>
          key === "game" ? <GameMaker s={s} update={update} close={close} context={[title, content.subheadline].filter(Boolean).join("\n")} /> : <SectionImage s={s} k={key} update={update} userId={userId} />
        }
      />
      <p className="mt-3 text-center text-xs text-slate-400">글자를 누르면 바로 고칠 수 있어요. 요소를 누르면 위쪽에 메뉴가, 이미지를 누르면 이미지 창이 열려요. Ctrl+S로 저장해요.</p>
    </div>
  );
}
