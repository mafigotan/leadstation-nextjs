"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateAiImage } from "../actions";

const STYLES = [
  ["photo", "사진"],
  ["illustration", "일러스트"],
  ["cartoon", "만화"],
  ["infographic", "인포그래픽"],
] as const;
const STYLE_KEY = "ls-ai-image-style";

export function ImageField({
  userId,
  value,
  keyword,
  onChange,
  compact,
  context = "",
}: {
  userId: string;
  value: string;
  keyword: string;
  onChange: (url: string) => void;
  compact?: boolean;
  context?: string;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiStyle, setAiStyle] = useState("photo");
  const [generating, setGenerating] = useState(false);

  function openAi() {
    setError("");
    setAiText((t) => t || [context, keyword].filter(Boolean).join(", "));
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (saved) setAiStyle(saved);
    } catch {}
    setAiOpen((o) => !o);
  }

  async function generate() {
    setError("");
    setGenerating(true);
    try {
      localStorage.setItem(STYLE_KEY, aiStyle);
    } catch {}
    const res = await generateAiImage(aiText, aiStyle, !compact);
    setGenerating(false);
    if ("error" in res && res.error) return setError(res.error);
    if ("url" in res && res.url) {
      onChange(res.url);
      setAiOpen(false);
    }
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) return setError("이미지 파일만 올릴 수 있어요.");
    if (file.size > 5 * 1024 * 1024) return setError("5MB 이하 이미지만 올릴 수 있어요.");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const supabase = createClient();
    const { error: upErr } = await supabase.storage.from("newsletter-images").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (upErr) return setError("업로드하지 못했어요: " + upErr.message);
    onChange(supabase.storage.from("newsletter-images").getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={`${compact ? "h-12 w-16" : "h-16 w-24"} shrink-0 rounded object-cover`} />
        ) : (
          <div className={`${compact ? "h-12 w-16" : "h-16 w-24"} flex shrink-0 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400`}>
            이미지 없음
          </div>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="input"
          placeholder={keyword ? `이미지 주소 https:// (추천 키워드: ${keyword})` : "이미지 주소 https://"}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary shrink-0 px-3">
          {uploading ? "..." : "업로드"}
        </button>
        <button type="button" onClick={openAi} disabled={generating} className="btn-secondary shrink-0 px-3">
          AI로 생성
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {aiOpen && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            rows={2}
            className="input"
            placeholder="어떤 이미지를 만들지 설명해 주세요. 예: 눈 내리는 창가의 따뜻한 머그컵과 담요"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={aiStyle} onChange={(e) => setAiStyle(e.target.value)} className="input w-auto py-1">
              {STYLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" onClick={generate} disabled={generating || !aiText.trim()} className="btn-primary py-1.5">
              {generating ? "그리는 중... (최대 1분)" : "이미지 만들기"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
