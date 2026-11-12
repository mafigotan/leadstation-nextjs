import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// One-click unsubscribe (RFC 8058) from mail apps: POST to the URL in the List-Unsubscribe header.
export async function POST(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse(null, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  await supabase.rpc("set_subscription", { p_token: token, p_subscribed: false });
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/u/${encodeURIComponent(token)}`, request.url));
}
