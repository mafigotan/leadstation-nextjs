"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { renderNewsletter } from "@/lib/newsletter/render";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  TEMPLATES,
  TONES,
  emptyBlock,
  emptyItem,
  newBlockId,
  type Block,
  type BlockItem,
  type BlockType,
  type Newsletter,
  type SenderSettings,
} from "@/lib/newsletter/types";
import { deleteNewsletter, duplicateNewsletter, generateWithAi, restorePrevious, saveNewsletter, sendTest } from "../actions";
import { ImageField } from "@/components/image-field";

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
  siteUrl,
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
  const updateBlock = (i: number, patch: Partial<Block>) =>
    update({ blocks: draft.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const updateItem = (bi: number, ii: number, patch: Partial<BlockItem>) =>
    updateBlock(bi, { items: draft.blocks[bi].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const moveBlock = (i: number, dir: -1 | 1) => {
    const blocks = [...draft.blocks];
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    update({ blocks });
  };

  const html = useMemo(
    () =>
      renderNewsletter(
        { ...draft, template: draft.template as Newsletter["template"] },
        settings,
        { preview: true, siteUrl },
      ),
    [draft, settings, siteUrl],
  );

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="card space-y-4 p-5">
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
              <textarea
                rows={2}
                value={draft.prompt}
                onChange={(e) => update({ prompt: e.target.value })}
                className="input"
                placeholder="예: 신제품 3개를 카드로 보여주고, 마지막에 구매 버튼을 넣어줘"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.greeting} onChange={(e) => update({ greeting: e.target.checked })} />
              수신자 이름 자동 입력 (본문 맨 위에 &quot;OOO님 안녕하세요&quot; 인사말)
            </label>
            <div className="flex flex-wrap gap-2">
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

          <section className="card space-y-4 p-5">
            <h2 className="font-semibold">이메일 정보</h2>
            <div>
              <label className="label">이메일 제목</label>
              <input value={draft.subject} onChange={(e) => update({ subject: e.target.value })} className="input" maxLength={255} />
            </div>
            <div>
              <label className="label">미리보기 문구 (받은편지함에서 제목 옆에 보이는 문장)</label>
              <input value={draft.preheader} onChange={(e) => update({ preheader: e.target.value })} className="input" maxLength={255} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">본문 블록</h2>
              <AddBlock onAdd={(t) => update({ blocks: [...draft.blocks, emptyBlock(t)] })} />
            </div>
            {draft.blocks.length === 0 && (
              <p className="card p-6 text-center text-sm text-slate-500">AI로 만들거나 블록을 직접 추가해 주세요.</p>
            )}
            {draft.blocks.map((b, i) => (
              <div key={b.id} className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{BLOCK_LABELS[b.type]}</span>
                  <div className="flex gap-1 text-sm">
                    <IconBtn label="위로" onClick={() => moveBlock(i, -1)}>↑</IconBtn>
                    <IconBtn label="아래로" onClick={() => moveBlock(i, 1)}>↓</IconBtn>
                    <IconBtn
                      label="복제"
                      onClick={() => {
                        const blocks = [...draft.blocks];
                        blocks.splice(i + 1, 0, { ...structuredClone(b), id: newBlockId() });
                        update({ blocks });
                      }}
                    >
                      ⧉
                    </IconBtn>
                    <IconBtn label="삭제" onClick={() => update({ blocks: draft.blocks.filter((_, j) => j !== i) })}>✕</IconBtn>
                  </div>
                </div>
                <BlockFields
                  block={b}
                  userId={userId}
                  onChange={(patch) => updateBlock(i, patch)}
                  onItem={(ii, patch) => updateItem(i, ii, patch)}
                />
              </div>
            ))}
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">테스트 메일</h2>
            <div className="flex gap-2">
              <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="input" placeholder="받을 이메일 (여러 개는 쉼표로)" />
              <button onClick={test} disabled={!!busy} className="btn-secondary shrink-0">보내기</button>
            </div>
          </section>

          <div className="flex gap-2 pt-2">
            <form action={duplicateNewsletter.bind(null, newsletter.id)}>
              <button className="btn-secondary">복제</button>
            </form>
            <form
              action={async () => {
                if (!confirm("이 뉴스레터와 발송 기록을 삭제할까요?")) return;
                const res = await deleteNewsletter(newsletter.id);
                if (res?.error) setStatus({ kind: "error", text: res.error });
              }}
            >
              <button className="btn-danger">삭제</button>
            </form>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
              <p className="truncate"><b className="text-slate-700">{draft.subject || "(제목 없음)"}</b> — {draft.preheader}</p>
            </div>
            <iframe title="미리보기" srcDoc={html} className="h-[75vh] w-full bg-white" sandbox="" />
          </div>
          {!settings.from_name && (
            <p className="mt-2 text-xs text-amber-700">
              발신 정보가 비어 있어요. <Link href="/dashboard/newsletters/settings" className="underline">발신 정보</Link>에서 보내는 사람 이름과 푸터를 설정해 주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="h-7 w-7 rounded hover:bg-slate-100">
      {children}
    </button>
  );
}

function AddBlock({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value as BlockType);
      }}
      className="input w-auto"
    >
      <option value="">+ 블록 추가</option>
      {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
    </select>
  );
}

function BlockFields({
  block: b,
  userId,
  onChange,
  onItem,
}: {
  block: Block;
  userId: string;
  onChange: (patch: Partial<Block>) => void;
  onItem: (i: number, patch: Partial<BlockItem>) => void;
}) {
  const hasHeading = b.type !== "divider" && b.type !== "button" && b.type !== "image";
  const hasText = b.type === "hero" || b.type === "text" || b.type === "image";
  const hasImage = b.type === "hero" || b.type === "image";
  return (
    <div className="space-y-3">
      {hasImage && <ImageField userId={userId} value={b.image_url} keyword={b.image_keyword} context={b.heading} ratio={b.type === "hero" ? "2:1" : "3:2"} onChange={(url) => onChange({ image_url: url })} />}
      {hasHeading && (
        <input value={b.heading} onChange={(e) => onChange({ heading: e.target.value })} className="input" placeholder={b.type === "hero" ? "대표 제목" : "제목"} />
      )}
      {hasText && (
        <textarea
          value={b.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={b.type === "image" ? 1 : 4}
          className="input"
          placeholder={b.type === "image" ? "이미지 설명 (선택)" : "본문 (빈 줄로 문단 구분)"}
        />
      )}
      {b.type === "button" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={b.button_label} onChange={(e) => onChange({ button_label: e.target.value })} className="input" placeholder="버튼 문구" />
          <input value={b.button_url} onChange={(e) => onChange({ button_url: e.target.value })} className="input" placeholder="https://링크" />
        </div>
      )}
      {(b.type === "cards" || b.type === "thumbs") && (
        <div className="space-y-3">
          {b.items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>항목 {i + 1}</span>
                <button type="button" className="text-red-600 hover:underline" onClick={() => onChange({ items: b.items.filter((_, j) => j !== i) })}>
                  삭제
                </button>
              </div>
              <ImageField userId={userId} value={it.image_url} keyword={it.image_keyword} context={it.title} ratio="4:3" onChange={(url) => onItem(i, { image_url: url })} compact />
              <input value={it.title} onChange={(e) => onItem(i, { title: e.target.value })} className="input" placeholder="제목" />
              {b.type === "cards" && (
                <textarea value={it.text} onChange={(e) => onItem(i, { text: e.target.value })} rows={2} className="input" placeholder="설명" />
              )}
              <input value={it.url} onChange={(e) => onItem(i, { url: e.target.value })} className="input" placeholder="자세히 보기 링크 https://" />
            </div>
          ))}
          {b.items.length < 12 && (
            <button type="button" className="btn-secondary w-full" onClick={() => onChange({ items: [...b.items, emptyItem()] })}>
              + 항목 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}
