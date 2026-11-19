import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SetNewPasswordForm } from "@/components/password-forms";
import { recentRecovery } from "./actions";

export const metadata = { title: "새 비밀번호 설정 | LEADstation" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only right after a reset mail; a normal session changes its password in 마이 프로필.
  const canReset = !!user && (await recentRecovery(user.recovery_sent_at));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-slate-900">
          LEAD<span className="text-indigo-600">station</span>
        </Link>
        <div className="card space-y-4 p-6">
          <div>
            <h1 className="text-lg font-bold">새 비밀번호 설정</h1>
            {canReset ? (
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{user?.email}</span> 계정의 새 비밀번호를 입력해주세요.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">재설정 링크가 만료됐거나 이미 사용됐어요. 로그인 화면에서 재설정 메일을 다시 받아주세요.</p>
            )}
          </div>
          {canReset ? <SetNewPasswordForm /> : <Link href="/login?reset=1" className="btn-primary w-full">재설정 메일 다시 받기</Link>}
        </div>
      </div>
    </main>
  );
}
