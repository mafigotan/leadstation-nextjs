import "server-only";
import { siteUrl, userUrl } from "@/lib/site";
import type { PublicSite } from "@/lib/user-site";
import { BRAND, applicantEmail, applicantMailOf, consentRows, esc, fieldRows, kstTime, layout, siteDisplayName, table, type ApplicantMail, type LeadNotice } from "@/lib/lead-mail-template";

// Emails sent when a visitor leaves a lead on a promotion page:
//   - each site admin gets the application details, subject "[신청자 이름] ...";
//   - the applicant gets a thank-you note with what they submitted and the site's company info in the footer.
// Failures are only logged: the lead is already saved.

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

export async function sendLeadNotifications(n: LeadNotice, mail?: ApplicantMail) {
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
    const fromName = siteDisplayName(site);
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

    if (applicant && applicantMailOf(mail).enabled) {
      const { subject, html } = applicantEmail(n, site, mail);
      jobs.push(sendOne({ to: applicant, subject, html, fromName, replyTo: site.contact_email || undefined }));
    }

    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === "rejected") console.error("lead notify email failed", r.reason);
  } catch (e) {
    console.error("lead notify failed", e);
  }
}
