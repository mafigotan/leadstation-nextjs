"use client";

import { useEffect, useState } from "react";
import { listMedia, type MediaItem } from "@/app/dashboard/media/actions";

/** Inline grid of the user's library images; click one to use it. */
export function MediaPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [more, setMore] = useState(true);

  useEffect(() => {
    listMedia(24).then((r) => {
      setItems(r);
      setMore(r.length === 24);
    });
  }, []);

  async function loadMore() {
    if (!items?.length) return;
    const r = await listMedia(24, items[items.length - 1].created_at);
    setItems([...items, ...r]);
    setMore(r.length === 24);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">이미지 라이브러리</p>
        <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:underline">닫기</button>
      </div>
      {items === null ? (
        <p className="py-6 text-center text-xs text-slate-400">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">아직 저장된 이미지가 없어요. 업로드하거나 AI로 만들면 여기에 모여요.</p>
      ) : (
        <>
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-6">
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m.url)}
                title={m.prompt || "업로드한 이미지"}
                className="group relative aspect-square overflow-hidden rounded-md bg-white ring-violet-500 hover:ring-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                {m.ratio && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">{m.ratio}</span>}
              </button>
            ))}
          </div>
          {more && (
            <button type="button" onClick={loadMore} className="mt-2 w-full text-xs font-medium text-indigo-600 hover:underline">더 보기</button>
          )}
        </>
      )}
    </div>
  );
}
