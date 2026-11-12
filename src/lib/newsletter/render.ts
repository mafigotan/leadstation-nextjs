// Renders a newsletter as email-safe HTML (tables + inline styles). Pure function: used for the
// editor preview in the browser and for the HTML that is actually sent.
import type { Block, BlockItem, SenderSettings, Template } from "./types";

export const UNSUB_PLACEHOLDER = "%%LS_UNSUBSCRIBE_URL%%";
export const GREETING_PLACEHOLDER = "%%LS_GREETING%%";

type Theme = {
  accent: string;
  page_bg: string;
  body_bg: string;
  text: string;
  muted: string;
  font: string;
  head_font: string;
  radius: string;
  card_bg: string;
  header_bg: string;
  header_text: string;
  button: "solid" | "outline" | "link";
  images: boolean;
  pad: string;
  h_size: string;
};

function theme(template: Template, accentColor: string): Theme {
  const accent = /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#2f5d8a";
  const font = "'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Arial,sans-serif";
  const base: Theme = {
    accent,
    page_bg: "#f1f3f5",
    body_bg: "#ffffff",
    text: "#2b2f33",
    muted: "#6b7280",
    font,
    head_font: font,
    radius: "12px",
    card_bg: "#f6f7f9",
    header_bg: "#ffffff",
    header_text: "#2b2f33",
    button: "solid",
    images: true,
    pad: "5%",
    h_size: "24px",
  };
  switch (template) {
    case "modern":
      return { ...base, page_bg: "#e9ecef", radius: "0", header_bg: accent, header_text: "#ffffff", card_bg: "#ffffff", h_size: "28px" };
    case "minimal":
      return { ...base, page_bg: "#ffffff", radius: "0", card_bg: "#ffffff", head_font: "Georgia,'Nanum Myeongjo','바탕',serif", button: "outline", pad: "4%" };
    case "text":
      return { ...base, page_bg: "#ffffff", radius: "0", card_bg: "#ffffff", button: "link", images: false, pad: "4%", h_size: "22px" };
    default:
      return base;
  }
}

export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? esc(u) : "#";
}

function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p style="margin:0 0 12px;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function placeholder(height: string, label: string, keyword: string) {
  return `<div style="height:${height};background:#eef1f4;border:1px dashed #c3c9d0;border-radius:6px;color:#8a94a0;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;"><span>${esc(label)}</span>${keyword ? `<small>키워드: ${esc(keyword)}</small>` : ""}</div>`;
}

export function greetingLine(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n ? `${n}님 안녕하세요,` : "안녕하세요,";
}

function image(b: { image_url: string; image_keyword: string; heading?: string }, t: Theme, preview: boolean, style: string) {
  if (!t.images) return "";
  if (b.image_url) {
    return `<img src="${escUrl(b.image_url)}" alt="${esc(b.heading ?? "")}" width="100%" style="display:block;width:100%;height:auto;border:0;${style}">`;
  }
  return preview ? placeholder("200px", "이미지 자리", b.image_keyword) : "";
}

function button(b: Block, t: Theme, siteUrl: string) {
  const label = b.button_label || "자세히 보기";
  const url = b.button_url || siteUrl;
  if (t.button === "link") {
    return `<p style="margin:0;"><a href="${escUrl(url)}" style="color:${t.accent};font-weight:700;font-size:15px;">${esc(label)} →</a></p>`;
  }
  const style =
    t.button === "outline"
      ? `border:2px solid ${t.accent};color:${t.accent};background:#ffffff;`
      : `background:${t.accent};color:#ffffff;border:2px solid ${t.accent};`;
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;"><a href="${escUrl(url)}" style="display:inline-block;padding:12px 26px;border-radius:6px;font-size:15px;font-weight:700;text-decoration:none;${style}">${esc(label)}</a></td></tr></table>`;
}

function cards(b: Block, t: Theme, preview: boolean) {
  const items = b.items;
  if (!items.length) return "";
  const cols = items.length >= 3 && items.length % 3 === 0 ? 3 : 2;
  const width = Math.floor(100 / cols);
  let html = b.heading ? `<h2 style="margin:0 0 12px;font-family:${t.head_font};font-size:20px;">${esc(b.heading)}</h2>` : "";
  html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
  for (let r = 0; r < items.length; r += cols) {
    html += "<tr>";
    for (const it of items.slice(r, r + cols)) {
      let cell = "";
      if (t.images) {
        cell += it.image_url
          ? `<img src="${escUrl(it.image_url)}" alt="${esc(it.title)}" width="100%" style="display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border:0;border-radius:6px;margin-bottom:8px;">`
          : preview
            ? `<div style="margin-bottom:8px;">${placeholder("110px", "이미지 자리", it.image_keyword)}</div>`
            : "";
      }
      cell += `<div style="font-weight:700;font-size:15px;margin-bottom:4px;">${esc(it.title)}</div>`;
      cell += `<div style="font-size:13px;line-height:1.6;color:${t.muted};">${paragraphs(it.text)}</div>`;
      if (it.url) {
        cell += `<div style="margin-top:8px;"><a href="${escUrl(it.url)}" style="font-size:13px;color:${t.accent};font-weight:700;text-decoration:none;">자세히 보기 →</a></div>`;
      }
      const cardStyle = t.card_bg === "#ffffff" ? "border:1px solid #e5e7eb;" : `background:${t.card_bg};`;
      html += `<td class="ls-col" width="${width}%" valign="top" style="padding:6px;"><div style="${cardStyle}border-radius:${t.radius === "0" ? "0" : "8px"};padding:14px;">${cell}</div></td>`;
    }
    html += "</tr>";
  }
  return html + "</table>";
}

function thumbs(b: Block, t: Theme, preview: boolean, siteUrl: string) {
  const items = b.items;
  if (!items.length) return "";
  let html = b.heading
    ? `<h2 style="margin:0 0 12px;font-family:${t.head_font};color:${t.text};font-size:20px;line-height:1.35;">${esc(b.heading)}</h2>`
    : "";
  const btn =
    t.button === "solid"
      ? `border:1px solid ${t.accent};color:#ffffff;background:${t.accent};`
      : `border:1px solid ${t.accent};color:${t.accent};background:#ffffff;`;
  html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
  items.forEach((it: BlockItem, i) => {
    const pad = i < items.length - 1 ? "padding:0 0 14px 0;" : "padding:0;";
    html += "<tr>";
    if (t.images) {
      const img = it.image_url
        ? `<img src="${escUrl(it.image_url)}" alt="${esc(it.title)}" width="120" height="90" style="display:block;width:120px;height:90px;object-fit:cover;border:0;border-radius:6px;">`
        : preview
          ? `<div style="width:120px;">${placeholder("90px", "이미지", "")}</div>`
          : "";
      html += `<td width="120" valign="top" style="width:120px;${pad}">${img}</td><td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>`;
    }
    html += `<td valign="middle" style="${pad}"><div style="font-size:16px;font-weight:700;line-height:1.45;color:${t.text};margin:0 0 10px;">${esc(it.title)}</div><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;"><a href="${escUrl(it.url || siteUrl)}" style="display:inline-block;padding:6px 14px;border-radius:4px;font-size:13px;font-weight:700;line-height:1.4;text-decoration:none;${btn}">자세히 보기</a></td></tr></table></td></tr>`;
  });
  return html + "</table>";
}

function renderBlock(b: Block, t: Theme, preview: boolean, siteUrl: string): string {
  const h = `margin:0 0 10px;font-family:${t.head_font};color:${t.text};line-height:1.35;`;
  switch (b.type) {
    case "hero": {
      let html = image(b, t, preview, `border-radius:${t.radius === "0" ? "0" : "8px"};`);
      if (b.heading) html += `<h1 style="${h}font-size:${t.h_size};margin-top:16px;">${esc(b.heading)}</h1>`;
      if (b.text) html += `<div style="font-size:15px;line-height:1.7;">${paragraphs(b.text)}</div>`;
      return html;
    }
    case "heading":
      return b.heading ? `<h2 style="${h}font-size:20px;">${esc(b.heading)}</h2>` : "";
    case "text": {
      const head = b.heading ? `<h3 style="${h}font-size:17px;">${esc(b.heading)}</h3>` : "";
      return head + `<div style="font-size:15px;line-height:1.7;">${paragraphs(b.text)}</div>`;
    }
    case "image": {
      let html = image(b, t, preview, "border-radius:6px;");
      if (html && b.text) html += `<div style="font-size:12px;color:${t.muted};margin-top:6px;text-align:center;">${esc(b.text)}</div>`;
      return html;
    }
    case "cards":
      return cards(b, t, preview);
    case "thumbs":
      return thumbs(b, t, preview, siteUrl);
    case "button":
      return button(b, t, siteUrl);
    case "divider":
      return '<div style="border-top:1px solid #e5e7eb;height:1px;line-height:1px;font-size:0;">&nbsp;</div>';
  }
}

export type RenderInput = {
  subject: string;
  preheader: string;
  template: Template;
  greeting: boolean;
  blocks: Block[];
};

export type RenderOptions = {
  /** Editor preview: shows image placeholders and a sample greeting. */
  preview?: boolean;
  /** For sending: leave per-recipient placeholders for greeting and unsubscribe link. */
  placeholders?: boolean;
  siteUrl: string;
};

export function renderNewsletter(nl: RenderInput, settings: SenderSettings, opts: RenderOptions): string {
  const t = theme(nl.template, settings.accent_color);
  const preview = !!opts.preview;
  const fromName = settings.from_name || "LEADstation";

  let body = "";
  for (const block of nl.blocks) {
    const inner = renderBlock(block, t, preview, opts.siteUrl);
    if (inner) body += `<tr><td style="padding:0 ${t.pad} 20px ${t.pad};">${inner}</td></tr>`;
  }
  if (nl.greeting) {
    const line = opts.placeholders ? GREETING_PLACEHOLDER : esc(greetingLine(preview ? "[수신자 이름]" : ""));
    body =
      `<tr><td style="padding:0 ${t.pad} 20px ${t.pad};"><div style="font-size:16px;line-height:1.7;color:${t.text};margin:0;">${line}<br>${esc(fromName)} 입니다.</div></td></tr>` +
      body;
  }
  if (!body && preview) {
    body = `<tr><td style="padding:48px ${t.pad};text-align:center;color:${t.muted};font-size:14px;">왼쪽에서 이메일 내용을 입력하고 'AI로 뉴스레터 만들기'를 눌러 주세요.</td></tr>`;
  }

  const brand = settings.logo_url
    ? `<img src="${escUrl(settings.logo_url)}" alt="${esc(fromName)}" style="max-height:36px;max-width:200px;display:block;border:0;">`
    : `<span style="font-size:16px;font-weight:700;color:${t.header_text};">${esc(fromName)}</span>`;
  const header =
    `<tr><td style="background:${t.header_bg};padding:20px ${t.pad};border-radius:${t.radius} ${t.radius} 0 0;">${brand}</td></tr>` +
    '<tr><td style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr>';

  const unsubHref = opts.placeholders ? UNSUB_PLACEHOLDER : "#";
  let footer = `<tr><td style="padding:20px ${t.pad} 28px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;line-height:1.6;color:${t.muted};">`;
  if (settings.footer_text.trim()) footer += esc(settings.footer_text).replace(/\n/g, "<br>") + "<br>";
  footer += `더 이상 받지 않으려면 <a href="${unsubHref}" style="color:${t.muted};text-decoration:underline;">수신거부</a>를 눌러 주세요.</td></tr>`;

  return (
    '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${esc(nl.subject)}</title>` +
    "<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%;text-size-adjust:100%;}img{max-width:100%;height:auto;}@media (max-width:620px){.ls-outer{padding:8px 4px!important;}.ls-col{display:block!important;width:100%!important;}}</style></head>" +
    `<body style="margin:0;padding:0;background:${t.page_bg};font-family:${t.font};color:${t.text};">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(nl.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.page_bg};"><tr><td class="ls-outer" align="center" style="padding:20px 4px;">` +
    '<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center"><tr><td><![endif]-->' +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:${t.body_bg};border-radius:${t.radius};">` +
    header +
    body +
    footer +
    "</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>"
  );
}

/** Fills the per-recipient placeholders in rendered campaign HTML. */
export function personalize(html: string, name: string, unsubUrl: string): string {
  return html.split(GREETING_PLACEHOLDER).join(esc(greetingLine(name))).split(UNSUB_PLACEHOLDER).join(esc(unsubUrl));
}
