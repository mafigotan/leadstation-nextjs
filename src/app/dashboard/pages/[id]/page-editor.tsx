"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { savePageSections } from "../actions";
import { THEMES, THEME_CLASSES, type PageContent, type Theme } from "@/lib/types";
import { SECTION_LABELS, emptySection, toSections, type Section, type SectionItem, type SectionType } from "@/lib/page-sections";
import { SectionView } from "@/components/promo-page";
import { ImageMenu } from "@/components/image-field";
import { PanelTitle, VisualEditor, type PaletteItem } from "@/components/visual-editor";

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
  { type: "form", label: SECTION_LABELS.form, icon: "✉", hint: "리드 수집 폼" },
  { type: "divider", label: SECTION_LABELS.divider, icon: "—" },
];

function MockForm({ label, theme }: { label: string; theme: Theme }) {
  const t = THEME_CLASSES[theme] ?? THEME_CLASSES.indigo;
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
      {["이름 *", "이메일 *", "연락처", "문의 내용"].map((l) => (
        <div key={l}>
          <span className="label">{l}</span>
          <div className="h-9 rounded-lg border border-slate-300 bg-slate-50" />
        </div>
      ))}
      <div className={`rounded-lg py-2.5 text-center text-sm font-semibold text-white ${t.bg}`}>{label || "신청하기"}</div>
      <p className="text-center text-xs text-slate-400">편집 화면에서는 입력할 수 없어요.</p>
    </div>
  );
}

function SectionPanel({
  s,
  sub,
  update,
  move,
  userId,
}: {
  s: Section;
  sub: string | null;
  update: (p: Partial<Section>) => void;
  move: (d: -1 | 1) => void;
  userId: string;
}) {
  const field = (key: "badge" | "heading" | "text" | "label" | "url", label: string, opts: { textarea?: boolean; placeholder?: string; focus?: boolean } = {}) => (
    <div>
      <label className="label">{label}</label>
      {opts.textarea ? (
        <textarea autoFocus={opts.focus} className="input" rows={3} value={s[key]} placeholder={opts.placeholder} onChange={(e) => update({ [key]: e.target.value })} />
      ) : (
        <input autoFocus={opts.focus} className="input" value={s[key]} placeholder={opts.placeholder} onChange={(e) => update({ [key]: e.target.value })} />
      )}
    </div>
  );
  const setItem = (i: number, p: Partial<SectionItem>) => update({ items: s.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
  const moveItem = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= s.items.length) return;
    const items = [...s.items];
    [items[i], items[j]] = [items[j], items[i]];
    update({ items });
  };
  const itemIndex = sub && sub !== "main" ? Number(sub) : -1;
  const head = <PanelTitle>{SECTION_LABELS[s.type]} 편집</PanelTitle>;

  switch (s.type) {
    case "hero":
      return (
        <div className="space-y-3">
          {head}
          {sub === "main" && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">대표 이미지</p>
              <ImageMenu userId={userId} value={s.image_url} context={s.heading} ratio="2:1" onChange={(url) => update({ image_url: url })} />
            </div>
          )}
          {field("badge", "상단 배지", { placeholder: "예: 기간 한정 이벤트" })}
          {field("heading", "헤드라인", { focus: sub !== "main" })}
          {field("text", "서브 헤드라인", { textarea: true })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("label", "버튼 문구", { placeholder: "비우면 버튼 없음" })}
            {field("url", "버튼 링크", { placeholder: "비우면 신청 폼으로 이동" })}
          </div>
          {sub !== "main" && <p className="text-xs text-slate-500">대표 이미지는 본문의 이미지 자리를 눌러서 바꿔요.</p>}
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          {head}
          <ImageMenu userId={userId} value={s.image_url} context={s.text} ratio="16:9" onMove={move} onChange={(url) => update({ image_url: url })} />
          {field("text", "이미지 설명 (선택)")}
        </div>
      );
    case "benefits":
    case "cards":
      return (
        <div className="space-y-3">
          {head}
          {field("heading", "제목 (선택)", { focus: itemIndex < 0 })}
          {s.items.map((it, i) => (
            <div key={i} className={`space-y-2 rounded-lg border p-3 ${itemIndex === i ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>항목 {i + 1}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => moveItem(i, -1)}>↑</button>
                  <button type="button" onClick={() => moveItem(i, 1)}>↓</button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => update({ items: s.items.filter((_, j) => j !== i) })}>삭제</button>
                </span>
              </div>
              {s.type === "cards" &&
                (itemIndex === i ? (
                  <ImageMenu
                    userId={userId}
                    value={it.image_url}
                    context={it.title}
                    ratio="4:3"
                    onMove={(d) => moveItem(i, d)}
                    moveLabels={["앞 항목으로", "뒤 항목으로"]}
                    onChange={(url) => setItem(i, { image_url: url })}
                  />
                ) : (
                  <p className="text-xs text-slate-500">본문에서 이 카드의 이미지를 누르면 이미지 메뉴가 열려요.</p>
                ))}
              <input className="input font-semibold" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} placeholder="제목" />
              <textarea className="input" rows={2} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="설명" />
            </div>
          ))}
          {s.items.length < 12 && (
            <button type="button" className="btn-secondary w-full" onClick={() => update({ items: [...s.items, { title: "", description: "", image_url: "" }] })}>
              + 항목 추가
            </button>
          )}
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          {head}
          {field("heading", "제목 (선택)")}
          {field("text", "내용", { textarea: true, focus: true })}
        </div>
      );
    case "quote":
      return (
        <div className="space-y-3">
          {head}
          {field("text", "강조 문구", { textarea: true, focus: true })}
          {field("label", "출처 (선택)", { placeholder: "예: 실제 이용 고객" })}
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          {head}
          <div className="grid gap-3 sm:grid-cols-2">
            {field("label", "버튼 문구", { focus: true })}
            {field("url", "링크", { placeholder: "비우면 신청 폼으로 이동" })}
          </div>
        </div>
      );
    case "form":
      return (
        <div className="space-y-3">
          {head}
          {field("heading", "폼 제목", { focus: true })}
          {field("text", "폼 설명", { textarea: true })}
          {field("label", "신청 버튼 문구")}
          <p className="text-xs text-slate-500">입력 항목(이름, 이메일, 연락처, 문의)은 고정이에요. 폼을 지우면 페이지 맨 아래에 자동으로 붙어요.</p>
        </div>
      );
    case "divider":
      return <p className="text-xs text-slate-500">구분선은 편집할 내용이 없어요. 위쪽 도구로 옮기거나 지울 수 있어요.</p>;
  }
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
  const [sub, setSub] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const select = useCallback((sid: string | null, s?: string | null) => {
    setSelected(sid);
    setSub(s ?? null);
  }, []);

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
        create={(type) => emptySection(type as SectionType)}
        selected={selected}
        sub={sub}
        onSelect={select}
        settings={settings}
        settingsLabel="공개·설정"
        canvasClassName="card overflow-hidden bg-white pb-6"
        renderBlock={(s, _i, onImage) => (
          <SectionView s={s} theme={t} editing onImage={onImage} form={<MockForm label={s.label || formLabel} theme={theme} />} />
        )}
        renderPanel={(s, _i, sb, update, move) => <SectionPanel s={s} sub={sb} update={update} move={move} userId={userId} />}
      />
      <p className="mt-3 text-center text-xs text-slate-400">요소를 누르면 편집 메뉴가 열려요. Esc로 닫고, Ctrl+S로 저장해요.</p>
    </div>
  );
}
