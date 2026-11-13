"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArticleBody } from "@/components/article-view";
import { ImageField } from "@/components/image-field";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  BOX_STYLES,
  articleText,
  emptyBlock,
  newBlockId,
  plain,
  type Article,
  type Block,
  type BlockType,
  type Faq,
  type HeaderImage,
} from "@/lib/writer/types";
import { aiSeo, aiTitles, aiTransform, deleteArticle, saveArticle, setArticlePublished, type ArticleDraft } from "../actions";

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

function BlockEditor({
  b,
  update,
  userId,
  keyword,
  ai,
  aiBusy,
}: {
  b: Block;
  update: (patch: Partial<Block>) => void;
  userId: string;
  keyword: string;
  ai: (action: string) => void;
  aiBusy: boolean;
}) {
  const text = (rows = 3, placeholder = "") => (
    <textarea className="input" rows={rows} value={b.text} placeholder={placeholder} onChange={(e) => update({ text: e.target.value })} />
  );
  switch (b.type) {
    case "h2":
      return (
        <div className="flex gap-2">
          <input className="input w-28" value={b.label} onChange={(e) => update({ label: e.target.value })} placeholder="라벨(선택)" />
          <input className="input text-lg font-bold" value={b.text} onChange={(e) => update({ text: e.target.value })} placeholder="소제목" />
        </div>
      );
    case "h3":
      return <input className="input font-semibold" value={b.text} onChange={(e) => update({ text: e.target.value })} placeholder="작은 소제목" />;
    case "p":
    case "quote":
      return (
        <div className="space-y-2">
          {text(b.type === "p" ? 4 : 2)}
          <div className="flex flex-wrap gap-1">
            {AI_ACTIONS.map(([k, l]) => (
              <button key={k} type="button" disabled={aiBusy} onClick={() => ai(k)} className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                ✦ {l}
              </button>
            ))}
          </div>
        </div>
      );
    case "say":
      return (
        <div className="space-y-2">
          {text(2, "강조할 한마디")}
          <input className="input" value={b.label} onChange={(e) => update({ label: e.target.value })} placeholder="누구의 말인지 (예: 10년 차 캠퍼)" />
        </div>
      );
    case "ul":
    case "ol":
    case "check":
      return <LinesField initial={b.items.join("\n")} onChange={(v) => update({ items: toLines(v) })} placeholder="한 줄에 하나씩" />;
    case "box":
      return (
        <div className="space-y-2">
          <select className="input w-auto" value={b.style} onChange={(e) => update({ style: e.target.value })}>
            {Object.entries(BOX_STYLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {text(2, "첫 문장 (선택)")}
          <LinesField initial={b.items.join("\n")} onChange={(v) => update({ items: toLines(v) })} rows={3} placeholder="항목, 한 줄에 하나씩 (선택)" />
        </div>
      );
    case "img":
      return (
        <div className="space-y-2">
          <ImageField userId={userId} value={b.image_url} keyword={keyword} context={b.prompt || b.text} onChange={(url) => update({ image_url: url })} />
          <input className="input" value={b.text} onChange={(e) => update({ text: e.target.value })} placeholder="이미지 설명 (alt 텍스트)" />
        </div>
      );
    case "table":
      return (
        <div className="space-y-1">
          <LinesField initial={fromCells(b.rows)} onChange={(v) => update({ rows: toCells(v) })} rows={5} />
          <p className="text-xs text-slate-500">한 줄이 한 행이에요. 칸은 | 로 나눠요. 첫 줄은 머리글이에요.</p>
        </div>
      );
    case "keys":
    case "steps":
    case "stats":
      return (
        <div className="space-y-1">
          <LinesField initial={fromCells(b.rows)} onChange={(v) => update({ rows: toCells(v) })} />
          <p className="text-xs text-slate-500">한 줄에 하나씩, &lsquo;{b.type === "stats" ? "숫자 | 설명" : "제목 | 설명"}&rsquo; 형식으로 적어요.</p>
        </div>
      );
    case "procon":
      return (
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
      );
    case "thumbs": {
      const setRow = (i: number, j: number, v: string) => update({ rows: b.rows.map((r, k) => (k === i ? Object.assign([...r], { [j]: v }) : r)) });
      return (
        <div className="space-y-3">
          <select className="input w-auto" value={b.style} onChange={(e) => update({ style: e.target.value })}>
            <option value="side">이미지 왼쪽</option>
            <option value="card">카드형</option>
          </select>
          {b.rows.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg bg-slate-50 p-3">
              <div className="flex gap-2">
                <input className="input font-semibold" value={r[0] ?? ""} onChange={(e) => setRow(i, 0, e.target.value)} placeholder="제목" />
                <button
                  type="button"
                  className="btn-secondary px-2"
                  onClick={() => update({ rows: b.rows.filter((_, k) => k !== i), images: b.images.filter((_, k) => k !== i) })}
                >
                  ✕
                </button>
              </div>
              <textarea className="input" rows={2} value={r[1] ?? ""} onChange={(e) => setRow(i, 1, e.target.value)} placeholder="설명" />
              <ImageField
                compact
                ratio="4:3"
                userId={userId}
                value={b.images[i] ?? ""}
                keyword={keyword}
                context={r[2] || plain(r[0] ?? "")}
                onChange={(url) => {
                  const images = [...b.images];
                  while (images.length < b.rows.length) images.push("");
                  images[i] = url;
                  update({ images });
                }}
              />
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
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState("");
  const [titleIdeas, setTitleIdeas] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const lang = article.brief?.language === "en" ? "en" : "ko";

  // Mark dirty on any change after the first render.
  const snapshot = JSON.stringify([title, keyword, slug, seoTitle, meta, tags, header, blocks, faq]);
  const [initial] = useState(snapshot);
  useEffect(() => setDirty(snapshot !== initial), [snapshot, initial]);
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
    const r = await saveArticle(article.id, draft());
    if (r.error) {
      setMsg({ type: "error", text: r.error });
      return false;
    }
    if (r.slug) {
      setSlug(r.slug);
      setSavedSlug(r.slug);
    }
    setDirty(false);
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

  const updateBlock = (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const n = [...bs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const insertAt = (i: number, type: BlockType) => setBlocks((bs) => [...bs.slice(0, i), emptyBlock(type), ...bs.slice(i)]);

  const ctx = { title, keyword, language: lang };

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
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            {(["edit", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                {t === "edit" ? "편집" : "미리보기"}
              </button>
            ))}
          </div>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {tab === "preview" ? (
            <div className="card px-6 py-10 sm:px-12">
              <ArticleBody title={title} header={header} blocks={blocks} faq={faq} lang={lang} draft />
            </div>
          ) : (
            <div className="space-y-4">
              <section className="card space-y-3 p-5">
                <label className="label">글 제목</label>
                <div className="flex gap-2">
                  <input className="input text-lg font-bold" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <button className="btn-secondary shrink-0" disabled={!!aiBusy} onClick={ideas}>{aiBusy === "title" ? "…" : "✦ 제목 추천"}</button>
                </div>
                {titleIdeas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {titleIdeas.map((t) => (
                      <button key={t} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800 hover:bg-violet-100" onClick={() => setTitle(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <label className="label pt-2">대표 이미지</label>
                <ImageField userId={userId} value={header.url ?? ""} keyword={keyword} context={header.prompt || title} onChange={(url) => setHeader((h) => ({ ...h, url }))} />
                <input className="input" value={header.alt ?? ""} onChange={(e) => setHeader((h) => ({ ...h, alt: e.target.value }))} placeholder="대표 이미지 설명 (alt 텍스트)" />
              </section>

              {blocks.map((b, i) => (
                <section key={b.id} className={`card p-4 ${aiBusy === b.id ? "opacity-60" : ""}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500">{BLOCK_LABELS[b.type]}</span>
                    <div className="flex gap-1 text-xs">
                      <button className="rounded px-1.5 py-0.5 hover:bg-slate-100" title="위로" onClick={() => move(i, -1)}>↑</button>
                      <button className="rounded px-1.5 py-0.5 hover:bg-slate-100" title="아래로" onClick={() => move(i, 1)}>↓</button>
                      <button
                        className="rounded px-1.5 py-0.5 hover:bg-slate-100"
                        title="복제"
                        onClick={() => setBlocks((bs) => [...bs.slice(0, i + 1), { ...b, id: newBlockId() }, ...bs.slice(i + 1)])}
                      >
                        복제
                      </button>
                      <button className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50" title="삭제" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}>
                        삭제
                      </button>
                    </div>
                  </div>
                  <BlockEditor b={b} userId={userId} keyword={keyword} update={(p) => updateBlock(b.id, p)} ai={(a) => runAi(b, a)} aiBusy={!!aiBusy} />
                  <AddBlock onAdd={(t) => insertAt(i + 1, t)} />
                </section>
              ))}
              {blocks.length === 0 && <AddBlock onAdd={(t) => insertAt(0, t)} always />}

              <section className="card space-y-3 p-5">
                <h2 className="font-bold">자주 묻는 질문</h2>
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
              </section>
              <p className="text-xs text-slate-500">본문에서 **굵게** 와 [링크 글자](https://주소) 형식을 쓸 수 있어요. Ctrl+S로 저장돼요.</p>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="card space-y-2 p-5 text-sm">
            <h2 className="font-bold">글 주소</h2>
            {status === "published" ? (
              <a href={liveUrl} target="_blank" className="block break-all text-indigo-600 hover:underline">{liveUrl}</a>
            ) : (
              <a href={previewUrl} target="_blank" className="block break-all text-indigo-600 hover:underline">초안 미리보기 열기</a>
            )}
          </section>

          <section className="card space-y-3 p-5">
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

          <section className="card p-5">
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
        </aside>
      </div>
    </div>
  );
}

function AddBlock({ onAdd, always }: { onAdd: (t: BlockType) => void; always?: boolean }) {
  return (
    <div className={always ? "card p-4" : "mt-3"}>
      <select
        className="w-full rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 text-xs text-slate-500"
        value=""
        onChange={(e) => e.target.value && onAdd(e.target.value as BlockType)}
      >
        <option value="">+ 아래에 요소 추가…</option>
        {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
      </select>
    </div>
  );
}
