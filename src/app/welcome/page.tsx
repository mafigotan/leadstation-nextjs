import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { rootDomain, siteUrl } from "@/lib/site";
import { HandleForm } from "@/components/handle-form";

export const metadata = { title: "주소 만들기 | LEADstation" };

export default async function WelcomePage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (data) redirect("/dashboard");
  const suggestion = (user.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center text-2xl font-bold">
          LEAD<span className="text-indigo-600">station</span>
        </p>
        <div className="card p-6">
          <h1 className="text-lg font-bold">내 페이지 주소를 정해주세요</h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">만드는 프로모션 페이지는 이 주소로 공개돼요. 나중에 바꿀 수 있어요.</p>
          <HandleForm
            initialHandle={suggestion.length >= 3 ? suggestion : ""}
            rootDomain={rootDomain() ?? siteUrl().replace(/^https?:\/\//, "") + "/s"}
            submitLabel="시작하기"
          />
        </div>
      </div>
    </main>
  );
}
