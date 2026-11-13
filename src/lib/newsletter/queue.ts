import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/slug";
import { personalize, renderNewsletter } from "./render";
import { mailProvider, sendBatch } from "./mailer";
import type { Newsletter, SenderSettings } from "./types";

export type AudienceSpec =
  | { mode: "all" }
  | { mode: "groups"; groupIds: string[] }
  | { mode: "emails"; emails: string[] };

type Target = { recipient_id: string; email: string; name: string; unsub_token: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    ),
  ];
}

export function unsubscribeUrl(token: string) {
  return `${siteUrl()}/u/${token}`;
}

/** Subscribed recipients for an audience. Direct-input addresses are saved as recipients first. */
export async function buildAudience(supabase: SupabaseClient, siteId: string, spec: AudienceSpec): Promise<Target[]> {
  const cols = "id, email, name, unsub_token, status";
  let rows: { id: string; email: string; name: string; unsub_token: string; status: string }[] = [];

  if (spec.mode === "all") {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("recipients").select(cols).eq("site_id", siteId).range(from, from + 999);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  } else if (spec.mode === "groups") {
    if (!spec.groupIds.length) return [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("recipient_group_members")
        .select(`recipients!inner(${cols})`)
        .in("group_id", spec.groupIds)
        .range(from, from + 999);
      const page = (data ?? []).map((r) => r.recipients as unknown as (typeof rows)[number]);
      rows.push(...page);
      if (!data || data.length < 1000) break;
    }
  } else {
    if (!spec.emails.length) return [];
    await supabase
      .from("recipients")
      .upsert(spec.emails.map((email) => ({ site_id: siteId, email, source: "manual" })), {
        onConflict: "site_id,email",
        ignoreDuplicates: true,
      });
    for (let i = 0; i < spec.emails.length; i += 500) {
      const { data } = await supabase
        .from("recipients")
        .select(cols)
        .eq("site_id", siteId)
        .in("email", spec.emails.slice(i, i + 500));
      rows.push(...(data ?? []));
    }
  }

  const seen = new Set<string>();
  rows = rows.filter((r) => r.status === "subscribed" && !seen.has(r.id) && seen.add(r.id));
  return rows.map((r) => ({ recipient_id: r.id, email: r.email, name: r.name, unsub_token: r.unsub_token }));
}

export async function getSettings(supabase: SupabaseClient, siteId: string): Promise<SenderSettings> {
  const { data } = await supabase
    .from("newsletter_settings")
    .select("from_name, reply_to, footer_text, logo_url, accent_color, brand_context")
    .eq("site_id", siteId)
    .maybeSingle();
  return {
    from_name: data?.from_name ?? "",
    reply_to: data?.reply_to ?? "",
    footer_text: data?.footer_text ?? "",
    logo_url: data?.logo_url ?? "",
    accent_color: data?.accent_color ?? "#2f5d8a",
    brand_context: data?.brand_context ?? "",
  };
}

export async function createCampaign(
  supabase: SupabaseClient,
  nl: Newsletter,
  settings: SenderSettings,
  targets: Target[],
  audience: AudienceSpec,
  scheduledAt: Date | null,
  type: "initial" | "resend" = "initial",
) {
  const html = renderNewsletter(nl, settings, { placeholders: true, siteUrl: siteUrl() });
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      site_id: nl.site_id,
      newsletter_id: nl.id,
      type,
      subject: nl.subject || nl.title,
      html,
      from_name: settings.from_name,
      reply_to: settings.reply_to,
      audience,
      total: targets.length,
      status: scheduledAt ? "scheduled" : "queued",
      scheduled_at: scheduledAt?.toISOString() ?? null,
    })
    .select("id")
    .single();
  if (error || !campaign) throw new Error("발송 작업을 만들지 못했어요.");

  for (let i = 0; i < targets.length; i += 1000) {
    const { error: logError } = await supabase.from("send_logs").insert(
      targets.slice(i, i + 1000).map((t) => ({
        campaign_id: campaign.id,
        site_id: nl.site_id,
        recipient_id: t.recipient_id,
        email: t.email,
        name: t.name,
        unsub_token: t.unsub_token,
      })),
    );
    if (logError) {
      await supabase.from("campaigns").delete().eq("id", campaign.id);
      throw new Error("발송 대상을 저장하지 못했어요.");
    }
  }

  await supabase.from("newsletters").update({ status: scheduledAt ? "scheduled" : "sending" }).eq("id", nl.id);
  return campaign.id as string;
}

async function refreshCounts(supabase: SupabaseClient, campaignId: string) {
  const count = async (status: string) =>
    (await supabase.from("send_logs").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", status))
      .count ?? 0;
  const [sent, failed, queued] = await Promise.all([count("sent"), count("failed"), count("queued")]);
  await supabase.from("campaigns").update({ sent, failed }).eq("id", campaignId);
  return { sent, failed, queued };
}

/**
 * Sends queued emails of one campaign in batches of 100 until done or the time budget runs out.
 * Safe to call repeatedly (from the progress screen or from cron).
 */
export async function processCampaign(supabase: SupabaseClient, campaignId: string, budgetMs = 20000) {
  const started = Date.now();
  const { data: c } = await supabase
    .from("campaigns")
    .select("id, newsletter_id, subject, html, from_name, reply_to, status, scheduled_at, started_at")
    .eq("id", campaignId)
    .single();
  if (!c) return null;
  if (c.status === "scheduled" && c.scheduled_at && new Date(c.scheduled_at) <= new Date()) {
    c.status = "queued";
  }
  if (c.status !== "queued" && c.status !== "sending") return refreshCounts(supabase, campaignId);

  if (c.status === "queued") {
    await supabase
      .from("campaigns")
      .update({ status: "sending", started_at: c.started_at ?? new Date().toISOString() })
      .eq("id", campaignId);
    await supabase.from("newsletters").update({ status: "sending" }).eq("id", c.newsletter_id);
  }

  while (Date.now() - started < budgetMs) {
    const { data: batch } = await supabase
      .from("send_logs")
      .select("id, email, name, unsub_token, recipient_id")
      .eq("campaign_id", campaignId)
      .eq("status", "queued")
      .order("id")
      .limit(100);
    if (!batch?.length) break;

    const errors = await sendBatch(
      batch.map((r) => {
        const unsub = r.unsub_token ? unsubscribeUrl(r.unsub_token) : `${siteUrl()}/`;
        return {
          to: r.email,
          subject: c.subject,
          html: personalize(c.html, r.name, unsub),
          fromName: c.from_name,
          replyTo: c.reply_to || undefined,
          unsubscribeUrl: r.unsub_token ? `${siteUrl()}/api/unsubscribe/${r.unsub_token}` : undefined,
        };
      }),
    ).catch((e: Error) => batch.map(() => e.message));

    const now = new Date().toISOString();
    const sentIds = batch.filter((_, i) => !errors[i]).map((r) => r.id);
    if (sentIds.length) {
      await supabase.from("send_logs").update({ status: "sent", sent_at: now }).in("id", sentIds);
      const recipientIds = batch.filter((_, i) => !errors[i]).map((r) => r.recipient_id).filter(Boolean);
      if (recipientIds.length) await supabase.from("recipients").update({ last_sent_at: now }).in("id", recipientIds);
    }
    // Group failures by message so each distinct error is one update.
    const failed = new Map<string, number[]>();
    batch.forEach((r, i) => {
      const err = errors[i];
      if (err) failed.set(err, [...(failed.get(err) ?? []), r.id]);
    });
    for (const [err, ids] of failed) {
      await supabase.from("send_logs").update({ status: "failed", error: err.slice(0, 250), sent_at: now }).in("id", ids);
    }
    // Stay under Resend's default rate limit (2 requests per second).
    if (mailProvider() === "resend") await new Promise((r) => setTimeout(r, 600));
  }

  const counts = await refreshCounts(supabase, campaignId);
  if (counts.queued === 0) {
    const finished = new Date().toISOString();
    await supabase.from("campaigns").update({ status: "done", finished_at: finished }).eq("id", campaignId);
    await supabase
      .from("newsletters")
      .update({ status: counts.sent > 0 ? "sent" : "failed", sent_at: finished })
      .eq("id", c.newsletter_id);
  }
  return counts;
}
