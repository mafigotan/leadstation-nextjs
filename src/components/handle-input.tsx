"use client";

import { useEffect, useState } from "react";
import { checkHandle } from "@/app/welcome/actions";

/** Site address field with a live duplicate check and a notice of the address that will be created. */
export function HandleInput({
  initial = "",
  rootDomain,
  currentSiteId,
  notice = "사이트가 생성돼요",
}: {
  initial?: string;
  rootDomain: string;
  currentSiteId?: string;
  notice?: string;
}) {
  const [handle, setHandle] = useState(initial);
  const [check, setCheck] = useState<{ ok: boolean; message: string; for: string } | null>(null);

  useEffect(() => {
    if (!handle || (currentSiteId && handle === initial)) return;
    const t = setTimeout(async () => {
      try {
        const r = await checkHandle(handle, currentSiteId);
        setCheck({ ...r, for: handle });
      } catch {
        setCheck(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [handle, currentSiteId, initial]);

  const result = check?.for === handle ? check : null;
  const address = `${handle || "mycompany"}.${rootDomain}`;

  return (
    <div>
      <label className="label" htmlFor="handle">내 사이트 주소</label>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
        <span className="pl-3 text-sm text-slate-400">https://</span>
        <input
          id="handle"
          name="handle"
          required
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          maxLength={30}
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-right text-sm font-semibold focus:outline-none"
          placeholder="mycompany"
        />
        <span className="pr-3 text-sm text-slate-500">.{rootDomain}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">영문 소문자, 숫자, 하이픈(-) 3~30자.</p>
      <div className={`mt-2 rounded-lg p-3 text-sm ${result && !result.ok ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-800"}`}>
        <p>
          <span className="font-semibold">{address}</span> {notice}
        </p>
        <p className="mt-0.5 text-xs opacity-80">프로모션 페이지와 블로그가 이 주소 아래에 공개돼요.</p>
        {result && <p className={`mt-1 text-xs font-medium ${result.ok ? "text-emerald-700" : ""}`}>{result.ok ? "✓ " : ""}{result.message}</p>}
      </div>
    </div>
  );
}
