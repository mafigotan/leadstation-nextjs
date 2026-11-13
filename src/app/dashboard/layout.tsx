import Link from "next/link";
import { requireProfile } from "@/lib/supabase/server";
import { userUrl } from "@/lib/site";
import { signOut } from "@/app/(auth)/login/actions";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireProfile();

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
            <a href={userUrl(profile.handle)} target="_blank" className="hidden font-medium text-indigo-600 hover:underline md:inline">
              {userUrl(profile.handle).replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
            <Link href="/dashboard/account" className="hidden hover:underline sm:inline">{user.email}</Link>
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
