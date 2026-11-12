import "server-only";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";

// Sends email through one of three providers, picked from environment variables:
//   SENDGRID_API_KEY -> SendGrid Web API
//   SMTP_HOST        -> any SMTP server
//   RESEND_API_KEY   -> Resend
// MAIL_PROVIDER (sendgrid | smtp | resend) forces one when several are set.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  replyTo?: string;
  unsubscribeUrl?: string;
};

type Provider = "sendgrid" | "smtp" | "resend";

export function mailProvider(): Provider | null {
  const forced = process.env.MAIL_PROVIDER as Provider | undefined;
  if (forced === "sendgrid" || forced === "smtp" || forced === "resend") return forced;
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (process.env.SMTP_HOST) return "smtp";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

function fromAddress() {
  const address = process.env.MAIL_FROM_ADDRESS;
  if (!address) throw new Error("MAIL_FROM_ADDRESS 환경 변수(보내는 메일 주소)를 넣어주세요.");
  return address;
}

function safeName(name: string) {
  return (name || "LEADstation").replace(/["<>\r\n]/g, "").slice(0, 80);
}

function toText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<title[\s\S]*?<\/title>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unsubHeaders(m: OutgoingEmail): Record<string, string> | undefined {
  return m.unsubscribeUrl
    ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;
}

// --- SendGrid -------------------------------------------------------------

async function sendgridOne(m: OutgoingEmail) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: m.to }] }],
      from: { email: fromAddress(), name: safeName(m.fromName) },
      ...(m.replyTo ? { reply_to: { email: m.replyTo } } : {}),
      subject: m.subject,
      content: [
        { type: "text/plain", value: toText(m.html) || " " },
        { type: "text/html", value: m.html },
      ],
      ...(unsubHeaders(m) ? { headers: unsubHeaders(m) } : {}),
    }),
  });
  if (res.status === 202 || res.ok) return;
  const body = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null;
  const msg = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
  if (res.status === 401 || res.status === 403) {
    throw new Error(`SendGrid 인증 오류: ${msg} (API 키 권한과 보내는 주소의 Sender 인증을 확인해 주세요)`);
  }
  throw new Error(`SendGrid 오류: ${msg}`);
}

// --- SMTP -----------------------------------------------------------------

let smtp: Transporter | null = null;
function smtpTransport() {
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST 환경 변수를 넣어주세요.");
  const port = Number(process.env.SMTP_PORT || 587);
  smtp ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    pool: true,
    maxConnections: 3,
  });
  return smtp;
}

async function smtpOne(m: OutgoingEmail) {
  await smtpTransport().sendMail({
    from: { name: safeName(m.fromName), address: fromAddress() },
    to: m.to,
    replyTo: m.replyTo,
    subject: m.subject,
    html: m.html,
    text: toText(m.html),
    headers: unsubHeaders(m),
  });
}

// --- Resend ---------------------------------------------------------------

let resend: Resend | null = null;
function resendPayload(m: OutgoingEmail) {
  return {
    from: `"${safeName(m.fromName)}" <${fromAddress()}>`,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: toText(m.html),
    ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    ...(unsubHeaders(m) ? { headers: unsubHeaders(m) } : {}),
  };
}

// --- Public API -----------------------------------------------------------

function requireProvider(): Provider {
  const p = mailProvider();
  if (!p) throw new Error("메일 발송 설정이 없어요. SENDGRID_API_KEY(또는 SMTP_HOST, RESEND_API_KEY)와 MAIL_FROM_ADDRESS 환경 변수를 넣어주세요.");
  return p;
}

export async function sendOne(m: OutgoingEmail) {
  const p = requireProvider();
  if (p === "sendgrid") return sendgridOne(m);
  if (p === "smtp") return smtpOne(m);
  resend ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send(resendPayload(m));
  if (error) throw new Error(error.message);
}

/** Sends a batch (up to 100). Returns one error message (or null) per email, in order. */
export async function sendBatch(messages: OutgoingEmail[]): Promise<(string | null)[]> {
  if (!messages.length) return [];
  const p = requireProvider();

  if (p === "resend") {
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.batch.send(messages.map(resendPayload));
    return messages.map(() => (error ? error.message : null));
  }

  // SendGrid and SMTP: per-recipient requests, a few at a time.
  const results: (string | null)[] = new Array(messages.length).fill(null);
  const concurrency = p === "sendgrid" ? 8 : 3;
  let next = 0;
  const worker = async () => {
    while (next < messages.length) {
      const i = next++;
      try {
        await (p === "sendgrid" ? sendgridOne(messages[i]) : smtpOne(messages[i]));
      } catch (e) {
        results[i] = e instanceof Error ? e.message : "발송 실패";
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, messages.length) }, worker));
  return results;
}
