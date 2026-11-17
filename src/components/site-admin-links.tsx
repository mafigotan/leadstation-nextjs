"use client";

// Footer links on the public user site: "관리자 로그인", or "관리자 페이지 · 로그아웃" when signed in.
// The session lives on the main domain, so the signed-in state comes from a marker cookie
// (see lib/auth-hint) and both actions run on the main domain.
import { useEffect, useState } from "react";

const HINT = "ls_signed_in";

export function SiteAdminLinks({ handle, mainUrl }: { handle: string; mainUrl: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [here, setHere] = useState("");
  useEffect(() => {
    setSignedIn(document.cookie.split("; ").some((c) => c === `${HINT}=1`));
    setHere(window.location.href);
  }, []);

  const adminHref = `${mainUrl}/auth/site-admin?site=${encodeURIComponent(handle)}`;
  const link = "font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline";

  if (!signedIn) {
    return <a href={adminHref} className={link}>관리자 로그인</a>;
  }
  return (
    <span className="flex items-center gap-2">
      <a href={adminHref} className={link}>관리자 페이지</a>
      <span aria-hidden className="text-slate-300">|</span>
      <form action={`${mainUrl}/auth/signout`} method="post" className="inline">
        <input type="hidden" name="next" value={here} />
        <button type="submit" className={link}>로그아웃</button>
      </form>
    </span>
  );
}
