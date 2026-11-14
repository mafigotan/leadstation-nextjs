import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSuperAdmin, loadAccount } from "@/lib/supabase/server";
import { isSiteLive, siteBlockReason } from "@/lib/site";
import { signOut } from "@/app/(auth)/login/actions";

export const metadata = { title: "이용 제한 | LEADstation" };

async function switchToSite(siteId: string) {
  "use server";
  const { supabase, user, profile, memberships } = await loadAccount();
  if (profile?.suspended_at) return;
  const m = memberships.find((x) => x.site.id === siteId);
  if (!m || !isSiteLive(m.site)) return;
  await supabase.from("profiles").update({ active_site_id: siteId }).eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const REASONS = {
  inactive: "사이트가 비활성 상태예요.",
  not_started: "사이트 이용 기간이 아직 시작되지 않았어요.",
  expired: "사이트 이용 기간이 끝났어요.",
} as const;

export default async function BlockedPage() {
  const { supabase, profile, memberships } = await loadAccount();
  const superAdmin = await isSuperAdmin(supabase);
  const suspended = !!profile?.suspended_at;
  const current = memberships.find((m) => m.site.id === profile?.active_site_id) ?? memberships[0];
  const reason = current ? siteBlockReason(current.site) : null;
  if (!suspended && !reason) redirect("/dashboard");
  const others = suspended ? [] : memberships.filter((m) => m.site.id !== current?.site.id && isSiteLive(m.site));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center text-2xl font-bold">
          LEAD<span className="text-indigo-600">station</span>
        </p>
        <div className="card space-y-4 p-6">
          <h1 className="text-lg font-bold">{suspended ? "계정 이용이 정지됐어요" : "지금은 사이트를 이용할 수 없어요"}</h1>
          {suspended ? (
            <p className="text-sm text-slate-600">
              {profile?.suspended_reason ? `사유: ${profile.suspended_reason}` : "관리자에 의해 이용이 정지됐어요."}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{current?.site.name || current?.site.handle}</span> {reason && REASONS[reason]}
              {current?.site.active_until && reason === "expired" && ` (이용 종료일 ${current.site.active_until})`}
            </p>
          )}
          <p className="text-sm text-slate-500">이용을 계속하려면 LEADstation 운영팀에 문의해주세요.</p>
          {others.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">이용할 수 있는 다른 사이트</p>
              {others.map((m) => (
                <form key={m.site.id} action={switchToSite.bind(null, m.site.id)}>
                  <button className="btn-secondary w-full">{m.site.name || m.site.handle}로 이동</button>
                </form>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            {superAdmin && <Link href="/admin" className="btn-primary">슈퍼 관리자 화면</Link>}
            <form action={signOut}>
              <button className="btn-secondary">로그아웃</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
