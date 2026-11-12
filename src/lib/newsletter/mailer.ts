import "server-only";
import { Resend } from "resend";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  replyTo?: string;
  unsubscribeUrl?: string;
};

let resend: Resend | null = null;
function client() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("메일 발송 설정이 없어요. RESEND_API_KEY 환경 변수를 넣어주세요.");
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function fromAddress(name: string) {
  const address = process.env.MAIL_FROM_ADDRESS;
  if (!address) throw new Error("MAIL_FROM_ADDRESS 환경 변수(보내는 메일 주소)를 넣어주세요.");
  const safe = (name || "LEADstation").replace(/["<>\r\n]/g, "").slice(0, 80);
  return `"${safe}" <${address}>`;
}

function toText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toPayload(m: OutgoingEmail) {
  return {
    from: fromAddress(m.fromName),
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: toText(m.html),
    ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    ...(m.unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };
}

export async function sendOne(m: OutgoingEmail) {
  const { error } = await client().emails.send(toPayload(m));
  if (error) throw new Error(error.message);
}

/** Sends up to 100 emails in one API call. Returns an error message for the whole batch, or null. */
export async function sendBatch(messages: OutgoingEmail[]): Promise<string | null> {
  if (!messages.length) return null;
  const { error } = await client().batch.send(messages.map(toPayload));
  return error ? error.message : null;
}
