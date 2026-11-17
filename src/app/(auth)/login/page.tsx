import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HANDLE_RE } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인 | LEADstation" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const raw = String((await searchParams).site ?? "").toLowerCase();
  const site = HANDLE_RE.test(raw) ? raw : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(site ? `/auth/site-admin?site=${site}` : "/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-slate-900">
          LEAD<span className="text-indigo-600">station</span>
        </Link>
        <div className="card p-6">
          <LoginForm site={site} />
        </div>
      </div>
    </main>
  );
}
