"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { requestPasswordReset, type PasswordState } from "../reset-password/actions";

type Mode = "signin" | "signup" | "reset";

export function LoginForm({ site, initialMode = "signin" }: { site?: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // A fresh form per mode, so messages from one mode don't carry over to the other.
  if (mode === "reset") return <ResetForm setMode={setMode} />;
  return <AuthForm key={mode} mode={mode} setMode={setMode} site={site} />;
}

function ResetForm({ setMode }: { setMode: (m: Mode) => void }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(requestPasswordReset, {});

  if (state.sentTo) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-bold">재설정 메일을 보냈어요</h1>
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{state.sentTo}</span> 으로 가입된 계정이 있으면 비밀번호 재설정 링크가 도착해요.
          <br />
          메일의 링크를 누르면 새 비밀번호를 정할 수 있어요.
        </p>
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">메일이 보이지 않으면 스팸함을 확인해주세요.</p>
        <button type="button" className="btn-secondary w-full" onClick={() => setMode("signin")}>
          로그인 화면으로
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="mb-2">
        <h1 className="text-lg font-bold">비밀번호 재설정</h1>
        <p className="mt-1 text-sm text-slate-500">가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내드려요.</p>
      </div>
      <div>
        <label className="label" htmlFor="reset-email">이메일</label>
        <input id="reset-email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "보내는 중..." : "재설정 메일 받기"}
      </button>
      <p className="text-center text-sm text-slate-500">
        <button type="button" className="font-medium text-indigo-600 hover:underline" onClick={() => setMode("signin")}>
          로그인으로 돌아가기
        </button>
      </p>
    </form>
  );
}

function AuthForm({ mode, setMode, site }: { mode: Mode; setMode: (m: Mode) => void; site?: string }) {
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
      {site && <input type="hidden" name="site" value={site} />}
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
        {!signup && (
          <button type="button" className="mt-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:underline" onClick={() => setMode("reset")}>
            비밀번호를 잊으셨나요?
          </button>
        )}
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
