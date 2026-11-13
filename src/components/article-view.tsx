import { Fragment, createElement, type ReactNode } from "react";
import { BOX_STYLES, plain, type Block, type Faq, type HeaderImage } from "@/lib/writer/types";

/** Renders **bold** and [label](https://url) markup; everything else is text. */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++}>{m[1]}</strong>);
    else out.push(<a key={k++} href={m[3]} rel="nofollow noopener" target="_blank" className="text-indigo-600 underline">{m[2]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((n, i) => (typeof n === "string" ? <Fragment key={`t${i}`}>{n}</Fragment> : n))}</>;
}

const BOX_COLORS: Record<string, string> = {
  summary: "border-indigo-200 bg-indigo-50",
  tip: "border-emerald-200 bg-emerald-50",
  info: "border-sky-200 bg-sky-50",
  warning: "border-amber-300 bg-amber-50",
};

export function Pic({ url, alt, prompt, className, natural }: { url: string; alt: string; prompt?: string; className: string; natural?: boolean }) {
  if (url) {
    // natural: keep the image's own ratio (1:1, 3:1 ...) instead of the placeholder box.
    const cls = natural ? className.replace(/aspect-\[[^\]]+\]/, "h-auto") : `${className} object-cover`;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={cls} loading="lazy" />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-slate-100 p-3 text-center text-xs text-slate-400`} title={prompt}>
      {alt || "이미지"}
    </div>
  );
}

/** Clickable image area in the editor (no-op on the public page). */
function Hot({ onImage, k, children }: { onImage?: (key: string) => void; k: string; children: ReactNode }) {
  if (!onImage) return <>{children}</>;
  return (
    <div
      className="group/img relative cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onImage(k);
      }}
    >
      {children}
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-xl bg-indigo-900/30 text-sm font-semibold text-white group-hover/img:flex">이미지 편집</span>
    </div>
  );
}

type EdFn = (path: string, value: string, opts?: { as?: string; className?: string; placeholder?: string; rich?: boolean; single?: boolean; list?: boolean }) => ReactNode;

export function BlockView({
  b: raw,
  lang = "ko",
  draft = false,
  onImage,
  ed,
}: {
  b: Block;
  lang?: string;
  draft?: boolean;
  onImage?: (key: string) => void;
  /** Inline editing (editor only). */
  ed?: EdFn;
}) {
  const editing = !!ed;
  // Skip empty lines left over from editing (public page).
  const b = editing ? raw : { ...raw, items: raw.items.filter((x) => x.trim()) };
  const rows = editing || raw.type === "procon" || raw.type === "thumbs" ? raw.rows : raw.rows.filter((r) => r.some((c) => c.trim()));
  /** Text at `path`: editable in the editor, formatted on the page. */
  const T = (path: string, value: string, as: string, className = "", placeholder = "", extra: { single?: boolean; list?: boolean } = {}) =>
    ed ? ed(path, value, { as, className, placeholder, rich: true, ...extra }) : createElement(as, { className }, <Inline text={value} />);

  switch (b.type) {
    case "h2":
      if (!editing && !b.text.trim()) return null;
      return (
        <h2 className="mt-12 mb-4 flex flex-wrap items-center gap-2 text-2xl font-bold leading-snug">
          {b.label && <span className="inline-block rounded bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">{b.label}</span>}
          {T("text", b.text, "span", "min-w-[4rem] flex-1", "소제목", { single: true })}
        </h2>
      );
    case "h3":
      return <h3 className="mt-8 mb-3 text-lg font-bold">{T("text", b.text, "span", "block", "작은 소제목", { single: true })}</h3>;
    case "p":
      return T("text", b.text, "p", "my-4 leading-8 whitespace-pre-line", "문단을 입력하세요");
    case "ul":
    case "ol": {
      const Tag = b.type;
      return (
        <Tag className={`my-4 space-y-1 pl-6 leading-7 ${b.type === "ul" ? "list-disc" : "list-decimal"}`}>
          {b.items.map((it, i) => <li key={i}>{T(`items.${i}`, it, "span", "block", "항목", { list: true })}</li>)}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className="my-8 border-l-4 border-indigo-500 pl-5 text-xl font-medium leading-relaxed text-slate-700">
          {T("text", b.text, "p", "", "기억에 남을 한 문장")}
        </blockquote>
      );
    case "say":
      return (
        <figure className="my-8 rounded-2xl bg-slate-50 px-8 py-6 text-center">
          <div className="text-5xl leading-none text-indigo-300">“</div>
          {T("text", b.text, "p", "text-lg font-medium leading-relaxed", "강조할 한마디")}
          {(b.label || editing) && T("label", b.label, "figcaption", "mt-2 text-sm text-slate-500", "누구의 말인지 (선택)", { single: true })}
        </figure>
      );
    case "table": {
      if (rows.length < 1) return null;
      const [head, ...body] = rows;
      return (
        <div className="my-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{head.map((c, i) => <th key={i} className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold">{T(`rows.0.${i}`, c, "span", "block", "머리글", { single: true })}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, i) => (
                <tr key={i}>{head.map((_, j) => <td key={j} className="border border-slate-200 px-3 py-2 align-top">{T(`rows.${i + 1}.${j}`, r[j] ?? "", "span", "block", "", { single: true })}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "box": {
      const labels = lang === "en" ? { summary: "Summary", tip: "Tip", info: "Good to know", warning: "Caution" } : BOX_STYLES;
      const st = b.style in BOX_STYLES ? (b.style as keyof typeof BOX_STYLES) : "info";
      return (
        <aside className={`my-6 rounded-xl border p-5 ${BOX_COLORS[st]}`}>
          <p className="mb-1 text-sm font-bold">{labels[st]}</p>
          {(b.text || editing) && T("text", b.text, "p", "leading-7", "첫 문장 (선택)")}
          {b.items.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 leading-7">{b.items.map((it, i) => <li key={i}>{T(`items.${i}`, it, "span", "block", "항목", { list: true })}</li>)}</ul>}
        </aside>
      );
    }
    case "img":
      if (!b.image_url && !draft) return null;
      return (
        <figure className="my-8">
          <Hot onImage={onImage} k="main">
            <Pic natural url={b.image_url} alt={b.text} prompt={b.prompt} className="aspect-[3/2] w-full rounded-xl" />
          </Hot>
          {b.text && b.image_url && <figcaption className="mt-2 text-center text-xs text-slate-500">{b.text}</figcaption>}
        </figure>
      );
    case "keys":
    case "stats":
      return (
        <div className={`my-6 grid gap-3 ${rows.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {rows.slice(0, 4).map((r, i) => (
            <div key={i} className={`rounded-xl border border-slate-200 p-4 ${b.type === "stats" ? "text-center" : ""}`}>
              {T(`rows.${i}.0`, r[0] ?? "", "b", `block ${b.type === "stats" ? "text-2xl text-indigo-600" : "text-indigo-700"}`, b.type === "stats" ? "숫자" : "제목", { single: true })}
              {T(`rows.${i}.1`, r[1] ?? "", "span", "mt-1 block text-sm leading-6 text-slate-600", "설명")}
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <ol className="my-6 space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="flex gap-4 rounded-xl border border-slate-200 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {T(`rows.${i}.0`, r[0] ?? "", "b", "block", "단계 제목", { single: true })}
                {T(`rows.${i}.1`, r[1] ?? "", "span", "block text-sm leading-6 text-slate-600", "설명")}
              </div>
            </li>
          ))}
        </ol>
      );
    case "procon": {
      const heads = lang === "en" ? ["Pros", "Cons"] : ["좋은 점", "아쉬운 점"];
      return (
        <div className="my-6 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((side) => (
            <div key={side} className={`rounded-xl border p-5 ${side === 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <h4 className="mb-2 font-bold">{heads[side]}</h4>
              <ul className="space-y-1 text-sm leading-6">
                {(editing ? (rows[side]?.length ? rows[side] : [""]) : (rows[side] ?? []).filter(Boolean)).map((p, i) => (
                  <li key={i} className="flex gap-1">
                    <span>{side === 0 ? "✓" : "✕"}</span>
                    {T(`rows.${side}.${i}`, p, "span", "block flex-1", "항목", { list: true })}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    }
    case "check":
      return (
        <ul className="my-6 space-y-2 rounded-xl border border-slate-200 p-5">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2 leading-7"><span className="text-indigo-600">☑</span>{T(`items.${i}`, it, "span", "block flex-1", "확인할 항목", { list: true })}</li>
          ))}
        </ul>
      );
    case "thumbs": {
      const card = b.style === "card";
      return (
        <div className={`my-6 grid gap-4 ${card ? "sm:grid-cols-3" : ""}`}>
          {rows.slice(0, 4).map((r, i) => (
            <div key={i} className={`flex gap-4 overflow-hidden rounded-xl border border-slate-200 ${card ? "flex-col" : "flex-col sm:flex-row"}`}>
              <div className={card ? "w-full" : "w-full sm:w-48 sm:shrink-0"}>
                <Hot onImage={onImage} k={`t${i}`}>
                  <Pic url={b.images[i] ?? ""} alt={plain(r[0] ?? "")} prompt={r[2]} className="aspect-[4/3] w-full" />
                </Hot>
              </div>
              <div className={`min-w-0 flex-1 ${card ? "px-4 pb-4" : "p-4 sm:pl-0"}`}>
                {T(`rows.${i}.0`, r[0] ?? "", "h3", "font-bold", "제목", { single: true })}
                {T(`rows.${i}.1`, r[1] ?? "", "p", "mt-1 text-sm leading-6 text-slate-600", "설명")}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }
  return null;
}

export function ArticleBody({
  title,
  header,
  blocks,
  faq,
  lang = "ko",
  draft = false,
  meta,
}: {
  title: string;
  header: Partial<HeaderImage>;
  blocks: Block[];
  faq: Faq[];
  lang?: string;
  draft?: boolean;
  meta?: ReactNode;
}) {
  return (
    <article className="text-[17px] text-slate-800">
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      {meta}
      {(header.url || draft) && (
        <Pic natural url={header.url ?? ""} alt={header.alt ?? title} prompt={header.prompt} className="mt-6 aspect-[3/2] w-full rounded-2xl" />
      )}
      <div className="mt-6">
        {blocks.map((b) => <BlockView key={b.id} b={b} lang={lang} draft={draft} />)}
      </div>
      {faq.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold">{lang === "en" ? "FAQ" : "자주 묻는 질문"}</h2>
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {faq.map((q, i) => (
              <details key={i} className="group p-4" open={i === 0}>
                <summary className="cursor-pointer font-semibold">{q.question}</summary>
                <p className="mt-2 leading-7 text-slate-600"><Inline text={q.answer} /></p>
              </details>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
