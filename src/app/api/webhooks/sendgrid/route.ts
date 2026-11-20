import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// SendGrid Event Webhook (Settings → Mail Settings → Event Webhook).
// URL: <site>/api/webhooks/sendgrid, with "Signed Event Webhook" on.
// Env: SENDGRID_WEBHOOK_PUBLIC_KEY = the verification key SendGrid shows after enabling signing.
//
// Newsletter mails carry custom_args { ls_log: send_logs.id, ls_cmp: campaigns.id, ls_rcpt: recipients.id } (see lib/newsletter/queue.ts).
// The log is matched on id AND campaign, so events from another environment sharing the SendGrid account never match.
// Events without them (lead notices, admin mails, tests) are ignored.
//   bounce (hard)  -> log failed, recipient 'bounced'
//   bounce blocked -> log failed (temporary; "resend to failed" may retry it)
//   dropped        -> log failed; recipient bounced / complained / unsubscribed when SendGrid says why
//   spamreport     -> recipient 'complained'
//   unsubscribe, group_unsubscribe -> recipient 'unsubscribed'
//   delivered      -> log delivery = delivered

type SgEvent = {
  event?: string;
  email?: string;
  timestamp?: number;
  type?: string; // bounce | blocked (for event = bounce)
  reason?: string;
  status?: string;
  ls_log?: string;
  ls_cmp?: string;
  ls_rcpt?: string;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

function b64(s: string) {
  const bin = atob(s.trim());
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DER ECDSA signature (SEQUENCE { INTEGER r, INTEGER s }) -> 64-byte r||s that WebCrypto expects. */
function derToRaw(der: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (der[0] !== 0x30) return null;
  let i = der[1] & 0x80 ? 2 + (der[1] & 0x7f) : 2;
  const out = new Uint8Array(new ArrayBuffer(64));
  for (let k = 0; k < 2; k++) {
    if (der[i++] !== 0x02) return null;
    let len = der[i++];
    let start = i;
    i += len;
    while (len > 32 && der[start] === 0) { start++; len--; }
    if (len > 32) return null;
    out.set(der.subarray(start, start + len), k * 32 + (32 - len));
  }
  return out;
}

async function verify(publicKey: string, signature: string, timestamp: string, body: Uint8Array) {
  try {
    const key = await crypto.subtle.importKey("spki", b64(publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const raw = derToRaw(b64(signature));
    if (!raw) return false;
    const ts = new TextEncoder().encode(timestamp);
    const payload = new Uint8Array(new ArrayBuffer(ts.length + body.length));
    payload.set(ts);
    payload.set(body, ts.length);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, payload);
  } catch {
    return false;
  }
}

function droppedStatus(reason: string): "bounced" | "complained" | "unsubscribed" | null {
  const r = reason.toLowerCase();
  if (r.includes("spam reporting")) return "complained";
  if (r.includes("unsubscribed")) return "unsubscribed";
  if (r.includes("bounced") || r.includes("invalid")) return "bounced";
  return null;
}

export async function POST(request: NextRequest) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  const body = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get("x-twilio-email-event-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp") ?? "";
  if (!signature || !timestamp || !(await verify(publicKey, signature, timestamp, body))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let events: SgEvent[];
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body));
    events = Array.isArray(parsed) ? parsed : [];
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "no service role" }, { status: 503 });

  const campaigns = new Set<string>();

  for (const e of events) {
    const campaignId = e.ls_cmp && UUID_RE.test(e.ls_cmp) ? e.ls_cmp : null;
    const logId = campaignId && e.ls_log && /^\d+$/.test(e.ls_log) ? e.ls_log : null;
    const rcptId = e.ls_rcpt && UUID_RE.test(e.ls_rcpt) ? e.ls_rcpt : null;
    if (!logId && !rcptId) continue;
    const at = new Date((e.timestamp ?? Date.now() / 1000) * 1000).toISOString();
    const reason = String(e.reason ?? e.status ?? "").slice(0, 200);

    let delivery: string | null = null;
    let failError: string | null = null;
    let rcptStatus: "bounced" | "complained" | "unsubscribed" | null = null;

    switch (e.event) {
      case "delivered":
        delivery = "delivered";
        break;
      case "bounce":
        if (e.type === "blocked") {
          delivery = "blocked";
          failError = `수신 서버 차단: ${reason}`;
        } else {
          delivery = "bounced";
          failError = `반송: ${reason}`;
          rcptStatus = "bounced";
        }
        break;
      case "dropped":
        delivery = "dropped";
        failError = `발송 제외: ${reason}`;
        rcptStatus = droppedStatus(reason);
        break;
      case "spamreport":
        delivery = "spamreport";
        rcptStatus = "complained";
        break;
      case "unsubscribe":
      case "group_unsubscribe":
        rcptStatus = "unsubscribed";
        break;
      default:
        continue;
    }

    if (logId && delivery) {
      let q = supabase
        .from("send_logs")
        .update({ delivery, delivery_at: at, ...(failError ? { status: "failed", error: failError.slice(0, 250) } : {}) })
        .eq("id", logId)
        .eq("campaign_id", campaignId!);
      // A late "delivered" must not overwrite a bounce or spam report.
      if (delivery === "delivered") q = q.in("delivery", ["", "delivered"]);
      const { data } = await q.select("campaign_id");
      if (failError) for (const r of data ?? []) campaigns.add(r.campaign_id as string);
    }

    if (rcptId && rcptStatus) {
      // Only change subscribed recipients: keep a status the user or an earlier event already set.
      await supabase
        .from("recipients")
        .update({ status: rcptStatus, status_reason: reason, unsubscribed_at: at })
        .eq("id", rcptId)
        .eq("status", "subscribed");
    }
  }

  // Keep the campaign totals on the send screen in step with the logs.
  for (const id of campaigns) {
    const count = async (status: string) =>
      (await supabase.from("send_logs").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", status)).count ?? 0;
    const [sent, failed] = await Promise.all([count("sent"), count("failed")]);
    await supabase.from("campaigns").update({ sent, failed }).eq("id", id);
  }

  return NextResponse.json({ ok: true, events: events.length });
}
