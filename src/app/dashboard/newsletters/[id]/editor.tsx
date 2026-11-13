"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { previewTheme } from "@/lib/newsletter/render";
import {
  BLOCK_LABELS,
  TEMPLATES,
  TONES,
  emptyBlock,
  emptyItem,
  type Block,
  type BlockItem,
  type BlockType,
  type Newsletter,
  type SenderSettings,
} from "@/lib/newsletter/types";
import { deleteNewsletter, duplicateNewsletter, generateWithAi, restorePrevious, saveNewsletter, sendTest } from "../actions";
import { ImageMenu } from "@/components/image-field";
import { Selectable, ToolBtn, ToolInput, VisualEditor, type PaletteItem } from "@/components/visual-editor";
import { Editable } from "@/components/editable";
import { NewsletterBlockView } from "./block-view";

const PALETTE: PaletteItem[] = [
  { type: "hero", label: BLOCK_LABELS.hero, icon: "★", hint: "큰 이미지 + 제목 + 도입" },
  { type: "heading", label: BLOCK_LABELS.heading, icon: "H" },
  { type: "text", label: BLOCK_LABELS.text, icon: "¶", hint: "제목(선택) + 문단" },
  { type: "image", label: BLOCK_LABELS.image, icon: "🖼", hint: "라이브러리, AI 생성" },
  { type: "cards", label: BLOCK_LABELS.cards, icon: "▦", hint: "이미지 카드 2~3개" },
  { type: "thumbs", label: BLOCK_LABELS.thumbs, icon: "☰", hint: "작은 썸네일 + 제목 목록" },
  { type: "button", label: BLOCK_LABELS.button, icon: "▭", hint: "행동 유도 버튼" },
  { type: "divider", label: BLOCK_LABELS.divider, icon: "—" },
];

type Draft = {
  title: string;
  subject: string;
  preheader: string;
  topic: string;
  prompt: string;
  tone: string;
  template: string;
  greeting: boolean;
  blocks: Block[];
};

export function NewsletterEditor({
  newsletter,
  settings,
  userId,
}: {
  newsletter: Newsletter;
  settings: SenderSettings;
  userId: string;
  siteUrl: string;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: newsletter.title,
    subject: newsletter.subject,
    preheader: newsletter.preheader,
    topic: newsletter.topic,
    prompt: newsletter.prompt,
    tone: newsletter.tone,
    template: newsletter.template,
    greeting: newsletter.greeting,
    blocks: newsletter.blocks ?? [],
  });
  const [dirty, setDirty] = useState(false);
  const [canUndo, setCanUndo] = useState(!!newsletter.previous_blocks?.length);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [testEmail, setTestEmail] = useState("");

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const [selected, setSelected] = useState<string | null>(null);
  const select = useCallback((id: string | null) => setSelected(id), []);

  const run = (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setStatus(null);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setBusy(null);
      }
    });
  };

  const save = () =>
    run("저장 중...", async () => {
      const res = await saveNewsletter(newsletter.id, draft);
      if (res.error) setStatus({ kind: "error", text: res.error });
      else {
        setDirty(false);
        setStatus({ kind: "ok", text: "저장했어요." });
      }
    });

  const ai = (mode: "new" | "edit") =>
    run(mode === "new" ? "AI가 뉴스레터를 쓰고 있어요... (30초~1분)" : "AI가 본문을 고치고 있어요... (30초~1분)", async () => {
      const res = await generateWithAi(newsletter.id, draft, mode);
      if ("error" in res && res.error) {
        setStatus({ kind: "error", text: res.error });
        return;
      }
      if ("blocks" in res && res.blocks) {
        setDraft((d) => ({ ...d, title: res.title ?? d.title, subject: res.subject ?? "", preheader: res.preheader ?? "", blocks: res.blocks! }));
        setCanUndo(draft.blocks.length > 0 || canUndo);
        setDirty(false);
        setStatus({ kind: "ok", text: mode === "new" ? "AI가 뉴스레터를 만들었어요. 내용을 확인하고 필요한 부분을 고쳐주세요." : "AI가 본문을 수정했어요." });
      }
    });

  const undo = () =>
    run("되돌리는 중...", async () => {
      const res = await restorePrevious(newsletter.id);
      if (res.error) setStatus({ kind: "error", text: res.error });
      else if (res.blocks) {
        setDraft((d) => ({ ...d, blocks: res.blocks as Block[] }));
        setStatus({ kind: "ok", text: "이전 본문으로 되돌렸어요." });
      }
    });

  const test = () =>
    run("테스트 메일 보내는 중...", async () => {
      if (dirty) {
        const saved = await saveNewsletter(newsletter.id, draft);
        if (saved.error) return setStatus({ kind: "error", text: saved.error });
        setDirty(false);
      }
      const res = await sendTest(newsletter.id, testEmail);
      setStatus(res.error ? { kind: "error", text: res.error } : { kind: "ok", text: res.message! });
    });

  const t = previewTheme(draft.template as Newsletter["template"], settings);
  const fromName = settings.from_name || "LEADstation";

  const aiSettings = (
    <>
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">AI로 작성</h2>
        <div>
          <label className="label">이메일 내용 *</label>
          <textarea
            rows={5}
            value={draft.topic}
            onChange={(e) => update({ topic: e.target.value })}
            className="input"
            placeholder="이번 뉴스레터에 담을 주제와 주요 내용을 적어주세요. 링크 주소가 있으면 함께 적으면 버튼에 넣어줘요."
          />
        </div>
        <div>
          <label className="label">명령 프롬프트 (선택)</label>
          <textarea rows={2} value={draft.prompt} onChange={(e) => update({ prompt: e.target.value })} className="input" placeholder="예: 신제품 3개를 카드로 보여주고, 마지막에 구매 버튼을 넣어줘" />
        </div>
        <div>
          <label className="label">톤&매너</label>
          <select value={draft.tone} onChange={(e) => update({ tone: e.target.value })} className="input">
            {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">디자인 템플릿</label>
          <select value={draft.template} onChange={(e) => update({ template: e.target.value })} className="input">
            {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={draft.greeting} onChange={(e) => update({ greeting: e.target.checked })} />
          수신자 이름 자동 입력 (본문 맨 위에 &quot;OOO님 안녕하세요&quot;)
        </label>
        <div className="flex flex-col gap-2">
          {draft.blocks.length === 0 ? (
            <button onClick={() => ai("new")} disabled={!!busy} className="btn-primary">AI로 뉴스레터 만들기</button>
          ) : (
            <>
              <button onClick={() => ai("edit")} disabled={!!busy} className="btn-primary">AI로 뉴스레터 수정하기</button>
              <button
                onClick={() => confirm("지금 본문을 지우고 처음부터 새로 만들까요? (이전 본문은 되돌리기로 복구할 수 있어요)") && ai("new")}
                disabled={!!busy}
                className="btn-secondary"
              >
                처음부터 새로 만들기
              </button>
            </>
          )}
          {canUndo && <button onClick={undo} disabled={!!busy} className="btn-secondary">이전 본문으로 되돌리기</button>}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">테스트 메일</h2>
        <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="input" placeholder="받을 이메일 (여러 개는 쉼표로)" />
        <button onClick={test} disabled={!!busy} className="btn-secondary w-full">보내기</button>
      </section>

      <div className="flex gap-2">
        <form action={duplicateNewsletter.bind(null, newsletter.id)} className="flex-1">
          <button className="btn-secondary w-full">복제</button>
        </form>
        <form
          className="flex-1"
          action={async () => {
            if (!confirm("이 뉴스레터와 발송 기록을 삭제할까요?")) return;
            const res = await deleteNewsletter(newsletter.id);
            if (res?.error) setStatus({ kind: "error", text: res.error });
          }}
        >
          <button className="btn-danger w-full">삭제</button>
        </form>
      </div>
    </>
  );

  const top = (
    <>
      <Selectable id="__meta" label="이메일 정보">
        <div className="mb-3 space-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500" style={{ fontFamily: "var(--font-sans)" }}>
          <div className="flex gap-2">
            <span className="w-24 shrink-0">이메일 제목</span>
            <Editable edKey="__subject" single value={draft.subject} onChange={(v) => update({ subject: v.slice(0, 255) })} placeholder="이메일 제목을 입력하세요" className="flex-1 font-bold text-slate-800" />
          </div>
          <div className="flex gap-2">
            <span className="w-24 shrink-0">미리보기 문구</span>
            <Editable edKey="__preheader" single value={draft.preheader} onChange={(v) => update({ preheader: v.slice(0, 255) })} placeholder="받은편지함에서 제목 옆에 보이는 문장" className="flex-1" />
          </div>
        </div>
      </Selectable>
      <div style={{ background: t.header_bg, padding: `20px ${t.pad}`, borderRadius: `${t.radius} ${t.radius} 0 0` }}>
        {settings.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logo_url} alt={fromName} style={{ maxHeight: 36, maxWidth: 200 }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700, color: t.header_text }}>{fromName}</span>
        )}
      </div>
      <div style={{ height: 16 }} />
      {draft.greeting && (
        <div style={{ padding: `0 ${t.pad} 12px`, fontSize: 16, lineHeight: 1.7 }}>
          [수신자 이름]님 안녕하세요,<br />
          {fromName} 입니다.
        </div>
      )}
    </>
  );

  const bottom = (
    <div style={{ padding: `20px ${t.pad} 28px`, borderTop: "1px solid #e5e7eb", textAlign: "center", fontSize: 12, lineHeight: 1.6, color: t.muted, marginTop: 8 }}>
      {settings.footer_text.trim() && <p style={{ whiteSpace: "pre-line" }}>{settings.footer_text}</p>}
      더 이상 받지 않으려면 <u>수신거부</u>를 눌러 주세요.
      <p className="mt-2" style={{ fontFamily: "var(--font-sans)" }}>
        <Link href="/dashboard/newsletters/settings" className="text-indigo-600 hover:underline">발신 정보에서 머리글과 푸터 바꾸기</Link>
      </p>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/newsletters" className="text-sm text-slate-500 hover:underline">← 뉴스레터 목록</Link>
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            className="mt-1 block w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-bold hover:border-slate-200 focus:border-indigo-400 focus:outline-none"
            aria-label="관리용 제목"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={save} disabled={!!busy} className="btn-secondary">{dirty ? "저장" : "저장됨"}</button>
          <Link
            href={`/dashboard/newsletters/${newsletter.id}/send`}
            onClick={(e) => {
              if (dirty && !confirm("저장하지 않은 변경 사항이 있어요. 저장하지 않고 이동할까요?")) e.preventDefault();
            }}
            className="btn-primary"
          >
            발송하기 →
          </Link>
        </div>
      </div>

      {busy && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto w-fit rounded-full bg-slate-900 px-5 py-2 text-sm text-white shadow-lg">{busy}</div>
      )}
      {status && (
        <p className={`mb-4 rounded-lg px-4 py-2 text-sm ${status.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{status.text}</p>
      )}
      {!settings.from_name && (
        <p className="mb-4 text-xs text-amber-700">
          발신 정보가 비어 있어요. <Link href="/dashboard/newsletters/settings" className="underline">발신 정보</Link>에서 보내는 사람 이름과 푸터를 설정해 주세요.
        </p>
      )}

      <div className="rounded-2xl p-3 sm:p-6" style={{ background: t.page_bg }}>
        <VisualEditor
          blocks={draft.blocks}
          onChange={(blocks) => update({ blocks })}
          palette={PALETTE}
          labels={(b) => BLOCK_LABELS[b.type]}
          create={(type) => emptyBlock(type as BlockType)}
          selected={selected}
          onSelect={select}
          settings={aiSettings}
          settingsLabel="AI·설정"
          initialTab={draft.blocks.length ? "blocks" : "settings"}
          top={top}
          bottom={bottom}
          emptyText="왼쪽 'AI·설정'에서 AI로 만들거나, 요소를 끌어다 놓으세요."
          canvasClassName="mx-auto w-full max-w-[600px]"
          canvasStyle={{ background: t.body_bg, color: t.text, fontFamily: t.font, borderRadius: t.radius }}
          renderBlock={(b, _i, { ed, onImage }) => (
            <div style={{ padding: `0 ${t.pad} 12px` }}>
              <NewsletterBlockView b={b} t={t} ed={ed} onImage={onImage} />
            </div>
          )}
          renderTools={(b, change, openImage) => <BlockTools block={b} onChange={change} openImage={openImage} />}
          renderImage={(b, key, change) => <ImagePanel block={b} k={key} userId={userId} onChange={change} />}
        />
      </div>
    </div>
  );
}

function BlockTools({ block: b, onChange, openImage }: { block: Block; onChange: (patch: Partial<Block>) => void; openImage: (key: string) => void }) {
  switch (b.type) {
    case "hero":
    case "image":
      return <ToolBtn label="이미지 변경" onClick={() => openImage("main")}>🖼 이미지 변경</ToolBtn>;
    case "button":
      return <ToolInput value={b.button_url} onChange={(v) => onChange({ button_url: v.trim() })} placeholder="링크 https://" width={220} />;
    case "cards":
    case "thumbs":
      return (
        <>
          <ToolBtn label="항목 추가" onClick={() => b.items.length < 12 && onChange({ items: [...b.items, emptyItem()] })}>+ 항목</ToolBtn>
          <ToolBtn label="마지막 항목 삭제" onClick={() => b.items.length > 1 && onChange({ items: b.items.slice(0, -1) })}>− 항목</ToolBtn>
        </>
      );
  }
  return null;
}

function ImagePanel({ block: b, k, userId, onChange }: { block: Block; k: string; userId: string; onChange: (patch: Partial<Block>) => void }) {
  if (k === "main") {
    return (
      <ImageMenu
        userId={userId}
        value={b.image_url}
        context={[b.heading, b.image_keyword].filter(Boolean).join(", ")}
        ratio={b.type === "hero" ? "2:1" : "3:2"}
        onChange={(url) => onChange({ image_url: url })}
      />
    );
  }
  const i = Number(k);
  const it = b.items[i];
  if (!it) return null;
  const setItem = (patch: Partial<BlockItem>) => onChange({ items: b.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const moveItem = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= b.items.length) return;
    const items = [...b.items];
    [items[i], items[j]] = [items[j], items[i]];
    onChange({ items });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{it.title || `항목 ${i + 1}`}의 이미지</p>
      <ImageMenu
        userId={userId}
        value={it.image_url}
        context={[it.title, it.image_keyword].filter(Boolean).join(", ")}
        ratio="4:3"
        onMove={moveItem}
        moveLabels={["앞 항목으로", "뒤 항목으로"]}
        onChange={(url) => setItem({ image_url: url })}
      />
      <div>
        <label className="label">이 항목의 &lsquo;자세히 보기&rsquo; 링크</label>
        <input className="input" value={it.url} onChange={(e) => setItem({ url: e.target.value.trim() })} placeholder="https://" />
      </div>
    </div>
  );
}
