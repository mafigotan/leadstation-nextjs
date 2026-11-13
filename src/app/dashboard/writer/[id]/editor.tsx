"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { BlockView, Pic } from "@/components/article-view";
import { ImageMenu } from "@/components/image-field";
import { Modal, Selectable, ToolBtn, ToolInput, ToolSelect, VisualEditor, type PaletteItem } from "@/components/visual-editor";
import { Editable } from "@/components/editable";
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

/** Element options shown in the menu above the selected element. */
function blockTools(
  b: Block,
  update: (patch: Partial<Block>) => void,
  openImage: (key: string) => void,
  ai: (action: string) => void,
  aiBusy: boolean,
) {
  const addItem = () => update({ items: [...b.items, ""] });
  const addRow = (cells: number) => update({ rows: [...b.rows, Array(cells).fill("")] });
  const dropRow = (min: number) => b.rows.length > min && update({ rows: b.rows.slice(0, -1) });
  switch (b.type) {
    case "p":
    case "quote":
      return (
        <ToolSelect
          value=""
          onChange={(v) => v && !aiBusy && ai(v)}
          options={[["", aiBusy ? "AI 작업 중…" : "✦ AI로 고치기"], ...AI_ACTIONS.map(([k, l]) => [k, l] as [string, string])]}
        />
      );
    case "h2":
      return <ToolInput value={b.label} onChange={(label) => update({ label })} placeholder="라벨 (예: STEP, TIP)" width={130} />;
    case "box":
      return (
        <>
          <ToolSelect value={b.style} onChange={(style) => update({ style })} options={Object.entries(BOX_STYLES)} />
          <ToolBtn label="항목 추가" onClick={addItem}>+ 항목</ToolBtn>
        </>
      );
    case "ul":
    case "ol":
    case "check":
      return <ToolBtn label="항목 추가" onClick={addItem}>+ 항목</ToolBtn>;
    case "table": {
      const cols = b.rows[0]?.length ?? 2;
      return (
        <>
          <ToolBtn label="행 추가" onClick={() => addRow(cols)}>+ 행</ToolBtn>
          <ToolBtn label="행 삭제" onClick={() => dropRow(2)}>− 행</ToolBtn>
          <ToolBtn label="열 추가" onClick={() => cols < 6 && update({ rows: b.rows.map((r) => [...r, ""]) })}>+ 열</ToolBtn>
          <ToolBtn label="열 삭제" onClick={() => cols > 1 && update({ rows: b.rows.map((r) => r.slice(0, -1)) })}>− 열</ToolBtn>
        </>
      );
    }
    case "keys":
    case "stats":
    case "steps":
      return (
        <>
          <ToolBtn label="항목 추가" onClick={() => addRow(2)}>+ 항목</ToolBtn>
          <ToolBtn label="마지막 항목 삭제" onClick={() => dropRow(1)}>− 항목</ToolBtn>
        </>
      );
    case "img":
      return <ToolBtn label="이미지 변경" onClick={() => openImage("main")}>🖼 이미지 변경</ToolBtn>;
    case "thumbs":
      return (
        <>
          <ToolSelect value={b.style} onChange={(style) => update({ style })} options={[["side", "이미지 왼쪽"], ["card", "카드형"]]} />
          <ToolBtn label="항목 추가" onClick={() => b.rows.length < 4 && addRow(3)}>+ 항목</ToolBtn>
          <ToolBtn label="마지막 항목 삭제" onClick={() => b.rows.length > 1 && update({ rows: b.rows.slice(0, -1), images: b.images.slice(0, b.rows.length - 1) })}>− 항목</ToolBtn>
        </>
      );
  }
  return null;
}

function imagePanel(b: Block, key: string, update: (patch: Partial<Block>) => void, userId: string) {
  if (b.type === "img") {
    return (
      <ImageMenu
        userId={userId}
        value={b.image_url}
        onChange={(url) => update({ image_url: url })}
        context={b.prompt || b.text}
        ratio="3:2"
        alt={b.text}
        onAlt={(v) => update({ text: v })}
      />
    );
  }
  if (b.type === "thumbs" && key.startsWith("t")) {
    const i = Number(key.slice(1));
    const images = [...b.images];
    while (images.length < b.rows.length) images.push("");
    const moveRow = (d: -1 | 1) => {
      const j = i + d;
      if (j < 0 || j >= b.rows.length) return;
      const rows = [...b.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      [images[i], images[j]] = [images[j], images[i]];
      update({ rows, images });
    };
    return (
      <>
        <p className="mb-3 text-xs text-slate-500">{plain(b.rows[i]?.[0] ?? "") || `항목 ${i + 1}`}의 이미지</p>
        <ImageMenu
          userId={userId}
          value={images[i] ?? ""}
          context={b.rows[i]?.[2] || plain(b.rows[i]?.[0] ?? "")}
          ratio="4:3"
          onMove={moveRow}
          moveLabels={["앞 항목으로", "뒤 항목으로"]}
          onChange={(url) => update({ images: Object.assign([...images], { [i]: url }) })}
        />
      </>
    );
  }
  return null;
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
  const [headerModal, setHeaderModal] = useState(false);
  const lang = article.brief?.language === "en" ? "en" : "ko";

  const select = useCallback((id: string | null) => setSelected(id), []);

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
        label="글 제목"
        tools={<ToolBtn label="제목 추천" onClick={ideas}>{aiBusy === "title" ? "추천 중…" : "✦ 제목 추천"}</ToolBtn>}
      >
        <Editable as="h1" edKey="__title" single value={title} onChange={setTitle} placeholder="제목을 입력하세요" className="text-3xl font-bold leading-tight sm:text-4xl" />
      </Selectable>
      {titleIdeas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" style={{ fontFamily: "var(--font-sans)" }}>
          <span className="text-xs text-slate-500">추천 제목:</span>
          {titleIdeas.map((t) => (
            <button key={t} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800 hover:bg-violet-100" onClick={(e) => { e.stopPropagation(); setTitle(t); }}>{t}</button>
          ))}
          <button className="text-xs text-slate-400 hover:underline" onClick={(e) => { e.stopPropagation(); setTitleIdeas([]); }}>닫기</button>
        </div>
      )}
      <div className="h-8" />
      <Selectable
        id="__header"
        label="대표 이미지"
        tools={
          <>
            <ToolBtn label="이미지 변경" onClick={() => setHeaderModal(true)}>🖼 이미지 변경</ToolBtn>
            {header.url && <ToolBtn label="이미지 삭제" danger onClick={() => setHeader((h) => ({ ...h, url: "" }))}>✕ 삭제</ToolBtn>}
          </>
        }
      >
        <div
          className="group/img relative cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            select("__header");
            setHeaderModal(true);
          }}
        >
          <Pic natural url={header.url ?? ""} alt={header.alt ?? title} prompt={header.prompt} className="aspect-[3/2] w-full rounded-2xl" />
          <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-2xl bg-indigo-900/30 text-sm font-semibold text-white group-hover/img:flex">대표 이미지 편집</span>
        </div>
      </Selectable>
      {headerModal && (
        <Modal title="대표 이미지" onClose={() => setHeaderModal(false)}>
          <ImageMenu
            userId={userId}
            value={header.url ?? ""}
            onChange={(url) => setHeader((h) => ({ ...h, url }))}
            context={header.prompt || title}
            ratio="3:2"
            alt={header.alt}
            onAlt={(alt) => setHeader((h) => ({ ...h, alt }))}
          />
        </Modal>
      )}
      <div className="h-4" />
    </>
  );

  const setQ = (i: number, patch: Partial<Faq>) => setFaq((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const bottom = (
    <div className="mt-10">
      <Selectable
        id="__faq"
        label="자주 묻는 질문"
        tools={<ToolBtn label="질문 추가" onClick={() => setFaq((f) => [...f, { question: "", answer: "" }])}>+ 질문</ToolBtn>}
      >
        <section>
          <h2 className="mb-4 text-2xl font-bold">{lang === "en" ? "FAQ" : "자주 묻는 질문"}</h2>
          {faq.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">위쪽 메뉴의 &lsquo;+ 질문&rsquo;으로 추가하세요. (질문이 없으면 블로그에 표시되지 않아요)</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {faq.map((q, i) => (
                <div key={i} className="group/q relative p-4">
                  <Editable as="p" edKey={`faq.${i}.q`} single value={q.question} onChange={(v) => setQ(i, { question: v })} placeholder="질문" className="pr-8 font-semibold" />
                  <Editable as="p" edKey={`faq.${i}.a`} rich value={q.answer} onChange={(v) => setQ(i, { answer: v })} placeholder="답변" className="mt-2 leading-7 text-slate-600" />
                  <button
                    title="질문 삭제"
                    className="absolute right-3 top-3 hidden rounded px-1.5 text-xs text-red-500 hover:bg-red-50 group-hover/q:block"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFaq((f) => f.filter((_, j) => j !== i));
                    }}
                  >
                    ✕
                  </button>
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
        labels={(b) => BLOCK_LABELS[b.type]}
        create={(t) => emptyBlock(t as BlockType)}
        selected={selected}
        onSelect={select}
        settings={settings}
        settingsLabel="SEO·발행"
        top={top}
        bottom={bottom}
        canvasClassName="card px-6 py-10 text-[17px] text-slate-800 sm:px-12"
        renderBlock={(b, _i, { onImage, ed }) => (
          <div className={aiBusy === b.id ? "animate-pulse opacity-60" : ""}>
            <BlockView b={b} lang={lang} draft onImage={onImage} ed={ed} />
          </div>
        )}
        renderTools={(b, update, openImage) => blockTools(b, update, openImage, (a) => runAi(b, a), !!aiBusy)}
        renderImage={(b, key, update) => imagePanel(b, key, update, userId)}
      />
      <p className="mt-3 text-center text-xs text-slate-400">글자를 누르면 바로 고칠 수 있어요. 요소를 누르면 위쪽에 메뉴가 열리고, 이미지를 누르면 이미지 창이 열려요. Ctrl+S로 저장해요.</p>
    </div>
  );
}
