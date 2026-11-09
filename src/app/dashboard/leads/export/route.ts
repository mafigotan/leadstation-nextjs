import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryLeads } from "@/lib/leads";

function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  const leads = await queryLeads(supabase, {
    pageId: params.get("page") ?? undefined,
    q: params.get("q") ?? undefined,
    limit: 10000,
  });

  const header = ["신청일", "이름", "이메일", "연락처", "문의 내용", "마케팅 동의", "페이지"];
  const rows = leads.map((l) => [
    new Date(l.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    l.name,
    l.email,
    l.phone,
    l.message,
    l.marketing_consent ? "동의" : "미동의",
    l.pages?.title,
  ]);
  // BOM so Excel opens Korean text correctly.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
