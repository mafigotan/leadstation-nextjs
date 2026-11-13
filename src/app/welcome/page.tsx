import { redirect } from "next/navigation";
import { loadAccount, requireUser } from "@/lib/supabase/server";
import { rootDomain, siteUrl } from "@/lib/site";
import { WelcomeForm } from "./form";
import { cancelJoinRequest } from "./actions";

export const metadata = { title: "마이 프로필 | LEADstation" };

export default async function WelcomePage() {
  // Join any site this email was invited to before reading the account.
  const { supabase } = await requireUser();
  await supabase.rpc("accept_site_invites");
  const { supabase: db, user, profile, memberships } = await loadAccount();
  if (profile?.full_name && memberships.length) redirect("/dashboard");
  const { data: requests } = await db
    .from("site_join_requests")
    .select("id, status, sites(handle, name)")
    .eq("user_id", user.id)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false });
  const reqs = (requests ?? []) as unknown as { id: string; status: string; sites: { handle: string; name: string } | null }[];
  const suggestion = (user.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center text-2xl font-bold">
          LEAD<span className="text-indigo-600">station</span>
        </p>
        <div className="card p-6">
          <h1 className="text-lg font-bold">마이 프로필</h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">서비스를 시작하기 전에 회원 정보를 입력해주세요.</p>
          {reqs.map((r) => (
            <div key={r.id} className={`mb-4 rounded-lg p-3 text-sm ${r.status === "pending" ? "bg-indigo-50 text-indigo-800" : "bg-red-50 text-red-700"}`}>
              <p>
                <span className="font-semibold">{r.sites?.name || r.sites?.handle}</span>{" "}
                {r.status === "pending" ? "사이트 이용을 신청했어요. 관리자가 승인하면 바로 이용할 수 있어요." : "사이트 이용 신청이 거절됐어요."}
              </p>
              <form action={cancelJoinRequest.bind(null, r.id)} className="mt-1">
                <button className="text-xs underline opacity-80">{r.status === "pending" ? "신청 취소" : "닫기"}</button>
              </form>
            </div>
          ))}
          <WelcomeForm
            profile={profile}
            invitedTo={memberships.map((m) => m.site.name || m.site.handle)}
            suggestion={suggestion.length >= 3 ? suggestion : ""}
            rootDomain={rootDomain() ?? siteUrl().replace(/^https?:\/\//, "") + "/s"}
          />
        </div>
      </div>
    </main>
  );
}
