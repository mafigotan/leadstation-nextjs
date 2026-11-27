"use client";

import { useRef, useState } from "react";
import { AiImageForm, uploadToLibrary } from "@/components/image-field";
import { AiImageEditor, type ImageVersion } from "@/components/ai-image-editor";
import { deleteMedia, listMedia, type MediaItem } from "./actions";

export function MediaLibrary({ userId, initial }: { userId: string; initial: MediaItem[] }) {
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length === 60);
  const [showAi, setShowAi] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [editing, setEditing] = useState<ImageVersion[] | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setItems(await listMedia(Math.max(60, items.length + 1)));

  async function upload(files: FileList) {
    setError("");
    setUploading(true);
    for (const f of Array.from(files)) {
      const r = await uploadToLibrary(userId, f);
      if (r.error) setError(r.error);
    }
    setUploading(false);
    await refresh();
  }

  async function remove(m: MediaItem) {
    if (!confirm("이 이미지를 삭제할까요? 이 이미지를 쓰는 글이나 뉴스레터에서는 이미지가 보이지 않게 돼요.")) return;
    const r = await deleteMedia(m.id);
    if (r.error) return setError(r.error);
    setItems(items.filter((x) => x.id !== m.id));
    setSelected(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">이미지 라이브러리</h1>
          <p className="mt-1 text-sm text-slate-500">저장한 이미지가 모두 여기에 모여요. 이미지를 눌러 &lsquo;AI로 수정&rsquo;하면 그 이미지를 바탕으로 고칠 수 있어요.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "올리는 중…" : "업로드"}</button>
          <button className="btn-primary" onClick={() => setShowAi((v) => !v)}>✦ AI로 만들기</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && upload(e.target.files)} />
        </div>
      </div>

      {showAi && (
        <div className="mb-6">
          <AiImageForm
            doneLabel="라이브러리에 저장"
            onDone={async () => {
              setShowAi(false);
              await refresh();
            }}
          />
        </div>
      )}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {savedMsg && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{savedMsg}</p>}

      {items.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">아직 이미지가 없어요.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <button key={m.id} onClick={() => { setSelected(m); setEditing(null); setSavedMsg(""); setCopied(false); }} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 ring-indigo-500 hover:ring-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{m.source === "ai" ? `AI · ${m.ratio}` : "업로드"}</span>
            </button>
          ))}
        </div>
      )}
      {more && (
        <button
          className="btn-secondary mt-6 w-full"
          onClick={async () => {
            const r = await listMedia(60, items[items.length - 1]?.created_at);
            setItems([...items, ...r]);
            setMore(r.length === 60);
          }}
        >
          더 보기
        </button>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !editing && setSelected(null)}>
          <div className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <div>
                <h2 className="mb-2 text-lg font-bold">AI로 이미지 수정</h2>
                <AiImageEditor
                  versions={editing}
                  setVersions={(fn) => setEditing((v) => fn(v ?? []))}
                  style={selected.style}
                  ratio={selected.ratio}
                  doneLabel="라이브러리에 저장"
                  allowOriginal={false}
                  onDone={async () => {
                    setEditing(null);
                    setSelected(null);
                    setSavedMsg("수정한 이미지를 라이브러리에 새로 저장했어요. 원본은 그대로 있어요.");
                    await refresh();
                  }}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt="" className="mx-auto max-h-[60vh] rounded-lg" />
            <div className="mt-4 space-y-1 text-sm text-slate-600">
              {selected.prompt && <p><b>설명:</b> {selected.prompt}</p>}
              <p>
                {selected.source === "ai" ? "AI 생성" : "업로드"}
                {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ""}
                {" · "}
                {new Date(selected.created_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" })}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                onClick={() => navigator.clipboard.writeText(selected.url).then(() => setCopied(true))}
              >
                {copied ? "복사했어요" : "이미지 주소 복사"}
              </button>
              <a className="btn-secondary" href={selected.url} target="_blank" download>원본 열기</a>
              <button
                className="btn-primary"
                onClick={() => setEditing([{ url: selected.url, width: selected.width, height: selected.height, prompt: selected.prompt, style: selected.style, ratio: selected.ratio }])}
              >
                ✎ AI로 수정
              </button>
              <button className="btn-danger" onClick={() => remove(selected)}>삭제</button>
              <button className="btn-secondary ml-auto" onClick={() => setSelected(null)}>닫기</button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
