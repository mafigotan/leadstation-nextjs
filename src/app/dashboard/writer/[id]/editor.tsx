"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { BlockView, Inline, Pic } from "@/components/article-view";
import { ImageMenu } from "@/components/image-field";
import { PanelTitle, Selectable, VisualEditor, type PaletteItem } from "@/components/visual-editor";
import {
  BLOCK_LABELS,
  BOX_STYLES,
  articleText,
  emptyBlock,
  plain,
  type Article,
  type Block,
  type BlockType,
  type Faq,
  type HeaderImage,
} from "@/lib/writer/types";
import { aiSeo, aiTitles, aiTransform, deleteArticle, saveArticle, setArticlePublished, type ArticleDraft } from "../actions";

const PALETTE: PaletteItem[] = [
  { type: "p", label: BLOCK_LABELS.p, icon: "¶", hint: "본문 문장" },
  { type: "h2", label: BLOCK_LABELS.h2, icon: "H2", hint: "섹션 제목" },
  { type: "h3", label: BLOCK_LABELS.h3, icon: "H3" },
  { type: "img", label: BLOCK_LABELS.img, icon: "🖼", hint: "라이브러리, AI 생성" },
  { type: "thumbs", label: BLOCK_LABELS.thumbs, icon: "▦", hint: "이미지가 있는 항목 2~4개" },
  { type: "ul", label: BLOCK_LABELS.ul, icon: "•" },
  { type: "ol", label: BLOCK_LABELS.ol, icon: "1." },
  { type: "check", label: BLOCK_LABELS.check, icon: "☑" },
  { type: "table", label: BLOCK_LABELS.table, icon: "▤" },
  { type: "keys", label: BLOCK_LABELS.keys, icon: "◆", hint: "핵심 포인트 카드" },
  { type: "steps", label: BLOCK_LABELS.steps, icon: "→", hint: "순서대로 따라 하기" },
  { type: "procon", label: BLOCK_LABELS.procon, icon: "±" },
  { type: "stats", label: BLOCK_LABELS.stats, icon: "#", hint: "강조할 숫자" },
  { type: "box", label: BLOCK_LABELS.box, icon: "▢", hint: "요약, 팁, 주의" },
  { type: "quote", label: BLOCK_LABELS.quote, icon: "❝" },
  { type: "say", label: BLOCK_LABELS.say, icon: "💬" },
];

const AI_ACTIONS = [
  ["rewrite", "다시 쓰기"],
  ["expand", "늘리기"],
  ["shorten", "줄이기"],
  ["friendly", "친근하게"],
  ["professional", "전문적으로"],
  ["concise", "간결하게"],
] as const;

/** Textarea that keeps its own text so typing spaces and blank lines is not disturbed by parsing. */
function LinesField({ initial, onChange, rows = 4, placeholder }: { initial: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const [v, setV] = useState(initial);
  return (
    <textarea
      className="input font-mono text-[13px]"
      rows={rows}
      value={v}
      placeholder={placeholder}
      onChange={(e) => {
        setV(e.target.value);
        onChange(e.target.value);
      }}
    />
  );
}

const toLines = (v: string) => v.split("\n");
const toCells = (v: string) => v.split("\n").map((l) => l.split("|").map((c) => c.trim()));
const fromCells = (rows: string[][]) => rows.map((r) => r.join(" | ")).join("\n");
const Hint = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-slate-500">{children}</p>;

function BlockPanel({
  b,
  sub,
  update,
  move,
  userId,
  ai,
  aiBusy,
}: {
  b: Block;
  sub: string | null;
  update: (patch: Partial<Block>) => void;
  move: (d: -1 | 1) => void;
  userId: string;
  ai: (action: string) => void;
  aiBusy: boolean;
}) {
  const text = (rows = 3, placeholder = "") => (
    <textarea autoFocus className="input" rows={rows} value={b.text} placeholder={placeholder} onChange={(e) => update({ text: e.target.value })} />
  );
  const title = <PanelTitle>{BLOCK_LABELS[b.type]} 편집</PanelTitle>;
  switch (b.type) {
    case "h2":
      return (
        <>
          {title}
          <div className="flex gap-2">
            <input className="input w-28" value={b.label} onChange={(e) => update({ label: e.target.value })} placeholder="라벨(선택)" />
            <input autoFocus className="input font-bold" value={b.text} onChange={(e) => update({ text: e.target.value })} placeholder="소제목" />
          </div>
        </>
      );
    case "h3":
      return (
        <>
          {title}
          <input autoFocus className="input font-semibold" value={b.text} onChange={(e) => update({ text: e.target.value })} placeholder="작은 소제목" />
        </>
      );
    case "p":
    case "quote":
      return (
        <div className="space-y-2">
          {title}
          {text(b.type === "p" ? 5 : 2)}
          <div className="flex flex-wrap gap-1">
            {AI_ACTIONS.map(([k, l]) => (
              <button key={k} type="button" disabled={aiBusy} onClick={() => ai(k)} className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                ✦ {l}
              </button>
            ))}
          </div>
          <Hint>**굵게**, [링크 글자](https://주소) 형식을 쓸 수 있어요.</Hint>
        </div>
      );
    case "say":
      return (
        <div className="space-y-2">
          {title}
          {text(2, "강조할 한마디")}
          <input className="input" value={b.label} onChange={(e) => update({ label: e.target.value })} placeholder="누구의 말인지 (예: 10년 차 캠퍼)" />
        </div>
      );
    case "ul":
    case "ol":
    case "check":
      return (
        <div className="space-y-2">
          {title}
          <LinesField initial={b.items.join("\n")} onChange={(v) => update({ items: toLines(v) })} placeholder="한 줄에 하나씩" />
        </div>
      );
    case "box":
      return (
        <div className="space-y-2">
          {title}
          <div className="flex flex-wrap gap-1">
            {Object.entries(BOX_STYLES).map(([v, l]) => (
              <button key={v} type="button" onClick={() => update({ style: v })} className={`rounded-full border px-3 py-1 text-xs ${b.style === v ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                {l}
              </button>
            ))}
          </div>
          {text(2, "첫 문장 (선택)")}
          <LinesField initial={b.items.join("\n")} onChange={(v) => update({ items: toLines(v) })} rows={3} placeholder="항목, 한 줄에 하나씩 (선택)" />
        </div>
      );
    case "img":
      return (
        <>
          <PanelTitle>이미지</PanelTitle>
          <ImageMenu
            userId={userId}
            value={b.image_url}
            onChange={(url) => update({ image_url: url })}
            context={b.prompt || b.text}
            ratio="3:2"
            onMove={move}
            alt={b.text}
            onAlt={(v) => update({ text: v })}
          />
        </>
      );
    case "table":
      return (
        <div className="space-y-2">
          {title}
          <LinesField initial={fromCells(b.rows)} onChange={(v) => update({ rows: toCells(v) })} rows={6} />
          <Hint>한 줄이 한 행이에요. 칸은 | 로 나눠요. 첫 줄은 머리글이에요.</Hint>
        </div>
      );
    case "keys":
    case "steps":
    case "stats":
      return (
        <div className="space-y-2">
          {title}
          <LinesField initial={fromCells(b.rows)} onChange={(v) => update({ rows: toCells(v) })} />
          <Hint>한 줄에 하나씩, &lsquo;{b.type === "stats" ? "숫자 | 설명" : "제목 | 설명"}&rsquo; 형식으로 적어요.</Hint>
        </div>
      );
    case "procon":
      return (
        <>
          {title}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-emerald-700">좋은 점 (한 줄에 하나씩)</p>
              <LinesField initial={(b.rows[0] ?? []).join("\n")} onChange={(v) => update({ rows: [toLines(v), b.rows[1] ?? []] })} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-rose-700">아쉬운 점 (한 줄에 하나씩)</p>
              <LinesField initial={(b.rows[1] ?? []).join("\n")} onChange={(v) => update({ rows: [b.rows[0] ?? [], toLines(v)] })} />
            </div>
          </div>
        </>
      );
    case "thumbs": {
      const images = [...b.images];
      while (images.length < b.rows.length) images.push("");
      const setRow = (i: number, j: number, v: string) => update({ rows: b.rows.map((r, k) => (k === i ? Object.assign([...r], { [j]: v }) : r)) });
      const moveRow = (i: number, d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= b.rows.length) return;
        const rows = [...b.rows];
        const imgs = [...images];
        [rows[i], rows[j]] = [rows[j], rows[i]];
        [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
        update({ rows, images: imgs });
      };
      const imgIndex = sub?.startsWith("t") ? Number(sub.slice(1)) : -1;
      return (
        <div className="space-y-3">
          {title}
          <div className="flex gap-1">
            {[["side", "이미지 왼쪽"], ["card", "카드형"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => update({ style: v })} className={`rounded-full border px-3 py-1 text-xs ${b.style === v ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                {l}
              </button>
            ))}
          </div>
          {b.rows.map((r, i) => (
            <div key={i} className={`space-y-2 rounded-lg p-3 ${imgIndex === i ? "bg-indigo-50 ring-1 ring-indigo-200" : "bg-slate-50"}`}>
              <div className="flex gap-2">
                <input className="input font-semibold" value={r[0] ?? ""} onChange={(e) => setRow(i, 0, e.target.value)} placeholder={`항목 ${i + 1} 제목`} />
                <button type="button" className="btn-secondary px-2" onClick={() => update({ rows: b.rows.filter((_, k) => k !== i), images: images.filter((_, k) => k !== i) })}>
                  ✕
                </button>
              </div>
              <textarea className="input" rows={2} value={r[1] ?? ""} onChange={(e) => setRow(i, 1, e.target.value)} placeholder="설명" />
              {imgIndex === i ? (
                <ImageMenu
                  userId={userId}
                  value={images[i]}
                  context={r[2] || plain(r[0] ?? "")}
                  ratio="4:3"
                  onMove={(d) => moveRow(i, d)}
                  moveLabels={["앞 항목으로", "뒤 항목으로"]}
                  onChange={(url) => update({ images: Object.assign([...images], { [i]: url }) })}
                />
              ) : (
                <Hint>본문에서 이 항목의 이미지를 누르면 이미지 메뉴가 열려요.</Hint>
              )}
            </div>
          ))}
          {b.rows.length < 4 && (
            <button type="button" className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => update({ rows: [...b.rows, ["", "", ""]] })}>
              + 항목 추가
            </button>
          )}
        </div>
      );
    }
  }
}

export function ArticleEditor({ article, userId, publicBase, previewBase }: { article: Article; userId: string; publicBase: string; previewBase: string }) {
  const [title, setTitle] = useState(article.title);
  const [keyword, setKeyword] = useState(article.keyword);
  const [slug, setSlug] = useState(article.slug);
  const [seoTitle, setSeoTitle] = useState(article.seo_title);
  const [meta, setMeta] = useState(article.meta_description);
  const [tags, setTags] = useState(article.tags.join(", "));
  const [header, setHeader] = useState<Partial<HeaderImage>>(article.header_image ?? {});
  const [blocks, setBlocks] = useState<Block[]>(article.blocks);
  const [faq, setFaq] = useState<Faq[]>(article.faq);
  const [savedSlug, setSavedSlug] = useState(article.slug);
  const [status, setStatus] = useState(article.status);
  const [savedSnap, setSavedSnap] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState("");
  const [titleIdeas, setTitleIdeas] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const lang = article.brief?.language === "en" ? "en" : "ko";

  const select = useCallback((id: string | null, s?: string | null) => {
    setSelected(id);
    setSub(s ?? null);
  }, []);

  const snapshot = JSON.stringify([title, keyword, slug, seoTitle, meta, tags, header, blocks, faq]);
  useEffect(() => setSavedSnap((s) => s || snapshot), [snapshot]);
  const dirty = !!savedSnap && snapshot !== savedSnap;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const draft = (): ArticleDraft => ({
    title,
    keyword,
    slug,
    seo_title: seoTitle,
    meta_description: meta,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    header_image: header,
    blocks,
    faq,
  });

  async function save(): Promise<boolean> {
    const snap = snapshot;
    const r = await saveArticle(article.id, draft());
    if (r.error) {
      setMsg({ type: "error", text: r.error });
      return false;
    }
    if (r.slug) setSavedSlug(r.slug);
    setSavedSnap(snap);
    return true;
  }

  const onSave = () =>
    startTransition(async () => {
      if (await save()) setMsg({ type: "ok", text: "저장했어요." });
    });

  const onPublish = (publish: boolean) =>
    startTransition(async () => {
      if (!(await save())) return;
      await setArticlePublished(article.id, publish);
      setStatus(publish ? "published" : "draft");
      setMsg({ type: "ok", text: publish ? "발행했어요. 블로그에서 바로 볼 수 있어요." : "발행을 취소하고 초안으로 돌렸어요." });
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ctx = { title, keyword, language: lang };
  const updateBlock = (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  async function runAi(b: Block, action: string) {
    setAiBusy(b.id);
    setMsg(null);
    const r = await aiTransform(action, b.text, ctx);
    setAiBusy("");
    if (r.error) setMsg({ type: "error", text: r.error });
    else if (r.text) updateBlock(b.id, { text: r.text });
  }

  async function ideas() {
    setAiBusy("title");
    const r = await aiTitles(blocks, ctx);
    setAiBusy("");
    if (r.error) setMsg({ type: "error", text: r.error });
    else setTitleIdeas(r.titles ?? []);
  }

  async function seo() {
    setAiBusy("seo");
    const r = await aiSeo(blocks, ctx);
    setAiBusy("");
    if ("error" in r && r.error) return setMsg({ type: "error", text: r.error });
    if ("seo" in r && r.seo) {
      setSeoTitle(r.seo.seo_title);
      setMeta(r.seo.meta_description);
      if (r.seo.slug) setSlug(r.seo.slug);
      setTags(r.seo.tags.join(", "));
    }
  }

  const checks = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const has = (t: string) => !!kw && plain(t).toLowerCase().includes(kw);
    const firstP = blocks.find((b) => b.type === "p")?.text ?? "";
    const body = articleText(blocks);
    const count = kw ? body.toLowerCase().split(kw).length - 1 : 0;
    return [
      ["제목에 키워드 포함", has(title)],
      ["SEO 제목에 키워드 포함", has(seoTitle)],
      ["SEO 제목 60자 이하", seoTitle.length > 0 && seoTitle.length <= 60],
      ["메타 설명에 키워드 포함", has(meta)],
      ["메타 설명 80~160자", meta.length >= 80 && meta.length <= 160],
      ["첫 문단에 키워드 포함", has(firstP)],
      [`본문 키워드 ${count}회 (2회 이상)`, count >= 2],
      ["소제목(h2) 2개 이상", blocks.filter((b) => b.type === "h2").length >= 2],
      ["대표 이미지 있음", !!header.url],
      [`본문 ${body.length.toLocaleString()}자 (800자 이상)`, body.length >= 800],
    ] as [string, boolean][];
  }, [keyword, title, seoTitle, meta, blocks, header.url]);
  const score = Math.round((checks.filter((c) => c[1]).length / checks.length) * 100);

  const liveUrl = publicBase.replace("SLUG", savedSlug);
  const previewUrl = previewBase.replace("SLUG", savedSlug);

  const settings = (
    <>
      <section className="card space-y-2 p-4 text-sm">
        <h2 className="font-bold">글 주소</h2>
        {status === "published" ? (
          <a href={liveUrl} target="_blank" className="block break-all text-indigo-600 hover:underline">{liveUrl}</a>
        ) : (
          <a href={previewUrl} target="_blank" className="block break-all text-indigo-600 hover:underline">초안 미리보기 열기</a>
        )}
      </section>
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">SEO</h2>
          <button className="text-sm font-medium text-violet-700 hover:underline disabled:opacity-50" disabled={!!aiBusy} onClick={seo}>
            {aiBusy === "seo" ? "작성 중…" : "✦ AI로 채우기"}
          </button>
        </div>
        <div>
          <label className="label">포커스 키워드</label>
          <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div>
          <label className="label">SEO 제목 <span className="font-normal text-slate-400">{seoTitle.length}자</span></label>
          <input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">메타 설명 <span className="font-normal text-slate-400">{meta.length}자</span></label>
          <textarea className="input" rows={3} value={meta} onChange={(e) => setMeta(e.target.value)} />
        </div>
        <div>
          <label className="label">주소 (slug)</label>
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        </div>
        <div>
          <label className="label">태그 (쉼표로 구분)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
      </section>
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">SEO 점검</h2>
          <span className={`text-lg font-bold ${score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>{score}점</span>
        </div>
        <ul className="space-y-1 text-sm">
          {checks.map(([label, ok]) => (
            <li key={label} className={ok ? "text-slate-700" : "text-slate-400"}>{ok ? "✓" : "○"} {label}</li>
          ))}
        </ul>
      </section>
      <button
        className="btn-danger w-full"
        onClick={() => {
          if (confirm("이 글을 삭제할까요? 되돌릴 수 없어요.")) startTransition(() => deleteArticle(article.id));
        }}
      >
        글 삭제
      </button>
    </>
  );

  const top = (
    <>
      <Selectable
        id="__title"
        panel={
          <div className="space-y-2">
            <PanelTitle>글 제목</PanelTitle>
            <div className="flex gap-2">
              <input autoFocus className="input font-bold" value={title} onChange={(e) => setTitle(e.target.value)} />
              <button className="btn-secondary shrink-0" disabled={!!aiBusy} onClick={ideas}>{aiBusy === "title" ? "…" : "✦ 제목 추천"}</button>
            </div>
            {titleIdeas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {titleIdeas.map((t) => (
                  <button key={t} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800 hover:bg-violet-100" onClick={() => setTitle(t)}>{t}</button>
                ))}
              </div>
            )}
          </div>
        }
      >
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title || "제목을 입력하세요"}</h1>
      </Selectable>
      <div className="h-6" />
      <Selectable
        id="__header"
        panel={
          <>
            <PanelTitle>대표 이미지</PanelTitle>
            <ImageMenu
              userId={userId}
              value={header.url ?? ""}
              onChange={(url) => setHeader((h) => ({ ...h, url }))}
              context={header.prompt || title}
              ratio="3:2"
              alt={header.alt}
              onAlt={(alt) => setHeader((h) => ({ ...h, alt }))}
            />
          </>
        }
      >
        <div className="group/img relative">
          <Pic natural url={header.url ?? ""} alt={header.alt ?? title} prompt={header.prompt} className="aspect-[3/2] w-full rounded-2xl" />
          <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-2xl bg-indigo-900/30 text-sm font-semibold text-white group-hover/img:flex">대표 이미지 편집</span>
        </div>
      </Selectable>
      <div className="h-4" />
    </>
  );

  const bottom = (
    <div className="mt-10">
      <Selectable
        id="__faq"
        panel={
          <div className="space-y-3">
            <PanelTitle>자주 묻는 질문</PanelTitle>
            {faq.map((q, i) => (
              <div key={i} className="space-y-2 rounded-lg bg-slate-50 p-3">
                <div className="flex gap-2">
                  <input className="input font-semibold" value={q.question} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} placeholder="질문" />
                  <button className="btn-secondary px-2" onClick={() => setFaq(faq.filter((_, j) => j !== i))}>✕</button>
                </div>
                <textarea className="input" rows={2} value={q.answer} onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} placeholder="답변" />
              </div>
            ))}
            <button className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => setFaq([...faq, { question: "", answer: "" }])}>+ 질문 추가</button>
          </div>
        }
      >
        <section>
          <h2 className="mb-4 text-2xl font-bold">{lang === "en" ? "FAQ" : "자주 묻는 질문"}</h2>
          {faq.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">눌러서 질문을 추가하세요. (질문이 없으면 블로그에 표시되지 않아요)</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {faq.map((q, i) => (
                <div key={i} className="p-4">
                  <p className="font-semibold">{q.question}</p>
                  <p className="mt-2 leading-7 text-slate-600"><Inline text={q.answer} /></p>
                </div>
              ))}
            </div>
          )}
        </section>
      </Selectable>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/writer" className="text-sm text-slate-500 hover:underline">← AI 글쓰기</Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold">글 편집</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {status === "published" ? "발행됨" : "초안"}
            </span>
            {dirty && <span className="text-xs text-amber-600">저장 안 된 변경 있음</span>}
            <span className={`text-xs font-semibold ${score >= 80 ? "text-emerald-600" : "text-amber-600"}`}>SEO {score}점</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={pending} onClick={onSave}>저장</button>
          {status === "published" ? (
            <button className="btn-secondary" disabled={pending} onClick={() => onPublish(false)}>발행 취소</button>
          ) : (
            <button className="btn-primary" disabled={pending} onClick={() => onPublish(true)}>발행하기</button>
          )}
        </div>
      </div>

      {msg && (
        <p className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <VisualEditor
        blocks={blocks}
        onChange={setBlocks}
        palette={PALETTE}
        create={(t) => emptyBlock(t as BlockType)}
        selected={selected}
        sub={sub}
        onSelect={select}
        settings={settings}
        settingsLabel="SEO·발행"
        top={top}
        bottom={bottom}
        canvasClassName="card px-6 py-10 text-[17px] text-slate-800 sm:px-12"
        renderBlock={(b, _i, onImage) => (
          <div className={aiBusy === b.id ? "animate-pulse opacity-60" : ""}>
            {isEmpty(b) ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">{BLOCK_LABELS[b.type]}: 눌러서 내용을 입력하세요</p>
            ) : (
              <BlockView b={b} lang={lang} draft onImage={onImage} />
            )}
          </div>
        )}
        renderPanel={(b, _i, s, update, move) => (
          <BlockPanel b={b} sub={s} update={update} move={move} userId={userId} ai={(a) => runAi(b, a)} aiBusy={!!aiBusy} />
        )}
      />
      <p className="mt-3 text-center text-xs text-slate-400">요소를 누르면 편집 메뉴가 열려요. Esc로 닫고, Ctrl+S로 저장해요.</p>
    </div>
  );
}

function isEmpty(b: Block) {
  if (b.type === "img" || b.type === "thumbs") return false;
  const any = b.text.trim() || b.items.some((x) => x.trim()) || b.rows.some((r) => r.some((c) => c.trim()));
  return !any;
}
