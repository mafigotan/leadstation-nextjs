import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";
import { activitySubject, activityVerb } from "@/lib/activity";
import { METHOD_LABEL, SiteStatus, Table, Th, UserStatus, fmtDate, fmtDateTime, won } from "../../ui";
import { SuspendForm } from "./suspend-form";

type Detail = {
  user_id: string; email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null;
  full_name: string; phone: string; company: string; suspended_at: string | null; suspended_reason: string; is_super_admin: boolean;
};
type SiteRow = { id: string; handle: string; name: string; status: string; active_from: string | null; active_until: string | null; service_started_on: string | null };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user: me } = await requireSuperAdmin();
  const { data } = await supabase.rpc("admin_user_detail", { p_user: id });
  const u = (data as Detail[] | null)?.[0];
  if (!u) notFound();

  const { data: ms } = await supabase
    .from("site_members")
    .select("role, created_at, sites(id, handle, name, status, active_from, active_until, service_started_on)")
    .eq("user_id", id);
  const memberships = ((ms ?? []) as unknown as { role: string; created_at: string; sites: SiteRow | null }[]).filter((m) => m.sites);
  const siteIds = memberships.map((m) => m.sites!.id);
  const [{ data: payments }, { data: logs }] = await Promise.all([
    siteIds.length
      ? supabase.from("site_payments").select("id, site_id, paid_on, amount, method, period_from, period_to, memo").in("site_id", siteIds).order("paid_on", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as { id: string; site_id: string; paid_on: string; amount: number; method: string; period_from: string | null; period_to: string | null; memo: string }[] }),
    supabase.from("activity_logs").select("id, action, target_type, title, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const handleOf = new Map(memberships.map((m) => [m.sites!.id, m.sites!.handle]));
  const firstStart = memberships.map((m) => m.sites!.service_started_on).filter(Boolean).sort()[0];

  const info: [string, React.ReactNode][] = [
    ["이름", u.full_name || "-"],
    ["이메일", u.email],
    ["전화번호", u.phone || "-"],
    ["회사명", u.company || "-"],
    ["가입일", fmtDateTime(u.created_at)],
    ["이메일 인증", u.email_confirmed_at ? fmtDateTime(u.email_confirmed_at) : "미인증"],
    ["최근 로그인", fmtDateTime(u.last_sign_in_at)],
    ["서비스 개시일", fmtDate(firstStart)],
    ["상태", <UserStatus key="s" suspended={!!u.suspended_at} />],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-slate-500 hover:underline">← 유저 목록</Link>
        <h1 className="mt-1 text-2xl font-bold">
          {u.full_name || u.email}
          {u.is_super_admin && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 align-middle text-xs text-indigo-700">슈퍼 관리자</span>}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">회원 정보</h2>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">이용 정지</h2>
          {u.suspended_at && (
            <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {fmtDateTime(u.suspended_at)}부터 정지{u.suspended_reason && ` · 사유: ${u.suspended_reason}`}
            </p>
          )}
          {u.user_id === me.id ? (
            <p className="text-sm text-slate-500">내 계정은 정지할 수 없어요.</p>
          ) : (
            <SuspendForm userId={u.user_id} suspended={!!u.suspended_at} />
          )}
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">소속 사이트</h2>
        <Table head={<><Th>사이트</Th><Th>권한</Th><Th>상태</Th><Th>서비스 개시일</Th><Th>이용 기간</Th><Th>합류일</Th></>}>
          {memberships.map((m) => (
            <tr key={m.sites!.id}>
              <td className="px-3 py-2">
                <Link href={`/admin/sites/${m.sites!.id}`} className="font-medium text-indigo-600 hover:underline">{m.sites!.name || m.sites!.handle}</Link>
                <a href={userUrl(m.sites!.handle)} target="_blank" className="ml-2 text-xs text-slate-400 hover:underline">{m.sites!.handle}</a>
              </td>
              <td className="px-3 py-2">{m.role === "admin" ? "관리자" : "사용자"}</td>
              <td className="px-3 py-2"><SiteStatus site={m.sites!} /></td>
              <td className="px-3 py-2">{fmtDate(m.sites!.service_started_on)}</td>
              <td className="whitespace-nowrap px-3 py-2">{fmtDate(m.sites!.active_from)} ~ {fmtDate(m.sites!.active_until)}</td>
              <td className="px-3 py-2 text-slate-500">{fmtDate(m.created_at)}</td>
            </tr>
          ))}
          {!memberships.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">소속된 사이트가 없어요.</td></tr>}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">결제 내역 <span className="text-sm font-normal text-slate-500">소속 사이트 기준</span></h2>
        <Table head={<><Th>결제일</Th><Th>사이트</Th><Th right>금액</Th><Th>방법</Th><Th>이용 기간</Th><Th>메모</Th></>}>
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap px-3 py-2">{p.paid_on}</td>
              <td className="px-3 py-2"><Link href={`/admin/sites/${p.site_id}`} className="hover:underline">{handleOf.get(p.site_id)}</Link></td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{won(p.amount)}</td>
              <td className="px-3 py-2">{METHOD_LABEL[p.method] ?? p.method}</td>
              <td className="whitespace-nowrap px-3 py-2">{p.period_from || p.period_to ? `${fmtDate(p.period_from)} ~ ${fmtDate(p.period_to)}` : "-"}</td>
              <td className="px-3 py-2 text-slate-600">{p.memo || "-"}</td>
            </tr>
          ))}
          {!payments?.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">결제 내역이 없어요.</td></tr>}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">최근 활동</h2>
        <div className="card divide-y divide-slate-100">
          {(logs ?? []).map((l) => (
            <p key={l.id} className="flex justify-between gap-3 px-4 py-2 text-sm">
              <span>{activitySubject(l)} {activityVerb(l)}</span>
              <span className="whitespace-nowrap text-xs text-slate-400">{fmtDateTime(l.created_at)}</span>
            </p>
          ))}
          {!logs?.length && <p className="px-4 py-6 text-center text-sm text-slate-400">활동 기록이 없어요.</p>}
        </div>
      </section>
    </div>
  );
}
