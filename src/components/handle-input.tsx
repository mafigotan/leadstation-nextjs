"use client";

import { useEffect, useState } from "react";
import { checkHandle } from "@/app/welcome/actions";

// Hangul typed with the Korean keyboard layout (두벌식) mapped back to the English keys that were pressed,
// so "ㅁㅠㅊ" or "뮻" becomes "abc" instead of being dropped.
const JAMO_KEYS =
  "r,R,rt,s,sw,sg,e,E,f,fr,fa,fq,ft,fx,fv,fg,a,q,Q,qt,t,T,d,w,W,c,z,x,v,g," +
  "k,o,i,O,j,p,u,P,h,hk,ho,hl,y,n,nj,np,nl,b,m,ml,l";
const JAMO = JAMO_KEYS.split(","); // U+3131 ㄱ … U+3163 ㅣ
const INITIAL = "r,R,s,e,E,f,a,q,Q,t,T,d,w,W,c,z,x,v,g".split(",");
const MEDIAL = JAMO.slice(30);
const FINAL = ",r,R,rt,s,sw,sg,e,f,fr,fa,fq,ft,fx,fv,fg,a,q,qt,t,T,d,w,c,z,x,v,g".split(",");

function hangulToKeys(text: string): string {
  let out = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const i = c - 0xac00;
      out += INITIAL[Math.floor(i / 588)] + MEDIAL[Math.floor((i % 588) / 28)] + FINAL[i % 28];
    } else if (c >= 0x3131 && c <= 0x3163) {
      out += JAMO[c - 0x3131];
    } else out += ch;
  }
  return out;
}

const HANGUL_RE = /[\u3131-\u3163\uac00-\ud7a3]/;

/** Site address field with a live duplicate check and a notice of the address that will be created. */
export function HandleInput({
  initial = "",
  rootDomain,
  currentSiteId,
  notice = "사이트가 생성돼요",
  label = "내 사이트 주소",
}: {
  initial?: string;
  rootDomain: string;
  currentSiteId?: string;
  notice?: string;
  label?: string;
}) {
  const [handle, setHandle] = useState(initial);
  const [korean, setKorean] = useState(false);
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
      <label className="label" htmlFor="handle">{label}</label>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
        <span className="pl-3 text-sm text-slate-400">https://</span>
        <input
          id="handle"
          name="handle"
          required
          value={handle}
          onChange={(e) => {
            const raw = e.target.value;
            setKorean(HANGUL_RE.test(raw));
            setHandle(hangulToKeys(raw).toLowerCase().replace(/[^a-z0-9-]/g, ""));
          }}
          lang="en"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={30}
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-right text-sm font-semibold focus:outline-none"
          placeholder="mycompany"
        />
        <span className="pr-3 text-sm text-slate-500">.{rootDomain}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">영문 소문자, 숫자, 하이픈(-) 3~30자.</p>
      {korean && <p className="mt-1 text-xs text-amber-700">한글 자판으로 입력돼서 영문으로 바꿔 넣었어요. 한/영 키를 눌러 영문으로 바꿔주세요.</p>}
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
