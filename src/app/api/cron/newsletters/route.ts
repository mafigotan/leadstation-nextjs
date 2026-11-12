import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processCampaign } from "@/lib/newsletter/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends scheduled and unfinished campaigns. Call every minute with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });

  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("campaigns")
    .select("id")
    .or(`status.in.(queued,sending),and(status.eq.scheduled,scheduled_at.lte.${now})`)
    .order("created_at")
    .limit(10);

  const started = Date.now();
  const results: Record<string, unknown> = {};
  for (const c of due ?? []) {
    const left = 50000 - (Date.now() - started);
    if (left < 5000) break;
    results[c.id] = await processCampaign(supabase, c.id, left - 3000);
  }
  return NextResponse.json({ processed: results });
}

export const POST = GET;
