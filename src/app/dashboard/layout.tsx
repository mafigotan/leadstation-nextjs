import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/login/actions";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold">
              LEAD<span className="text-indigo-600">station</span>
            </Link>
            <DashboardNav />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={signOut}>
              <button className="btn-secondary px-3 py-1.5">로그아웃</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
