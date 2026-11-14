import { requireSite } from "@/lib/supabase/server";
import { daysLeft, endsWithinTwoMonths, rootDomain, siteUrl, userUrl } from "@/lib/site";
import { MyInfoForm, SiteForm, MembersPanel, SiteSwitcher, type Member, type Invite } from "./forms";

export const metadata = { title: "마이 프로필 | LEADstation" };

export default async function ProfilePage() {
  const { supabase, user, profile, site, role, memberships } = await requireSite();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.rpc("site_member_list", { p_site: site.id }),
    role === "admin"
      ? supabase.from("site_invites").select("id, email, role, created_at").eq("site_id", site.id).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const isAdmin = role === "admin";
  const left = daysLeft(site.active_until);
  const soon = endsWithinTwoMonths(site.active_until);
  const { data: payments } = isAdmin
    ? await supabase.from("site_payments").select("id, paid_on, amount, method, period_from, period_to").eq("site_id", site.id).order("paid_on", { ascending: false }).limit(24)
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">마이 프로필</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
      </div>

      {memberships.length > 1 && (
        <SiteSwitcher current={site.id} sites={memberships.map((m) => ({ id: m.site.id, label: `${m.site.name || m.site.handle} (${m.role === "admin" ? "관리자" : "사용자"})` }))} />
      )}

      <section className="card p-6">
        <h2 className="mb-4 font-bold">내 정보</h2>
        <MyInfoForm profile={profile} />
      </section>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">내 사이트</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isAdmin ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
            내 권한: {isAdmin ? "관리자" : "사용자"}
          </span>
        </div>
        <a href={userUrl(site.handle)} target="_blank" className="text-sm font-medium text-indigo-600 hover:underline">{userUrl(site.handle)}</a>
        {isAdmin ? (
          <div className="mt-4">
            <SiteForm site={site} rootDomain={rootDomain() ?? siteUrl().replace(/^https?:\/\//, "") + "/s"} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">사이트 이름: {site.name || "-"} · 사이트 주소는 관리자만 바꿀 수 있어요.</p>
        )}
      </section>

        <section className="card p-6">
          <h2 className="font-bold">서비스 이용 기간</h2>
          <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-slate-500">서비스 개시일</dt>
            <dd>{site.service_started_on ?? "-"}</dd>
            <dt className="text-slate-500">이용 기간</dt>
            <dd>
              {site.active_from || site.active_until ? `${site.active_from ?? "-"} ~ ${site.active_until ?? "-"}` : "기간 제한 없음"}
              {left !== null && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${soon ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {left === 0 ? "오늘 종료" : `${left}일 남음`}
                </span>
              )}
            </dd>
          </dl>
          {soon && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">이용 기간이 곧 끝나요. 계속 이용하려면 LEADstation 운영팀에 연장을 문의해주세요.</p>}
          {isAdmin && <h3 className="mb-2 mt-5 text-sm font-semibold">결제 내역</h3>}
          {!isAdmin ? null : payments?.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="py-1.5 font-medium">결제일</th><th className="py-1.5 text-right font-medium">금액</th><th className="py-1.5 pl-4 font-medium">이용 기간</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5">{p.paid_on}</td>
                    <td className="py-1.5 text-right">{Number(p.amount).toLocaleString("ko-KR")}원</td>
                    <td className="py-1.5 pl-4 text-slate-600">{p.period_from || p.period_to ? `${p.period_from ?? "-"} ~ ${p.period_to ?? "-"}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-400">결제 내역이 없어요.</p>
          )}
        </section>

      <section className="card p-6">
        <h2 className="font-bold">사이트 멤버</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          관리자와 사용자 모두 이 사이트의 프로모션 페이지, 리드, 글, 뉴스레터, 이미지를 함께 관리해요. 관리자는 사이트 주소와 멤버를 관리할 수 있어요.
        </p>
        <MembersPanel
          me={user.id}
          isAdmin={isAdmin}
          members={(members ?? []) as Member[]}
          invites={(invites ?? []) as Invite[]}
        />
      </section>
    </div>
  );
}
