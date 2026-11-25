import "server-only";
import { BRAND, esc, kstTime, layout, multiline, table } from "@/lib/lead-mail-template";
import { siteUrl } from "@/lib/site";

export type Inquiry = { name: string; email: string; phone: string; message: string; page: string };

const row = (label: string, value: string) =>
  `<tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;width:96px;font-size:13px;color:#64748b;vertical-align:top">${label}</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a">${value}</td></tr>`;

/** Notice to super admins about a new "문의하기" inquiry. Replying goes to the visitor. */
export function inquiryEmail(q: Inquiry) {
  const header = `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2ff;color:${BRAND};font-size:12px;font-weight:700">새 도입 문의</div>`;
  const from = q.page ? `${siteUrl()}${q.page}` : siteUrl();
  const body = `
    <h1 style="margin:12px 0 8px;font-size:20px;line-height:1.4;color:#0f172a">${esc(q.name)}님이 도입 문의를 남겼어요.</h1>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#475569">접수 일시: ${kstTime()}<br>문의한 페이지: <a href="${esc(from)}" style="color:${BRAND};text-decoration:none">${esc(q.page || "/")}</a></p>
    ${table(
      row("이름", esc(q.name)) +
        row("이메일", `<a href="mailto:${esc(q.email)}" style="color:${BRAND};text-decoration:none">${esc(q.email)}</a>`) +
        row("전화번호", esc(q.phone)) +
        row("문의내용", multiline(q.message)),
    )}
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b">이 메일에 바로 답장하면 문의자(${esc(q.email)})에게 전달돼요.</p>`;
  const footer = `<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">리드스테이션 소개 페이지의 문의하기로 접수된 내용이에요. 슈퍼 관리자에게만 발송됩니다.</p>`;
  return {
    subject: `[리드스테이션] 새 도입 문의 - ${q.name}`,
    html: layout({ preheader: `${q.name} · ${q.message.slice(0, 60)}`, header, body, footer }),
  };
}

/** Receipt to the visitor: the inquiry arrived and we will reply within 24 hours. */
export function inquiryReceiptEmail(q: Inquiry, company: { name: string; phone: string; email: string; address: string }) {
  const header = `<div style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.01em">LEAD<span style="color:${BRAND}">station</span> <span style="font-size:12px;font-weight:400;color:#64748b">리드스테이션</span></div>`;
  const body = `
    <h1 style="margin:4px 0 10px;font-size:20px;line-height:1.4;color:#0f172a">${esc(q.name)}님, 문의가 잘 접수되었습니다.</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.75;color:#334155">리드스테이션에 관심 가져 주셔서 감사합니다.<br>담당자가 내용을 확인하고 <b style="color:${BRAND}">24시간 이내에</b> 남겨 주신 연락처로 연락드리겠습니다.</p>
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${BRAND}">접수 내용</p>
    ${table(row("이름", esc(q.name)) + row("이메일", esc(q.email)) + row("전화번호", esc(q.phone)) + row("문의내용", multiline(q.message)))}
    <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#64748b">접수 일시: ${kstTime()}<br>급하신 경우 대표전화 ${esc(company.phone)}로 연락 주세요. 이 메일에 답장하셔도 담당자에게 전달됩니다.</p>`;
  const footer = `<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">${esc(company.name)} · ${esc(company.address)}<br>대표전화 ${esc(company.phone)} · ${esc(company.email)}</p>`;
  return {
    subject: "[리드스테이션] 문의가 접수되었습니다",
    html: layout({ preheader: "담당자가 24시간 이내에 연락드리겠습니다.", header, body, footer }),
  };
}
