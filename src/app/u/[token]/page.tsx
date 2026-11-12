import { createClient } from "@/lib/supabase/server";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata = { title: "뉴스레터 수신 설정", robots: { index: false } };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = UUID.test(token) ? await supabase.rpc("unsubscribe_info", { p_token: token }) : { data: null };
  const info = (data as { email: string; status: string; sender: string }[] | null)?.[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        {!info ? (
          <>
            <h1 className="text-xl font-bold">링크를 확인할 수 없어요</h1>
            <p className="mt-2 text-sm text-slate-600">수신거부 링크가 올바르지 않거나 만료되었어요.</p>
          </>
        ) : (
          <UnsubscribeButton token={token} email={info.email} sender={info.sender} subscribed={info.status === "subscribed"} />
        )}
      </div>
    </main>
  );
}
