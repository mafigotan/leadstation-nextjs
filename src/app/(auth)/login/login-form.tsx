"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

type Mode = "signin" | "signup";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  // A fresh form per mode, so messages from one mode don't carry over to the other.
  return <AuthForm key={mode} mode={mode} setMode={setMode} />;
}

function AuthForm({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    {},
  );
  const signup = mode === "signup";

  // After sign-up: tell the person to open the confirmation link in their inbox.
  if (signup && state.sentTo) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl" aria-hidden>✉️</div>
        <h1 className="text-lg font-bold">확인 메일을 보냈어요</h1>
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{state.sentTo}</span> 으로 회원가입 확인 링크를 보냈어요.
          <br />
          메일의 <span className="font-semibold">링크를 클릭하면 회원가입이 완료</span>돼요.
        </p>
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          메일이 보이지 않으면 스팸함을 확인해주세요. 링크를 누른 뒤에는 이 화면에서 로그인하면 돼요.
        </p>
        <button type="button" className="btn-secondary w-full" onClick={() => setMode("signin")}>
          로그인 화면으로
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="mb-2">
        <h1 className="text-lg font-bold">{signup ? "회원가입" : "로그인"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {signup
            ? "회원가입을 진행해요. 이메일과 비밀번호를 입력하면, 입력한 이메일로 회원가입 확인 링크를 보내드려요."
            : "이메일과 비밀번호로 로그인하세요."}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={signup ? 8 : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          className="input"
        />
        {signup && <p className="mt-1 text-xs text-slate-500">8자 이상 입력해주세요.</p>}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "처리 중..." : signup ? "회원가입" : "로그인"}
      </button>
      <p className="text-center text-sm text-slate-500">
        {signup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}{" "}
        <button
          type="button"
          className="font-medium text-indigo-600 hover:underline"
          onClick={() => setMode(signup ? "signin" : "signup")}
        >
          {signup ? "로그인" : "회원가입"}
        </button>
      </p>
    </form>
  );
}
