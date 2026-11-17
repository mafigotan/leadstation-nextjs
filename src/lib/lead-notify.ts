import "server-only";
import { esc } from "@/lib/admin-notify";
import { LEAD_FIELD_LABEL, type LeadField } from "@/lib/lead-fields";
import { siteUrl, userUrl } from "@/lib/site";
import type { PublicSite } from "@/lib/user-site";

// Emails sent when a visitor leaves a lead on a promotion page:
//   - each site admin gets the application details, subject "[신청자 이름] ...";
//   - the applicant gets a thank-you note with what they submitted and the site's company info in the footer.
// Failures are only logged: the lead is already saved.

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

const BRAND = "#4f46e5";

function value(f: LeadField | "event", v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (f === "age") return `${v}세`;
  return String(v);
}

/** HTML-escaped with line breaks kept (for 기타). */
const multiline = (s: string) => esc(s).replace(/\r?\n/g, "<br>");

function fieldRows(n: LeadNotice): string {
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

function table(inner: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">${inner}</table>`;
}

function consentRows(n: LeadNotice): string {
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

function kstTime(d = new Date()) {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function layout({ preheader, header, body, footer }: { preheader: string; header: string; body: string; footer: string }) {
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

function siteLabel(site: PublicSite) {
  return site.company_name || site.name || site.handle;
}

function logoOrName(site: PublicSite) {
  const name = esc(site.name || site.company_name || site.handle);
  return site.logo_url
    ? `<img src="${esc(site.logo_url)}" alt="${name}" style="max-height:40px;max-width:180px;display:block;border:0">`
    : `<div style="font-size:18px;font-weight:800;color:#0f172a">${name}</div>`;
}

/** The site's company info, same lines as the user site footer. */
function companyFooter(site: PublicSite) {
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

function applicantEmail(n: LeadNotice, site: PublicSite, name: string) {
  const header = logoOrName(site);
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.4;color:#0f172a">${name ? `${esc(name)}님, ` : ""}신청해 주셔서 감사합니다.</h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:#334155"><b>${esc(n.pageTitle)}</b>에 보내주신 신청이 정상적으로 접수되었습니다.</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155">관심 가져 주셔서 진심으로 감사드리며, 담당자가 확인 후 빠르게 안내해 드리겠습니다.</p>
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${BRAND}">신청 내용</p>
    ${table(fieldRows(n))}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">접수 일시: ${kstTime()}</p>`;
  return layout({
    preheader: `${n.pageTitle} 신청이 접수되었습니다. 감사합니다.`,
    header,
    body,
    footer: companyFooter(site),
  });
}

function adminEmail(n: LeadNotice, site: PublicSite, name: string) {
  const header = `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2ff;color:${BRAND};font-size:12px;font-weight:700">새 리드 신청</div>`;
  const pageUrl = userUrl(site.handle, n.pageSlug);
  const body = `
    <h1 style="margin:12px 0 8px;font-size:20px;line-height:1.4;color:#0f172a">${name ? `${esc(name)}님이` : "방문자가"} 신청서를 남겼어요.</h1>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#475569">프로모션: <a href="${esc(pageUrl)}" style="color:${BRAND};text-decoration:none;font-weight:600">${esc(n.pageTitle)}</a><br>접수 일시: ${kstTime()}</p>
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${BRAND}">신청 내용</p>
    ${table(fieldRows(n))}
    <p style="margin:22px 0 10px;font-size:13px;font-weight:700;color:${BRAND}">약관 동의</p>
    ${table(consentRows(n))}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr><td style="border-radius:8px;background:${BRAND}">
      <a href="${siteUrl()}/dashboard/leads?page=${encodeURIComponent(n.pageId)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">리드 관리에서 보기</a>
    </td></tr></table>`;
  const footer = `<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8">${esc(site.name || site.handle)} 사이트 관리자에게 보내는 LEADstation 알림이에요.</p>`;
  return layout({ preheader: `${name || "새 리드"} · ${n.pageTitle}`, header, body, footer });
}

/** Emails of the site's admins (service role). */
async function siteAdminEmails(admin: NonNullable<Awaited<ReturnType<typeof getAdmin>>>, siteId: string) {
  const { data } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("role", "admin");
  const out = new Set<string>();
  for (const r of data ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(r.user_id);
    if (u.user?.email) out.add(u.user.email.toLowerCase());
  }
  return [...out];
}

async function getAdmin() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

export async function sendLeadNotifications(n: LeadNotice) {
  try {
    const { mailProvider, sendOne } = await import("@/lib/newsletter/mailer");
    if (!mailProvider() || !process.env.MAIL_FROM_ADDRESS) {
      console.warn("lead notify: mail is not configured");
      return;
    }
    const admin = await getAdmin();
    const site = n.site;

    const name = String(n.row.name ?? "").trim();
    const applicant = String(n.row.email ?? "").trim();
    const fromName = site.name || site.company_name || site.handle;
    const jobs: Promise<unknown>[] = [];

    if (admin) {
      const subject = `[${name || "이름 없음"}] ${n.pageTitle} 신청이 접수되었어요`;
      const html = adminEmail(n, site, name);
      for (const to of await siteAdminEmails(admin, site.id)) {
        jobs.push(sendOne({ to, subject, html, fromName: `${fromName} 리드 알림`, replyTo: applicant || undefined }));
      }
    } else {
      console.warn("lead notify: SUPABASE_SERVICE_ROLE_KEY is not set, skipping site admin email");
    }

    if (applicant) {
      jobs.push(
        sendOne({
          to: applicant,
          subject: `[${fromName}] ${n.pageTitle} 신청해 주셔서 감사합니다`,
          html: applicantEmail(n, site, name),
          fromName,
          replyTo: site.contact_email || undefined,
        }),
      );
    }

    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === "rejected") console.error("lead notify email failed", r.reason);
  } catch (e) {
    console.error("lead notify failed", e);
  }
}
