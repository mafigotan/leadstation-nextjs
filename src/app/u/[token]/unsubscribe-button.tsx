"use client";

import { useState, useTransition } from "react";
import { setSubscription } from "./actions";

export function UnsubscribeButton({ token, email, sender, subscribed: initial }: { token: string; email: string; sender: string; subscribed: boolean }) {
  const [subscribed, setSubscribed] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const toggle = (next: boolean) =>
    start(async () => {
      const r = await setSubscription(token, next);
      if (r.error) setError(r.error);
      else setSubscribed(next);
    });

  return (
    <>
      <h1 className="text-xl font-bold">{subscribed ? "뉴스레터 수신거부" : "수신거부되었어요"}</h1>
      <p className="mt-2 text-sm text-slate-600">
        <b>{email}</b>
        {subscribed ? ` 주소로 ${sender}의 뉴스레터를 그만 받으시겠어요?` : ` 주소로는 ${sender}의 뉴스레터가 더 이상 발송되지 않아요.`}
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {subscribed ? (
        <button onClick={() => toggle(false)} disabled={pending} className="btn-primary mt-6 w-full">
          {pending ? "처리 중..." : "수신거부"}
        </button>
      ) : (
        <button onClick={() => toggle(true)} disabled={pending} className="btn-secondary mt-6 w-full">
          {pending ? "처리 중..." : "실수로 눌렀어요, 다시 구독할게요"}
        </button>
      )}
    </>
  );
}
