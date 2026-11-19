"use server";

import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/slug";

// Password change (signed in), reset mail (signed out) and setting a new password from the reset link.

export type PasswordState = { error?: string; ok?: boolean; message?: string; sentTo?: string };

function checkNewPassword(formData: FormData): { password: string } | { error: string } {
  const password = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (password.length < 8) return { error: "새 비밀번호는 8자 이상이어야 해요." };
  if (password !== confirm) return { error: "새 비밀번호와 확인이 서로 달라요." };
  return { password };
}

function updateError(message: string) {
  if (/different from the old|same.*password|should be different/i.test(message)) return "지금 쓰는 비밀번호와 다른 비밀번호를 입력해주세요.";
  if (/weak|at least/i.test(message)) return "더 안전한 비밀번호를 입력해주세요.";
  return "비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 시도해주세요.";
}

/** 마이 프로필: check the current password, then set the new one. */
export async function changePassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const { supabase, user } = await requireUser();
  const current = String(formData.get("current_password") ?? "");
  const next = checkNewPassword(formData);
  if ("error" in next) return next;
  if (!user.email) return { error: "이메일 계정에서만 비밀번호를 바꿀 수 있어요." };

  const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (wrong) return { error: "현재 비밀번호가 올바르지 않아요." };

  const { error } = await supabase.auth.updateUser({ password: next.password });
  if (error) return { error: updateError(error.message) };
  return { ok: true, message: "비밀번호를 바꿨어요." };
}

/** 로그인 화면: send a reset link. The answer is the same whether or not the address has an account. */
export async function requestPasswordReset(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "이메일 주소를 확인해주세요." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error && /rate limit|too many|security purposes/i.test(error.message)) {
    return { error: "잠시 뒤 다시 시도해주세요. 재설정 메일은 짧은 시간에 여러 번 보낼 수 없어요." };
  }
  return { sentTo: email };
}

/** True when a reset mail went out within the last hour, so /reset-password can't skip the current-password check. */
export async function recentRecovery(recoverySentAt?: string | null) {
  return !!recoverySentAt && Date.now() - new Date(recoverySentAt).getTime() < 60 * 60 * 1000;
}

/** /reset-password: the reset link signed the person in; set the new password. */
export async function setNewPassword(_: PasswordState, formData: FormData): Promise<PasswordState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await recentRecovery(user.recovery_sent_at))) {
    return { error: "재설정 링크가 만료됐어요. 로그인 화면에서 재설정 메일을 다시 받아주세요." };
  }
  const next = checkNewPassword(formData);
  if ("error" in next) return next;
  const { error } = await supabase.auth.updateUser({ password: next.password });
  if (error) return { error: updateError(error.message) };
  redirect("/dashboard");
}
