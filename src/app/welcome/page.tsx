import { redirect } from "next/navigation";
import { loadAccount, requireUser } from "@/lib/supabase/server";
import { rootDomain, siteUrl } from "@/lib/site";
import { WelcomeForm } from "./form";

export const metadata = { title: "마이 프로필 | LEADstation" };

export default async function WelcomePage() {
  // Join any site this email was invited to before reading the account.
  const { supabase } = await requireUser();
  await supabase.rpc("accept_site_invites");
  const { user, profile, memberships } = await loadAccount();
  if (profile?.full_name && memberships.length) redirect("/dashboard");
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
