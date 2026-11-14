"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSite } from "@/lib/supabase/server";
import { checkLimit, limitMessage, metered, recordUsage } from "@/lib/usage";
import { siteUrl } from "@/lib/slug";
import { generateNewsletter } from "@/lib/newsletter/ai";
import { sendOne } from "@/lib/newsletter/mailer";
import { personalize, renderNewsletter } from "@/lib/newsletter/render";
import {
  buildAudience,
  createCampaign,
  getSettings,
  parseEmails,
  processCampaign,
  type AudienceSpec,
} from "@/lib/newsletter/queue";
import {
  TEMPLATES,
  TONES,
  sanitizeBlocks,
  type Block,
  type Newsletter,
  type Template,
  type Tone,
} from "@/lib/newsletter/types";

export type DraftInput = {
  title: string;
  subject: string;
  preheader: string;
  topic: string;
  prompt: string;
  tone: string;
  template: string;
  greeting: boolean;
  blocks: Block[];
};

function cleanDraft(input: DraftInput) {
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return {
    title: s(input.title, 200),
    subject: s(input.subject, 255),
    preheader: s(input.preheader, 255),
    topic: s(input.topic, 10000),
    prompt: s(input.prompt, 5000),
    tone: (input.tone in TONES ? input.tone : "friendly") as Tone,
    template: (input.template in TEMPLATES ? input.template : "card") as Template,
    greeting: !!input.greeting,
    blocks: sanitizeBlocks(input.blocks),
  };
}

async function loadNewsletter(id: string) {
  const { supabase, user, site } = await requireSite();
  const { data } = await supabase.from("newsletters").select("*").eq("id", id).single<Newsletter>();
  if (!data) throw new Error("뉴스레터를 찾을 수 없어요.");
  return { supabase, user, site, nl: data };
}

export async function createNewsletter() {
  const { supabase, user, site } = await requireSite();
  const { data, error } = await supabase
    .from("newsletters")
    .insert({ site_id: site.id, user_id: user.id, title: "새 뉴스레터" })
    .select("id")
    .single();
  if (error || !data) throw new Error("뉴스레터를 만들지 못했어요.");
  redirect(`/dashboard/newsletters/${data.id}`);
}

export async function saveNewsletter(id: string, input: DraftInput) {
  const { supabase } = await requireSite();
  const draft = cleanDraft(input);
  const { error } = await supabase
    .from("newsletters")
    .update({ ...draft, title: draft.title || draft.subject || "제목 없는 뉴스레터" })
    .eq("id", id);
  if (error) return { error: "저장하지 못했어요." };
  revalidatePath("/dashboard/newsletters");
  return { ok: true };
}

export async function generateWithAi(id: string, input: DraftInput, mode: "new" | "edit") {
  const { supabase, site, nl } = await loadNewsletter(id);
  const draft = cleanDraft(input);
  if (!draft.topic.trim()) return { error: "이메일 내용을 입력해 주세요." };

  const settings = await getSettings(supabase, site.id);
  try {
    const result = await metered(supabase, site.id, ["text"], () => generateNewsletter({
      topic: draft.topic,
      prompt: draft.prompt,
      tone: draft.tone,
      template: draft.template,
      greeting: draft.greeting,
      brand: settings.brand_context,
      current: mode === "edit" ? draft.blocks : [],
    }));
    const update = {
      ...draft,
      title: draft.title && draft.title !== "새 뉴스레터" ? draft.title : result.subject,
      subject: result.subject,
      preheader: result.preheader,
      blocks: result.blocks,
      previous_blocks: draft.blocks.length ? draft.blocks : nl.previous_blocks,
    };
    await supabase.from("newsletters").update(update).eq("id", id);
    revalidatePath("/dashboard/newsletters");
    return { ok: true, subject: update.subject, preheader: update.preheader, blocks: update.blocks, title: update.title };
  } catch (e) {
    console.error("generateNewsletter failed", e);
    const msg = limitMessage(e) ?? (e instanceof Error && e.message.startsWith("AI") ? e.message : "AI 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    return { error: msg };
  }
}

export async function restorePrevious(id: string) {
  const { supabase, nl } = await loadNewsletter(id);
  if (!nl.previous_blocks?.length) return { error: "되돌릴 이전 본문이 없어요." };
  await supabase.from("newsletters").update({ blocks: nl.previous_blocks, previous_blocks: nl.blocks }).eq("id", id);
  return { ok: true, blocks: nl.previous_blocks };
}

export async function duplicateNewsletter(id: string) {
  const { supabase, user, site, nl } = await loadNewsletter(id);
  const { data } = await supabase
    .from("newsletters")
    .insert({
      site_id: site.id, user_id: user.id,
      title: `${nl.title} (복사본)`,
      subject: nl.subject,
      preheader: nl.preheader,
      topic: nl.topic,
      prompt: nl.prompt,
      tone: nl.tone,
      template: nl.template,
      greeting: nl.greeting,
      blocks: nl.blocks,
    })
    .select("id")
    .single();
  revalidatePath("/dashboard/newsletters");
  if (data) redirect(`/dashboard/newsletters/${data.id}`);
}

export async function deleteNewsletter(id: string) {
  const { supabase } = await requireSite();
  const { count } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("newsletter_id", id)
    .in("status", ["scheduled", "queued", "sending"]);
  if (count) return { error: "예약됐거나 발송 중인 작업이 있어서 삭제할 수 없어요. 먼저 예약을 취소해 주세요." };
  await supabase.from("newsletters").delete().eq("id", id);
  revalidatePath("/dashboard/newsletters");
  redirect("/dashboard/newsletters");
}

export async function sendTest(id: string, rawEmails: string) {
  const { supabase, site, nl } = await loadNewsletter(id);
  const emails = parseEmails(rawEmails).slice(0, 5);
  if (!emails.length) return { error: "받을 이메일 주소를 입력해 주세요." };
  if (!nl.blocks.length) return { error: "본문이 비어 있어요." };
  const settings = await getSettings(supabase, site.id);
  const html = personalize(renderNewsletter(nl, settings, { placeholders: true, siteUrl: siteUrl() }), "테스트", `${siteUrl()}/`);
  try {
    await checkLimit(supabase, site.id, "newsletter", emails.length);
    await recordUsage(supabase, "newsletter", emails.length);
    for (const to of emails) {
      await sendOne({ to, subject: `[테스트] ${nl.subject || nl.title}`, html, fromName: settings.from_name, replyTo: settings.reply_to || undefined });
    }
    return { ok: true, message: `${emails.join(", ")}(으)로 테스트 메일을 보냈어요.` };
  } catch (e) {
    return { error: limitMessage(e) ?? `테스트 메일을 보내지 못했어요: ${e instanceof Error ? e.message : "알 수 없는 오류"}` };
  }
}

export type SendRequest = {
  mode: "all" | "groups" | "emails";
  groupIds: string[];
  emails: string;
  scheduledAt: string | null; // ISO
};

function toSpec(req: SendRequest): AudienceSpec {
  if (req.mode === "groups") return { mode: "groups", groupIds: req.groupIds.slice(0, 100) };
  if (req.mode === "emails") return { mode: "emails", emails: parseEmails(req.emails).slice(0, 5000) };
  return { mode: "all" };
}

export async function previewAudience(req: SendRequest) {
  const { supabase, site } = await requireSite();
  const spec = toSpec(req);
  if (spec.mode === "emails") {
    // Count without saving the addresses yet.
    const { data: blocked } = await supabase
      .from("recipients")
      .select("email")
      .eq("site_id", site.id)
      .eq("status", "unsubscribed")
      .in("email", spec.emails.slice(0, 1000));
    const b = new Set((blocked ?? []).map((r) => r.email));
    const list = spec.emails.filter((e) => !b.has(e));
    return { count: list.length, sample: list.slice(0, 20), skipped: b.size };
  }
  const targets = await buildAudience(supabase, site.id, spec);
  return { count: targets.length, sample: targets.slice(0, 20).map((t) => t.email), skipped: 0 };
}

export async function startSend(id: string, req: SendRequest) {
  const { supabase, site, nl } = await loadNewsletter(id);
  if (!nl.blocks.length) return { error: "본문이 비어 있어요. 먼저 뉴스레터를 작성해 주세요." };
  if (!nl.subject.trim()) return { error: "이메일 제목을 입력해 주세요." };

  let scheduledAt: Date | null = null;
  if (req.scheduledAt) {
    scheduledAt = new Date(req.scheduledAt);
    if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000) {
      return { error: "예약 시각은 지금부터 1분 이후로 정해 주세요." };
    }
    if (!process.env.CRON_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: "예약 발송 설정(CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY)이 아직 없어요. 지금 발송을 이용하거나 README의 예약 발송 설정을 따라주세요." };
    }
  }

  const spec = toSpec(req);
  const targets = await buildAudience(supabase, site.id, spec);
  if (!targets.length) return { error: "보낼 수신자가 없어요. 수신 거부한 주소는 제외돼요." };

  const settings = await getSettings(supabase, site.id);
  try {
    await checkLimit(supabase, site.id, "newsletter", targets.length);
    const campaignId = await createCampaign(supabase, nl, settings, targets, spec, scheduledAt);
    await recordUsage(supabase, "newsletter", targets.length);
    revalidatePath(`/dashboard/newsletters/${id}/send`);
    return { ok: true, campaignId, total: targets.length, scheduled: !!scheduledAt };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "발송을 시작하지 못했어요." };
  }
}

export async function continueSend(campaignId: string) {
  const { supabase } = await requireSite();
  const counts = await processCampaign(supabase, campaignId, 20000);
  return counts;
}

export async function cancelCampaign(campaignId: string) {
  const { supabase } = await requireSite();
  const { data: c } = await supabase.from("campaigns").select("newsletter_id, status").eq("id", campaignId).single();
  if (!c || c.status !== "scheduled") return { error: "예약 상태인 발송만 취소할 수 있어요." };
  await supabase.from("campaigns").update({ status: "canceled" }).eq("id", campaignId);
  await supabase.from("send_logs").delete().eq("campaign_id", campaignId).eq("status", "queued");
  const { count } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("newsletter_id", c.newsletter_id)
    .eq("status", "done");
  await supabase.from("newsletters").update({ status: count ? "sent" : "draft" }).eq("id", c.newsletter_id);
  revalidatePath(`/dashboard/newsletters/${c.newsletter_id}/send`);
  return { ok: true };
}

export async function resendFailed(campaignId: string) {
  const { supabase, site } = await requireSite();
  const { data: c } = await supabase.from("campaigns").select("newsletter_id").eq("id", campaignId).single();
  if (!c) return { error: "발송 기록을 찾을 수 없어요." };
  const { data: failed } = await supabase
    .from("send_logs")
    .select("email")
    .eq("campaign_id", campaignId)
    .eq("status", "failed")
    .limit(5000);
  const emails = (failed ?? []).map((r) => r.email);
  if (!emails.length) return { error: "실패한 수신자가 없어요." };
  const { data: nl } = await supabase.from("newsletters").select("*").eq("id", c.newsletter_id).single<Newsletter>();
  if (!nl) return { error: "뉴스레터를 찾을 수 없어요." };
  const spec: AudienceSpec = { mode: "emails", emails };
  const targets = await buildAudience(supabase, site.id, spec);
  const settings = await getSettings(supabase, site.id);
  try {
    await checkLimit(supabase, site.id, "newsletter", targets.length);
  } catch (e) {
    return { error: limitMessage(e) ?? "다시 보내지 못했어요." };
  }
  const id = await createCampaign(supabase, nl, settings, targets, spec, null, "resend");
  await recordUsage(supabase, "newsletter", targets.length);
  return { ok: true, campaignId: id, total: targets.length };
}

export async function saveSettings(_: unknown, formData: FormData) {
  const { supabase, user, site } = await requireSite();
  const s = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const accent = s("accent_color", 7);
  const replyTo = s("reply_to", 200);
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) return { error: "회신 이메일 형식을 확인해 주세요." };
  const logo = s("logo_url", 1000);
  if (logo && !/^https:\/\//.test(logo)) return { error: "로고 주소는 https:// 로 시작해야 해요." };
  const { error } = await supabase.from("newsletter_settings").upsert({
    site_id: site.id, user_id: user.id,
    from_name: s("from_name", 80),
    reply_to: replyTo,
    footer_text: s("footer_text", 1000),
    logo_url: logo,
    accent_color: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#2f5d8a",
    brand_context: s("brand_context", 3000),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "저장하지 못했어요." };
  return { ok: true };
}

