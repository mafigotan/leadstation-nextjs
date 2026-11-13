"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_RATIOS, IMAGE_STYLES, type ImageRatio } from "@/lib/images/options";
import { generateAiImage, recordUpload } from "@/app/dashboard/media/actions";
import { MediaPicker } from "./media-picker";

const STYLE_KEY = "ls-ai-image-style";

/** Small box with the ratio's shape, for the ratio buttons. */
export function RatioShape({ ratio }: { ratio: ImageRatio }) {
  const [, w, h] = IMAGE_RATIOS[ratio];
  const scale = 16 / Math.max(w, h);
  return <span className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: Math.max(5, w * scale), height: Math.max(5, h * scale) }} />;
}

/** Style and ratio pickers plus the description box. Used by the image field and the library page. */
export function AiImageForm({
  initialText = "",
  initialRatio = "1:1",
  onDone,
}: {
  initialText?: string;
  initialRatio?: ImageRatio;
  onDone: (url: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [style, setStyle] = useState<string>(() => {
    try {
      return localStorage.getItem(STYLE_KEY) || "photo";
    } catch {
      return "photo";
    }
  });
  const [ratio, setRatio] = useState<ImageRatio>(initialRatio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setBusy(true);
    try {
      localStorage.setItem(STYLE_KEY, style);
    } catch {}
    const res = await generateAiImage(text, style, ratio);
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.url) onDone(res.url);
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="input"
        placeholder="어떤 이미지를 만들지 적어 주세요. 예: 눈 내리는 창가의 따뜻한 머그컵과 담요"
      />
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">스타일</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(IMAGE_STYLES).map(([k, [label]]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStyle(k)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${style === k ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">비율</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(IMAGE_RATIOS) as ImageRatio[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRatio(k)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${ratio === k ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              <RatioShape ratio={k} /> {IMAGE_RATIOS[k][0]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={generate} disabled={busy || !text.trim()} className="btn-primary">
          {busy ? "그리는 중… (최대 1분)" : "✦ 이미지 만들기"}
        </button>
        <span className="text-xs text-slate-500">만든 이미지는 이미지 라이브러리에도 저장돼요.</span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export async function uploadToLibrary(userId: string, file: File): Promise<{ url?: string; error?: string }> {
  if (!file.type.startsWith("image/")) return { error: "이미지 파일만 올릴 수 있어요." };
  if (file.size > 5 * 1024 * 1024) return { error: "5MB 이하 이미지만 올릴 수 있어요." };
  let width: number | null = null;
  let height: number | null = null;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {}
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("newsletter-images").upload(path, file, { contentType: file.type });
  if (error) return { error: "업로드하지 못했어요: " + error.message };
  const url = supabase.storage.from("newsletter-images").getPublicUrl(path).data.publicUrl;
  await recordUpload(url, path, width, height);
  return { url };
}

export function ImageField({
  userId,
  value,
  keyword = "",
  onChange,
  compact,
  context = "",
  ratio,
}: {
  userId: string;
  value: string;
  keyword?: string;
  onChange: (url: string) => void;
  compact?: boolean;
  context?: string;
  /** Default ratio in the AI panel. */
  ratio?: ImageRatio;
}) {
  const [panel, setPanel] = useState<"" | "ai" | "library">("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    const r = await uploadToLibrary(userId, file);
    setUploading(false);
    if (r.error) setError(r.error);
    else if (r.url) onChange(r.url);
  }

  const thumb = compact ? "h-12 w-16" : "h-16 w-24";
  const toggle = (p: "ai" | "library") => {
    setError("");
    setPanel((cur) => (cur === p ? "" : p));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={`${thumb} shrink-0 rounded object-cover`} />
        ) : (
          <div className={`${thumb} flex shrink-0 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400`}>이미지 없음</div>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="input min-w-0 flex-1"
          placeholder={keyword ? `이미지 주소 https:// (추천 키워드: ${keyword})` : "이미지 주소 https://"}
        />
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary px-3">
            {uploading ? "…" : "업로드"}
          </button>
          <button type="button" onClick={() => toggle("library")} className={`btn-secondary px-3 ${panel === "library" ? "bg-slate-100" : ""}`}>
            라이브러리
          </button>
          <button type="button" onClick={() => toggle("ai")} className={`btn-secondary px-3 text-violet-700 ${panel === "ai" ? "bg-violet-50" : ""}`}>
            ✦ AI 생성
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="btn-secondary px-2 text-slate-500" title="이미지 빼기">
              ✕
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {panel === "ai" && (
        <AiImageForm
          initialText={[context, keyword].filter(Boolean).join(", ")}
          initialRatio={ratio ?? (compact ? "1:1" : "3:2")}
          onDone={(url) => {
            onChange(url);
            setPanel("");
          }}
        />
      )}
      {panel === "library" && (
        <MediaPicker
          onPick={(url) => {
            onChange(url);
            setPanel("");
          }}
          onClose={() => setPanel("")}
        />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Menu shown when an image in the draft is clicked:
 * find in library, generate with AI, upload, remove, and move.
 */
export function ImageMenu({
  userId,
  value,
  onChange,
  context = "",
  ratio = "3:2",
  onMove,
  moveLabels = ["위로", "아래로"],
  alt,
  onAlt,
}: {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  context?: string;
  ratio?: ImageRatio;
  onMove?: (d: -1 | 1) => void;
  moveLabels?: [string, string];
  alt?: string;
  onAlt?: (v: string) => void;
}) {
  const [panel, setPanel] = useState<"" | "ai" | "library" | "url">(value ? "" : "ai");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    const r = await uploadToLibrary(userId, file);
    setUploading(false);
    if (r.error) setError(r.error);
    else if (r.url) onChange(r.url);
  }

  const btn = (on: boolean) =>
    `flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium ${on ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="mr-1 h-10 w-14 rounded object-cover" />
        ) : (
          <span className="mr-1 text-xs text-slate-500">이미지가 비어 있어요.</span>
        )}
        <button type="button" className={btn(panel === "library")} onClick={() => setPanel(panel === "library" ? "" : "library")}>🖼 라이브러리에서 찾기</button>
        <button type="button" className={`${btn(panel === "ai")} text-violet-700`} onClick={() => setPanel(panel === "ai" ? "" : "ai")}>✦ AI로 생성</button>
        <button type="button" className={btn(false)} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "올리는 중…" : "⬆ 업로드"}</button>
        <button type="button" className={btn(panel === "url")} onClick={() => setPanel(panel === "url" ? "" : "url")}>🔗 주소</button>
        {onMove && (
          <>
            <button type="button" className={btn(false)} onClick={() => onMove(-1)}>↑ {moveLabels[0]}</button>
            <button type="button" className={btn(false)} onClick={() => onMove(1)}>↓ {moveLabels[1]}</button>
          </>
        )}
        {value && (
          <button type="button" className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50" onClick={() => onChange("")}>
            🗑 이미지 삭제
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {panel === "ai" && <AiImageForm initialText={context} initialRatio={ratio} onDone={(url) => { onChange(url); setPanel(""); }} />}
      {panel === "library" && <MediaPicker onPick={(url) => { onChange(url); setPanel(""); }} onClose={() => setPanel("")} />}
      {panel === "url" && <input className="input" value={value} placeholder="https://" onChange={(e) => onChange(e.target.value.trim())} />}
      {onAlt && <input className="input" value={alt ?? ""} onChange={(e) => onAlt(e.target.value)} placeholder="이미지 설명 (alt 텍스트, 검색과 접근성에 쓰여요)" />}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
