"use client";

import { useEffect, useRef, useState } from "react";
import { discardAiDrafts, editAiImage, saveAiImage, type AiDraft } from "@/app/dashboard/media/actions";

/** One image in an editing session: the first one or a result of an edit. */
export type ImageVersion = {
  url: string;
  /** Storage path of a draft that is not in the library yet. Missing for an image already in the library. */
  draftPath?: string;
  width: number | null;
  height: number | null;
  /** The description and the edits that led to this image, kept with it in the library. */
  prompt: string;
  style?: string;
  ratio?: string;
};

export function draftVersion(d: AiDraft, prompt: string, style?: string, ratio?: string): ImageVersion {
  return { url: d.url, draftPath: d.path, width: d.width, height: d.height, prompt, style, ratio };
}

const isAppImage = (url: string) => url.includes("/storage/v1/object/public/newsletter-images/");

/**
 * Shows the images of a session, lets the user edit the selected one with an instruction
 * as many times as they like (each edit starts from the selected image), and keeps the one they pick.
 * Only the kept image goes into the library; the other drafts are deleted.
 */
export function AiImageEditor({
  versions,
  setVersions,
  style = "",
  ratio = "",
  doneLabel = "초안에 반영",
  allowOriginal = true,
  onDone,
  onCancel,
}: {
  versions: ImageVersion[];
  setVersions: (fn: (v: ImageVersion[]) => ImageVersion[]) => void;
  style?: string;
  ratio?: string;
  doneLabel?: string;
  /** false: the done button needs an edited image (the original is already in the library). */
  allowOriginal?: boolean;
  onDone: (url: string) => void;
  onCancel?: () => void;
}) {
  const [index, setIndex] = useState(versions.length - 1);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"" | "edit" | "save">("");
  const [error, setError] = useState("");
  const count = useRef(versions.length);

  // A new image was added (generated again or edited): show it.
  useEffect(() => {
    if (versions.length > count.current) setIndex(versions.length - 1);
    count.current = versions.length;
  }, [versions.length]);

  // Drafts still unsaved when the editor goes away (closed panel, left the page) are deleted.
  const live = useRef(versions);
  live.current = versions;
  const finished = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Deferred so a dev-mode remount (React strict mode) does not delete the drafts.
      setTimeout(() => {
        if (mounted.current || finished.current) return;
        const paths = live.current.map((v) => v.draftPath).filter((p): p is string => !!p);
        if (paths.length) discardAiDrafts(paths).catch(() => {});
      }, 0);
    };
  }, []);

  const current = versions[Math.min(index, versions.length - 1)];
  if (!current) return null;
  const canEdit = isAppImage(current.url);

  async function edit() {
    setError("");
    setBusy("edit");
    const ask = instruction.trim();
    const res = await editAiImage(current.url, ask, current.width, current.height).catch(() => ({ error: "이미지를 수정하지 못했어요.", draft: undefined }));
    setBusy("");
    if (res.error || !res.draft) return setError(res.error ?? "이미지를 수정하지 못했어요.");
    const next = draftVersion(res.draft, `${current.prompt}${current.prompt ? "\n" : ""}수정: ${ask}`.trim(), current.style, current.ratio);
    setVersions((v) => [...v, next]);
    setInstruction("");
  }

  async function done() {
    setError("");
    let url = current.url;
    if (current.draftPath) {
      setBusy("save");
      const res = await saveAiImage({ path: current.draftPath, prompt: current.prompt, style: current.style ?? style, ratio: current.ratio ?? ratio, width: current.width, height: current.height }).catch(() => ({ error: "라이브러리에 저장하지 못했어요.", url: undefined }));
      setBusy("");
      if (res.error || !res.url) return setError(res.error ?? "라이브러리에 저장하지 못했어요.");
      url = res.url;
    }
    finished.current = true;
    const others = versions.map((v) => v.draftPath).filter((p): p is string => !!p && p !== current.draftPath);
    if (others.length) discardAiDrafts(others).catch(() => {});
    onDone(url);
  }

  function cancel() {
    finished.current = true;
    const paths = versions.map((v) => v.draftPath).filter((p): p is string => !!p);
    if (paths.length) discardAiDrafts(paths).catch(() => {});
    onCancel?.();
  }


  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-white p-3">
      <div className="flex justify-center rounded-md bg-slate-100 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt=""
          className="max-h-80 rounded object-contain"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h && (!current.width || !current.height)) {
              setVersions((vs) => vs.map((v) => (v.url === current.url ? { ...v, width: w, height: h } : v)));
            }
          }}
        />
      </div>

      {versions.length > 1 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">버전 ({versions.length}) · 고른 버전을 기준으로 수정하거나 반영해요</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {versions.map((v, i) => (
              <button
                key={v.url}
                type="button"
                onClick={() => setIndex(i)}
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 ${i === index ? "border-violet-600" : "border-transparent hover:border-slate-300"}`}
                title={v.prompt}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.url} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 text-[10px] text-white">{v.draftPath ? i + 1 : "원본"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {canEdit ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">이 이미지를 이렇게 고쳐 주세요</p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            className="input"
            placeholder="예: 배경을 노을 지는 하늘로 바꿔 주세요 / 머그컵 색을 빨간색으로 / 전체를 더 밝게"
            disabled={!!busy}
          />
          <p className="mt-1 text-[11px] text-slate-500">지금 보이는 이미지를 바탕으로 말한 부분만 고쳐요. 마음에 들 때까지 몇 번이든 고칠 수 있어요.</p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">외부 주소의 이미지는 AI로 수정할 수 없어요. 라이브러리에 올린 뒤 수정해 주세요.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button type="button" onClick={edit} disabled={!!busy || !instruction.trim()} className="btn-secondary text-violet-700">
            {busy === "edit" ? "고치는 중… (최대 1분)" : "✦ 수정하기"}
          </button>
        )}
        <button type="button" onClick={done} disabled={!!busy || (!allowOriginal && !current.draftPath)} className="btn-primary">
          {busy === "save" ? "저장하는 중…" : doneLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={cancel} disabled={!!busy} className="btn-secondary">
            취소
          </button>
        )}
        <span className="text-xs text-slate-500">
          {current.draftPath ? `‘${doneLabel}’을 누르면 고른 이미지만 이미지 라이브러리에 저장돼요.` : "원본은 그대로 두고, 수정한 이미지는 새 이미지로 저장돼요."}
        </span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
