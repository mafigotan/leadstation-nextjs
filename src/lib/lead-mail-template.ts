// HTML for lead emails. No server-only imports: the promotion editor uses it for the applicant email preview.
import { LEAD_FIELD_LABEL, type LeadField } from "./lead-fields";
import type { PublicSite } from "./user-site";

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type LeadNotice = {
  pageId: string;
  site: PublicSite;
  pageTitle: string;
  pageSlug: string;
  fields: LeadField[];
  row: Record<string, unknown>;
  terms: { label: string; required: boolean; agreed: boolean }[];
  marketing: boolean;
};

export const BRAND = "#4f46e5";

export function value(f: LeadField | "event", v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (f === "age") return `${v}세`;
  return String(v);
}

/** HTML-escaped with line breaks kept (for 기타). */
export const multiline = (s: string) => esc(s).replace(/\r?\n/g, "<br>");

export function fieldRows(n: LeadNotice): string {
  const rows: [string, string][] = n.fields.map((f) => [LEAD_FIELD_LABEL[f], value(f, n.row[f])]);
  if (n.row.event) rows.push(["이벤트 결과", value("event", n.row.event)]);
  return rows
    .map(
      ([label, v]) => `<tr>
        <td style="width:110px;padding:12px 14px;border-bottom:1px solid #eef0f4;background:#f8fafc;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;white-space:nowrap">${esc(label)}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef0f4;color:#0f172a;font-size:14px;line-height:1.6;word-break:break-all">${v ? multiline(v) : '<span style="color:#cbd5e1">-</span>'}</td>
      </tr>`,
    )
    .join("");
}

export function table(inner: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">${inner}</table>`;
}

export function consentRows(n: LeadNotice): string {
  const list = n.terms.length
    ? n.terms.map((t) => [`${t.label} (${t.required ? "필수" : "선택"})`, t.agreed ? "동의" : "미동의"] as const)
    : [["마케팅 정보 수신", n.marketing ? "동의" : "미동의"] as const];
  return list
    .map(
      ([label, v]) => `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #eef0f4;color:#475569;font-size:13px">${esc(label)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #eef0f4;font-size:13px;font-weight:600;text-align:right;color:${v === "동의" ? "#059669" : "#94a3b8"}">${v}</td>
      </tr>`,
    )
    .join("");
}

export function kstTime(d = new Date()) {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function layout({ preheader, header, body, footer }: { preheader: string; header: string; body: string; footer: string }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)">
    <tr><td style="padding:28px 32px 0">${header}</td></tr>
    <tr><td style="padding:20px 32px 32px">${body}</td></tr>
    <tr><td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">${footer}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function siteLabel(site: PublicSite) {
  return site.company_name || site.name || site.handle;
}

export function logoOrName(site: PublicSite) {
  const name = esc(site.name || site.company_name || site.handle);
  return site.logo_url
    ? `<img src="${esc(site.logo_url)}" alt="${name}" style="max-height:40px;max-width:180px;display:block;border:0">`
    : `<div style="font-size:18px;font-weight:800;color:#0f172a">${name}</div>`;
}

/** The site's company info, same lines as the user site footer. */
export function companyFooter(site: PublicSite) {
  const line1 = [
    site.company_name && `상호 ${site.company_name}`,
    site.ceo_name && `대표 ${site.ceo_name}`,
    site.business_no && `사업자등록번호 ${site.business_no}`,
  ].filter(Boolean) as string[];
  const line2 = [
    site.address && `주소 ${site.address}`,
    site.contact_phone && `연락처 ${site.contact_phone}`,
    site.contact_email && `이메일 ${site.contact_email}`,
  ].filter(Boolean) as string[];
  const p = (s: string) => `<p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#64748b">${esc(s)}</p>`;
  return `<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a">${esc(site.name || site.company_name || site.handle)}</p>
    ${line1.length ? p(line1.join(" · ")) : ""}
    ${line2.length ? p(line2.join(" · ")) : ""}
    <p style="margin:10px 0 0;font-size:11px;line-height:1.6;color:#94a3b8">이 메일은 ${esc(siteLabel(site))} 프로모션 신청에 따라 발송된 안내 메일입니다. 문의는 위 연락처로 부탁드립니다.</p>
    <p style="margin:6px 0 0;font-size:11px;color:#94a3b8">© ${new Date().getFullYear()} ${esc(siteLabel(site))}. All rights reserved.</p>`;
}

/** Applicant email settings saved on the form section. Empty text means the default. */
export type ApplicantMail = { enabled: boolean; subject: string; heading: string; body: string };

export const MAIL_VARS = ["{이름}", "{프로모션명}", "{사이트명}"] as const;

export const DEFAULT_APPLICANT_MAIL: ApplicantMail = {
  enabled: true,
  subject: "[{사이트명}] {프로모션명} 신청해 주셔서 감사합니다",
  heading: "{이름}님, 신청해 주셔서 감사합니다.",
  body: "{프로모션명}에 보내주신 신청이 정상적으로 접수되었습니다.\n프로모션에 참여해주셔서 감사드립니다.\n신청하신 내역은 아래와 같으니 참고 바랍니다.",
};

export function sanitizeApplicantMail(input: unknown): ApplicantMail | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return { enabled: r.enabled !== false, subject: str(r.subject, 200), heading: str(r.heading, 200), body: str(r.body, 5000) };
}

/** Settings with defaults filled in for empty parts. */
export function applicantMailOf(m: ApplicantMail | undefined): ApplicantMail {
  return {
    enabled: m?.enabled !== false,
    subject: m?.subject.trim() || DEFAULT_APPLICANT_MAIL.subject,
    heading: m?.heading.trim() || DEFAULT_APPLICANT_MAIL.heading,
    body: m?.body.trim() || DEFAULT_APPLICANT_MAIL.body,
  };
}

/** Replaces {이름}, {프로모션명}, {사이트명}. Without a name, {이름} becomes 고객. */
export function fillVars(text: string, v: { name: string; page: string; site: string }) {
  return text.replaceAll("{이름}", v.name || "고객").replaceAll("{프로모션명}", v.page).replaceAll("{사이트명}", v.site);
}

export function siteDisplayName(site: PublicSite) {
  return site.name || site.company_name || site.handle;
}

/** Subject and HTML of the applicant email. */
export function applicantEmail(n: LeadNotice, site: PublicSite, mail?: ApplicantMail): { subject: string; html: string } {
  const m = applicantMailOf(mail);
  const vars = { name: String(n.row.name ?? "").trim(), page: n.pageTitle, site: siteDisplayName(site) };
  const subject = fillVars(m.subject, vars).replace(/[\r\n]+/g, " ").trim();
  const paragraphs = fillVars(m.body, vars)
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#334155">${esc(p)}</p>`)
    .join("");
  const body = `
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.4;color:#0f172a">${esc(fillVars(m.heading, vars))}</h1>
    ${paragraphs}
    <p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:${BRAND}">신청 내용</p>
    ${table(fieldRows(n))}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">접수 일시: ${kstTime()}</p>`;
  const html = layout({ preheader: subject, header: logoOrName(site), body, footer: companyFooter(site) });
  return { subject, html };
}

const SAMPLE: Record<LeadField, string | number> = {
  name: "홍길동",
  email: "hong@example.com",
  phone: "010-1234-5678",
  address: "서울시 강남구 테헤란로 1",
  gender: "남성",
  age: 34,
  nationality: "대한민국",
  message: "자세한 상담을 받고 싶어요.",
};

/** A made-up application for previews and test emails. */
export function sampleNotice(site: PublicSite, pageTitle: string, fields: LeadField[]): LeadNotice {
  const list = fields.length ? fields : (["name", "email", "phone", "message"] as LeadField[]);
  return {
    pageId: "",
    site,
    pageTitle,
    pageSlug: "",
    fields: list,
    row: Object.fromEntries(list.map((f) => [f, SAMPLE[f]])),
    terms: [],
    marketing: false,
  };
}
