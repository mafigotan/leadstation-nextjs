import { requireProfile } from "@/lib/supabase/server";
import { rootDomain, siteUrl, userUrl } from "@/lib/site";
import { HandleForm } from "@/components/handle-form";

export const metadata = { title: "계정 | LEADstation" };

export default async function AccountPage() {
  const { user, profile } = await requireProfile();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">계정</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">{user.email}</p>
      <div className="card space-y-4 p-6">
        <div>
          <p className="text-sm font-medium">내 페이지</p>
          <a href={userUrl(profile.handle)} target="_blank" className="text-sm text-indigo-600 hover:underline">{userUrl(profile.handle)}</a>
        </div>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          주소를 바꾸면 이미 공유한 프로모션 페이지 링크가 더 이상 열리지 않아요.
        </p>
        <HandleForm
          initialHandle={profile.handle}
          initialName={profile.display_name}
          rootDomain={rootDomain() ?? siteUrl().replace(/^https?:\/\//, "") + "/s"}
          submitLabel="저장"
        />
      </div>
    </div>
  );
}
