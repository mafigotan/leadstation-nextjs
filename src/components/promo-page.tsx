import type { ReactNode } from "react";
import { THEME_CLASSES, type PageContent } from "@/lib/types";
import { toSections, type Section } from "@/lib/page-sections";

type Theme = (typeof THEME_CLASSES)[keyof typeof THEME_CLASSES];

/** Clickable image in the editor (plain image on the public page). */
function Hot({ onImage, k, children, className = "" }: { onImage?: (key: string) => void; k: string; children: ReactNode; className?: string }) {
  if (!onImage) return <>{children}</>;
  return (
    <div
      className={`group/img relative cursor-pointer ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onImage(k);
      }}
    >
      {children}
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-2xl bg-indigo-900/30 text-sm font-semibold text-white group-hover/img:flex">이미지 편집</span>
    </div>
  );
}

function Img({ url, alt, className, editing, label = "이미지 자리 (눌러서 이미지 넣기)" }: { url: string; alt: string; className: string; editing?: boolean; label?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={className} loading="lazy" />;
  }
  if (!editing) return null;
  return <div className={`${className} flex min-h-40 items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400`}>{label}</div>;
}

export function SectionView({
  s,
  theme,
  form,
  onImage,
  editing,
}: {
  s: Section;
  theme: Theme;
  form: ReactNode;
  onImage?: (key: string) => void;
  editing?: boolean;
}) {
  const empty = (t: string) => (editing ? <p className="mx-auto max-w-3xl rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">{t}: 눌러서 내용을 입력하세요</p> : null);
  switch (s.type) {
    case "hero":
      return (
        <section className={`${theme.soft} px-4 py-16 sm:py-24`}>
          <div className="mx-auto max-w-3xl text-center">
            {s.badge && <span className={`inline-block rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm ${theme.text}`}>{s.badge}</span>}
            <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{s.heading || (editing ? "헤드라인을 입력하세요" : "")}</h1>
            {s.text && <p className="mx-auto mt-5 max-w-2xl whitespace-pre-line text-lg text-slate-600">{s.text}</p>}
            {s.label && (
              <a href={s.url || "#signup"} className={`mt-8 inline-flex rounded-lg px-6 py-3 font-semibold text-white shadow ${theme.bg}`}>
                {s.label}
              </a>
            )}
            {(s.image_url || editing) && (
              <Hot onImage={onImage} k="main" className="mx-auto mt-10 max-w-3xl">
                <Img editing={editing} url={s.image_url} alt={s.heading} className="w-full rounded-2xl shadow-lg" label="대표 이미지 자리 (눌러서 넣기, 비워 두면 표시 안 됨)" />
              </Hot>
            )}
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
            {s.text && <figcaption className="mt-2 text-center text-sm text-slate-500">{s.text}</figcaption>}
          </figure>
        </section>
      );
    case "benefits":
      if (!s.items.length) return empty("혜택 목록");
      return (
        <section className="px-4 py-16">
          {s.heading && <h2 className="mb-8 text-center text-2xl font-bold">{s.heading}</h2>}
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((b, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-6">
                <div className={`mb-3 text-2xl font-bold ${theme.text}`}>{String(i + 1).padStart(2, "0")}</div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case "cards":
      if (!s.items.length) return empty("이미지 카드");
      return (
        <section className="px-4 py-16">
          {s.heading && <h2 className="mb-8 text-center text-2xl font-bold">{s.heading}</h2>}
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.items.map((b, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
                {(b.image_url || editing) && (
                  <Hot onImage={onImage} k={String(i)}>
                    <Img editing={editing} url={b.image_url} alt={b.title} className="aspect-[4/3] w-full object-cover" label="이미지" />
                  </Hot>
                )}
                <div className="p-5">
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    case "text":
      if (!s.heading && !s.text) return empty("문단");
      return (
        <section className="px-4 py-8">
          <div className="mx-auto max-w-3xl">
            {s.heading && <h2 className="mb-3 text-2xl font-bold">{s.heading}</h2>}
            {s.text && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-6 leading-7 text-slate-700">{s.text}</p>}
          </div>
        </section>
      );
    case "quote":
      if (!s.text) return empty("강조 문구");
      return (
        <section className="px-4 py-12">
          <blockquote className={`mx-auto max-w-3xl text-center text-2xl font-bold leading-relaxed ${theme.text}`}>
            “{s.text}”
            {s.label && <cite className="mt-3 block text-sm font-normal not-italic text-slate-500">{s.label}</cite>}
          </blockquote>
        </section>
      );
    case "button":
      return (
        <section className="px-4 py-8 text-center">
          <a href={s.url || "#signup"} className={`inline-flex rounded-lg px-8 py-3 font-semibold text-white shadow ${theme.bg}`}>
            {s.label || "버튼"}
          </a>
        </section>
      );
    case "form":
      return (
        <section id="signup" className="px-4 py-16">
          <div className="mx-auto max-w-md">
            <h2 className="text-center text-2xl font-bold">{s.heading}</h2>
            {s.text && <p className="mb-6 mt-2 text-center text-slate-600">{s.text}</p>}
            {form}
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
      {!hasForm && <SectionView s={{ id: "f", type: "form", badge: "", heading: content.form_title, text: content.form_description, image_url: "", label: content.cta_label, url: "", items: [] }} theme={theme} form={form(null)} />}
    </div>
  );
}
