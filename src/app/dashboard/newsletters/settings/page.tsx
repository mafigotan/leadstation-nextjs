import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getSettings } from "@/lib/newsletter/queue";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "발신 정보 | LEADstation" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const settings = await getSettings(supabase, user.id);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/newsletters" className="text-sm text-slate-500 hover:underline">← 뉴스레터 목록</Link>
      <h1 className="mt-1 text-2xl font-bold">발신 정보</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        뉴스레터의 보내는 사람, 회신 주소, 머리글과 푸터에 쓰여요. 메일은 {process.env.MAIL_FROM_ADDRESS || "(MAIL_FROM_ADDRESS 미설정)"} 주소로 발송돼요.
      </p>
      <SettingsForm settings={settings} defaultReplyTo={user.email ?? ""} />
    </div>
  );
}
