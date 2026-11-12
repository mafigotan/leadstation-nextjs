"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ImageField({
  userId,
  value,
  keyword,
  onChange,
  compact,
}: {
  userId: string;
  value: string;
  keyword: string;
  onChange: (url: string) => void;
  compact?: boolean;
}) {
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
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
