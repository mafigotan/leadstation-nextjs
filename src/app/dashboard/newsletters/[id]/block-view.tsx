"use client";

// The newsletter body as React, styled like the email HTML (lib/newsletter/render.ts), with inline editing.
import type { CSSProperties } from "react";
import type { Theme } from "@/lib/newsletter/render";
import type { Block } from "@/lib/newsletter/types";
import type { Ed } from "@/components/visual-editor";

function Ph({ height, label, onClick, width }: { height: number; label: string; onClick: () => void; width?: number }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ height, width, background: "#eef1f4", border: "1px dashed #c3c9d0", borderRadius: 6, color: "#8a94a0", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer" }}
      className="hover:outline hover:outline-2 hover:outline-violet-500"
    >
      {label}
    </div>
  );
}

function Img({ url, alt, style, onClick }: { url: string; alt: string; style: CSSProperties; onClick: () => void }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      style={{ display: "block", border: 0, cursor: "pointer", ...style }}
      className="hover:outline hover:outline-2 hover:outline-violet-500"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

export function NewsletterBlockView({ b, t, ed, onImage }: { b: Block; t: Theme; ed: Ed; onImage: (key: string) => void }) {
  const h: CSSProperties = { margin: "0 0 10px", fontFamily: t.head_font, color: t.text, lineHeight: 1.35 };
  const body: CSSProperties = { fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-line" };
  const image = (radius: string) =>
    !t.images ? null : b.image_url ? (
      <Img url={b.image_url} alt={b.heading} style={{ width: "100%", height: "auto", borderRadius: radius }} onClick={() => onImage("main")} />
    ) : (
      <Ph height={200} label="이미지 자리 (눌러서 이미지 넣기)" onClick={() => onImage("main")} />
    );
  const btnStyle = (): CSSProperties =>
    t.button === "outline"
      ? { border: `2px solid ${t.accent}`, color: t.accent, background: "#fff" }
      : { background: t.accent, color: "#fff", border: `2px solid ${t.accent}` };

  switch (b.type) {
    case "hero":
      return (
        <div>
          {image(t.radius === "0" ? "0" : "8px")}
          {ed("heading", b.heading, { as: "h1", single: true, placeholder: "대표 제목", style: { ...h, fontSize: t.h_size, marginTop: 16 } })}
          {ed("text", b.text, { placeholder: "도입 문장", style: body })}
        </div>
      );
    case "heading":
      return ed("heading", b.heading, { as: "h2", single: true, placeholder: "소제목", style: { ...h, fontSize: 20 } });
    case "text":
      return (
        <div>
          {ed("heading", b.heading, { as: "h3", single: true, placeholder: "제목 (선택, 비워 두면 표시 안 됨)", style: { ...h, fontSize: 17 } })}
          {ed("text", b.text, { placeholder: "본문 (빈 줄로 문단 구분)", style: body })}
        </div>
      );
    case "image":
      return (
        <div>
          {image("6px")}
          {ed("text", b.text, { single: true, placeholder: "이미지 설명 (선택)", style: { fontSize: 12, color: t.muted, marginTop: 6, textAlign: "center" } })}
        </div>
      );
    case "cards": {
      const cols = b.items.length >= 3 && b.items.length % 3 === 0 ? 3 : 2;
      const cardStyle: CSSProperties = t.card_bg === "#ffffff" ? { border: "1px solid #e5e7eb" } : { background: t.card_bg };
      return (
        <div>
          {ed("heading", b.heading, { as: "h2", single: true, placeholder: "제목 (선택)", style: { margin: "0 0 12px", fontFamily: t.head_font, fontSize: 20 } })}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 12 }}>
            {b.items.map((it, i) => (
              <div key={i} style={{ ...cardStyle, borderRadius: t.radius === "0" ? 0 : 8, padding: 14 }}>
                {t.images &&
                  (it.image_url ? (
                    <Img url={it.image_url} alt={it.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, marginBottom: 8 }} onClick={() => onImage(String(i))} />
                  ) : (
                    <div style={{ marginBottom: 8 }}>
                      <Ph height={110} label="이미지 자리" onClick={() => onImage(String(i))} />
                    </div>
                  ))}
                {ed(`items.${i}.title`, it.title, { single: true, placeholder: "제목", style: { fontWeight: 700, fontSize: 15, marginBottom: 4 } })}
                {ed(`items.${i}.text`, it.text, { placeholder: "설명", style: { fontSize: 13, lineHeight: 1.6, color: t.muted, whiteSpace: "pre-line" } })}
                {it.url && <div style={{ marginTop: 8, fontSize: 13, color: t.accent, fontWeight: 700 }}>자세히 보기 →</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "thumbs": {
      const btn: CSSProperties =
        t.button === "solid" ? { border: `1px solid ${t.accent}`, color: "#fff", background: t.accent } : { border: `1px solid ${t.accent}`, color: t.accent, background: "#fff" };
      return (
        <div>
          {ed("heading", b.heading, { as: "h2", single: true, placeholder: "제목 (선택)", style: { margin: "0 0 12px", fontFamily: t.head_font, color: t.text, fontSize: 20, lineHeight: 1.35 } })}
          {b.items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", paddingBottom: i < b.items.length - 1 ? 14 : 0 }}>
              {t.images &&
                (it.image_url ? (
                  <Img url={it.image_url} alt={it.title} style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} onClick={() => onImage(String(i))} />
                ) : (
                  <Ph width={120} height={90} label="이미지" onClick={() => onImage(String(i))} />
                ))}
              <div style={{ flex: 1, minWidth: 0 }}>
                {ed(`items.${i}.title`, it.title, { single: true, placeholder: "제목", style: { fontSize: 16, fontWeight: 700, lineHeight: 1.45, color: t.text, margin: "0 0 10px" } })}
                <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 4, fontSize: 13, fontWeight: 700, lineHeight: 1.4, ...btn }}>자세히 보기</span>
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "button":
      return t.button === "link" ? (
        <p style={{ margin: 0, color: t.accent, fontWeight: 700, fontSize: 15 }}>
          {ed("button_label", b.button_label, { as: "span", single: true, placeholder: "버튼 문구" })} →
        </p>
      ) : (
        <div style={{ textAlign: "center" }}>
          {ed("button_label", b.button_label, {
            as: "span",
            single: true,
            placeholder: "버튼 문구",
            style: { display: "inline-block", padding: "12px 26px", borderRadius: 6, fontSize: 15, fontWeight: 700, minWidth: 80, ...btnStyle() },
          })}
        </div>
      );
    case "divider":
      return <div style={{ borderTop: "1px solid #e5e7eb", height: 1, margin: "8px 0" }} />;
  }
}
