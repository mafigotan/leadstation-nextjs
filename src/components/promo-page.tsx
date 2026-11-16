import { createElement, type ReactNode } from "react";
import { THEME_CLASSES, type PageContent } from "@/lib/types";
import { toSections, type Section } from "@/lib/page-sections";
import { GAME_HEIGHT, gameDocument } from "@/lib/event-game";

type Theme = (typeof THEME_CLASSES)[keyof typeof THEME_CLASSES];

/** Clickable image in the editor (plain image on the public page). */
function Hot({ onImage, k, children, className = "" }: { onImage?: (key: string) => void; k: string; children: ReactNode; className?: string }) {
  if (!onImage) return <>{children}</>;
  return (
    <div
      className={`relative cursor-pointer ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onImage(k);
      }}
    >
      {children}
    </div>
  );
}

function Img({ url, alt, className, editing, label = "이미지 자리" }: { url: string; alt: string; className: string; editing?: boolean; label?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} loading="lazy" />;
  }
  if (!editing) return null;
  return <div className={`${className} flex min-h-40 items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400`}>{label}</div>;
}

type EdFn = (path: string, value: string, opts?: { as?: string; className?: string; placeholder?: string; single?: boolean }) => ReactNode;

export function SectionView({
  s,
  theme,
  form,
  onImage,
  ed,
}: {
  s: Section;
  theme: Theme;
  form: ReactNode;
  onImage?: (key: string) => void;
  /** Inline editing (editor only). */
  ed?: EdFn;
}) {
  const editing = !!ed;
  /** Text at `path`: editable in the editor, plain on the page. */
  const T = (path: string, value: string, as: string, className = "", placeholder = "", single = false) =>
    ed ? ed(path, value, { as, className, placeholder, single }) : value ? createElement(as, { className }, value) : null;

  switch (s.type) {
    case "hero":
      return (
        <section className={`${theme.soft} px-4 py-16 sm:py-24`}>
          <div className="mx-auto max-w-3xl text-center">
            {(s.badge || editing) && (
              <span className={`inline-block rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm ${theme.text}`}>
                {T("badge", s.badge, "span", "inline-block min-w-[3rem]", "배지 (선택)", true)}
              </span>
            )}
            {T("heading", s.heading, "h1", "mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-5xl", "헤드라인을 입력하세요", true)}
            {T("text", s.text, "p", "mx-auto mt-5 max-w-2xl whitespace-pre-line text-lg text-slate-600", "서브 헤드라인")}
          </div>
        </section>
      );
    case "image":
      if (!s.image_url && !editing) return null;
      return (
        <section className="px-4 py-8">
          <figure className="mx-auto max-w-4xl">
            <Hot onImage={onImage} k="main">
              <Img editing={editing} url={s.image_url} alt={s.text} className="w-full rounded-2xl" />
            </Hot>
            {T("text", s.text, "figcaption", "mt-2 text-center text-sm text-slate-500", "이미지 설명 (선택)", true)}
          </figure>
        </section>
      );
    case "benefits":
      return (
        <section className="px-4 py-16">
          {(s.heading || editing) && T("heading", s.heading, "h2", "mb-8 text-center text-2xl font-bold", "제목 (선택)", true)}
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((b, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-6">
                <div className={`mb-3 text-2xl font-bold ${theme.text}`}>{String(i + 1).padStart(2, "0")}</div>
                {T(`items.${i}.title`, b.title, "h3", "font-semibold", "혜택 제목", true)}
                {T(`items.${i}.description`, b.description, "p", "mt-2 text-sm text-slate-600", "설명")}
              </div>
            ))}
          </div>
        </section>
      );
    case "cards":
      return (
        <section className="px-4 py-16">
          {(s.heading || editing) && T("heading", s.heading, "h2", "mb-8 text-center text-2xl font-bold", "제목 (선택)", true)}
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((b, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
                {(b.image_url || editing) && (
                  <Hot onImage={onImage} k={String(i)}>
                    <Img editing={editing} url={b.image_url} alt={b.title} className="aspect-[4/3] w-full object-cover" label="이미지" />
                  </Hot>
                )}
                <div className="p-5">
                  {T(`items.${i}.title`, b.title, "h3", "font-semibold", "제목", true)}
                  {T(`items.${i}.description`, b.description, "p", "mt-2 text-sm text-slate-600", "설명")}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case "text":
      if (!editing && !s.heading && !s.text) return null;
      return (
        <section className="px-4 py-8">
          <div className="mx-auto max-w-3xl">
            {T("heading", s.heading, "h2", "mb-3 text-2xl font-bold", "제목 (선택)", true)}
            {T("text", s.text, "p", "whitespace-pre-line rounded-xl bg-slate-50 p-6 leading-7 text-slate-700", "안내 문단을 입력하세요")}
          </div>
        </section>
      );
    case "quote":
      if (!editing && !s.text) return null;
      return (
        <section className="px-4 py-12">
          <blockquote className={`mx-auto max-w-3xl text-center text-2xl font-bold leading-relaxed ${theme.text}`}>
            {T("text", s.text, "p", "", "강조할 문구")}
            {T("label", s.label, "cite", "mt-3 block text-sm font-normal not-italic text-slate-500", "출처 (선택)", true)}
          </blockquote>
        </section>
      );
    case "button":
      return (
        <section className="px-4 py-8 text-center">
          <a href={s.url || "#signup"} className={`inline-flex rounded-lg px-8 py-3 font-semibold text-white shadow ${theme.bg}`}>
            {ed ? T("label", s.label, "span", "inline-block min-w-[3rem]", "버튼 문구", true) : s.label || "버튼"}
          </a>
        </section>
      );
    case "form":
      return (
        <section id="signup" className="px-4 py-16">
          <div className="mx-auto max-w-md">
            {T("heading", s.heading, "h2", "text-center text-2xl font-bold", "폼 제목", true)}
            {T("text", s.text, "p", "mb-6 mt-2 text-center text-slate-600", "폼 설명 (선택)")}
            {form}
          </div>
        </section>
      );
    case "event":
      if (!editing && !s.game) return null;
      return (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            {T("heading", s.heading, "h2", "text-center text-2xl font-bold", "이벤트 제목", true)}
            {T("text", s.text, "p", "mb-6 mt-2 text-center text-slate-600", "이벤트 안내 (선택)")}
            {s.game ? (
              <iframe
                title={s.heading || "이벤트"}
                srcDoc={gameDocument(s.game)}
                sandbox="allow-scripts"
                className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
                style={{ height: GAME_HEIGHT }}
              />
            ) : (
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"
                style={{ height: 240 }}
                onClick={onImage ? (e) => { e.stopPropagation(); onImage("game"); } : undefined}
              >
                <span className="text-3xl">🎮</span>
                <span>이벤트 템플릿 자리</span>
                <span className="text-xs text-slate-400">룰렛, 숨은그림찾기, 카드 맞추기 등</span>
              </div>
            )}
          </div>
        </section>
      );
    case "divider":
      return <hr className="mx-auto my-8 max-w-3xl border-slate-200" />;
  }
}

export function PromoPage({ content, form }: { content: PageContent; form: (s: Section | null) => ReactNode }) {
  const theme = THEME_CLASSES[content.theme] ?? THEME_CLASSES.indigo;
  const sections = toSections(content);
  const hasForm = sections.some((s) => s.type === "form");
  return (
    <div className="bg-white">
      {sections.map((s) => (
        <SectionView key={s.id} s={s} theme={theme} form={form(s)} />
      ))}
      {!hasForm && content.lead_form !== false && <SectionView s={{ id: "f", type: "form", badge: "", heading: content.form_title, text: content.form_description, image_url: "", label: content.cta_label, url: "", items: [] }} theme={theme} form={form(null)} />}
    </div>
  );
}
