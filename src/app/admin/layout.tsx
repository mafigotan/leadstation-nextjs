import Link from "next/link";
import { requireSuperAdmin } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/login/actions";
import { AdminNav } from "./nav";

export const metadata = { title: "슈퍼 관리자 | LEADstation" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-bold">
              LEAD<span className="text-indigo-400">station</span> <span className="ml-1 rounded bg-indigo-500 px-1.5 py-0.5 text-xs">슈퍼 관리자</span>
            </Link>
            <AdminNav />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Link href="/dashboard" className="hover:underline">내 대시보드</Link>
            <span className="hidden sm:inline">{user.email}</span>
            <form action={signOut}>
              <button className="rounded-md border border-slate-600 px-3 py-1.5 hover:bg-slate-800">로그아웃</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
