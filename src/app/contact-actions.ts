"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// "문의하기" modal on the public service pages: saves the inquiry and emails every super admin.

const schema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(100, "이름이 너무 길어요."),
  email: z.string().trim().min(1, "이메일을 입력해 주세요.").pipe(z.email("올바른 이메일을 입력해 주세요.").max(200)),
  phone: z
    .string()
    .trim()
    .min(1, "전화번호를 입력해 주세요.")
    .max(50, "전화번호가 너무 길어요.")
    .regex(/^[0-9+\-\s().]{7,}$/, "전화번호를 확인해 주세요."),
  message: z.string().trim().min(1, "문의내용을 입력해 주세요.").max(3000, "문의내용은 3,000자까지 쓸 수 있어요."),
  agree: z.literal("on", "개인정보 수집·이용에 동의해 주세요."),
  page: z.string().max(200).optional().default(""),
});

export type ContactField = "name" | "email" | "phone" | "message" | "agree";
export type ContactValues = { name: string; email: string; phone: string; message: string; agree: boolean };
// values: what the visitor typed, so the form keeps it after an error (React resets the form on submit).
export type ContactState = { done?: boolean; error?: string; fieldErrors?: Partial<Record<ContactField, string>>; values?: ContactValues };

export async function submitContact(_: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot: real visitors leave this hidden field empty.
  if (formData.get("website")) return { done: true };

  const str = (k: string) => String(formData.get(k) ?? "");
  const values: ContactValues = { name: str("name"), email: str("email"), phone: str("phone"), message: str("message"), agree: formData.get("agree") === "on" };
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    message: formData.get("message") ?? "",
    agree: formData.get("agree") ?? "",
    page: formData.get("page") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: ContactState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as ContactField;
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { fieldErrors, values };
  }
  const v = parsed.data;

  const h = await headers();
  const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim();

  let saved = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_contact_inquiry", {
      p_name: v.name,
      p_email: v.email,
      p_phone: v.phone,
      p_message: v.message,
      p_page: v.page,
      p_ip: ip,
    });
    if (error) {
      if (error.message.includes("too many inquiries")) {
        return { values, error: "짧은 시간에 문의가 여러 번 접수되었어요. 잠시 후 다시 시도해 주세요." };
      }
      console.error("contact inquiry save failed", error);
    } else {
      saved = true;
    }
  } catch (e) {
    console.error("contact inquiry save failed", e);
  }

  let mailed = false;
  try {
    const { superAdminEmails } = await import("@/lib/admin-notify");
    const { mailProvider, sendOne } = await import("@/lib/newsletter/mailer");
    const { inquiryEmail, inquiryReceiptEmail } = await import("@/lib/contact-mail");
    if (mailProvider() && process.env.MAIL_FROM_ADDRESS) {
      const to = await superAdminEmails();
      const { subject, html } = inquiryEmail(v);
      const results = await Promise.allSettled(to.map((addr) => sendOne({ to: addr, subject, html, fromName: "LEADstation", replyTo: v.email })));
      mailed = results.some((r) => r.status === "fulfilled");
      for (const r of results) if (r.status === "rejected") console.error("contact inquiry email failed", r.reason);
      // Receipt to the visitor; a failure here does not fail the inquiry.
      try {
        const { COMPANY } = await import("@/components/marketing/chrome");
        const receipt = inquiryReceiptEmail(v, COMPANY);
        await sendOne({ to: v.email, subject: receipt.subject, html: receipt.html, fromName: "리드스테이션", replyTo: COMPANY.email });
      } catch (e) {
        console.error("contact inquiry receipt email failed", e);
      }
      if (!to.length) console.warn("contact inquiry: no super admin email (set SUPABASE_SERVICE_ROLE_KEY or ADMIN_NOTIFY_EMAIL)");
    } else {
      console.warn("contact inquiry: mail is not configured");
    }
  } catch (e) {
    console.error("contact inquiry email failed", e);
  }

  if (!saved && !mailed) return { values, error: "문의를 접수하지 못했어요. 잠시 후 다시 시도하거나 대표전화로 연락 주세요." };
  return { done: true };
}
