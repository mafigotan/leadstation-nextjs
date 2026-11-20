"use client";

import { useRef, useState, useTransition } from "react";
import { sendApplicantMailTest } from "../actions";
import type { Section } from "@/lib/page-sections";
import { formFields } from "@/lib/lead-fields";
import type { PublicSite } from "@/lib/user-site";
import { DEFAULT_APPLICANT_MAIL, MAIL_VARS, applicantEmail, sampleNotice, type ApplicantMail } from "@/lib/lead-mail-template";

type Key = "subject" | "heading" | "body";

/** Settings for the thank-you email sent to the applicant, with a live preview and a test send. */
export function ApplicantMailSettings({ s, update, site, pageId, pageTitle }: { s: Section; update: (p: Partial<Section>) => void; site: PublicSite; pageId: string; pageTitle: string }) {
  const mail: ApplicantMail = s.mail ?? { enabled: true, subject: "", heading: "", body: "" };
  const set = (patch: Partial<ApplicantMail>) => update({ mail: { ...mail, ...patch } });
  const [focus, setFocus] = useState<Key>("body");
  const refs = { subject: useRef<HTMLInputElement>(null), heading: useRef<HTMLInputElement>(null), body: useRef<HTMLTextAreaElement>(null) };
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { fields } = formFields(s.fields, s.required);

  const preview = applicantEmail(sampleNotice(site, pageTitle, fields), site, mail);

  // Inserts a variable where the cursor is in the last focused box (or at the end when the box is still empty).
  const insert = (v: string) => {
    const el = refs[focus].current;
    const current = mail[focus] || DEFAULT_APPLICANT_MAIL[focus];
    const at = el && mail[focus] ? (el.selectionStart ?? current.length) : current.length;
    const next = current.slice(0, at) + v + current.slice(at);
    set({ [focus]: next } as Partial<ApplicantMail>);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + v.length, at + v.length);
    });
  };

  const box = (k: Key, label: string, rows?: number) => (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        {mail[k] && (
          <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => set({ [k]: "" } as Partial<ApplicantMail>)}>
            기본 문구로
          </button>
        )}
      </div>
      {rows ? (
        <textarea
          ref={refs.body}
          className="input min-h-32"
          rows={rows}
          value={mail.body}
          placeholder={DEFAULT_APPLICANT_MAIL.body}
          onFocus={() => setFocus(k)}
          onChange={(e) => set({ body: e.target.value })}
          disabled={!mail.enabled}
        />
      ) : (
        <input
          ref={k === "subject" ? refs.subject : refs.heading}
          className="input"
          value={mail[k]}
          placeholder={DEFAULT_APPLICANT_MAIL[k]}
          onFocus={() => setFocus(k)}
          onChange={(e) => set({ [k]: e.target.value } as Partial<ApplicantMail>)}
          disabled={!mail.enabled}
        />
      )}
    </div>
  );

  const test = () =>
    start(async () => {
      setMsg(null);
      try {
        const r = await sendApplicantMailTest(pageId, mail, fields);
        setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.ok ?? "보냈어요." });
      } catch (e) {
        console.error(e);
        setMsg({ ok: false, text: "테스트 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요." });
      }
    });

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={mail.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          신청자에게 안내 메일 보내기
        </label>
        <p className="text-xs leading-relaxed text-slate-500">
          신청서에 이메일이 있으면 접수 즉시 발송돼요. 비워 둔 칸은 기본 문구로 나가요. 신청 내용 표와 하단 기업 정보(마이 프로필)는 자동으로 붙어요.
        </p>
        {box("subject", "메일 제목")}
        {box("heading", "인사 제목")}
        {box("body", "본문", 6)}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">치환 문구 넣기</span>
          {MAIL_VARS.map((v) => (
            <button key={v} type="button" disabled={!mail.enabled} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}>
              {v}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">{"{이름}"}은 신청자 이름(없으면 &lsquo;고객&rsquo;), {"{프로모션명}"}은 관리용 제목, {"{사이트명}"}은 사이트 이름으로 바뀌어요.</p>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" disabled={pending || !mail.enabled} onClick={test}>
            {pending ? "보내는 중…" : "내 메일로 테스트 발송"}
          </button>
          {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
        <p className="text-xs text-amber-700">설정을 바꾼 뒤에는 편집기의 저장 버튼을 눌러야 실제 신청에 반영돼요.</p>
      </div>
      <div>
        <p className="mb-1 text-xs text-slate-500">미리보기 (예시 신청 내용)</p>
        <p className="mb-2 truncate rounded-md bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-400">제목 </span>
          {mail.enabled ? preview.subject : "보내지 않음"}
        </p>
        <iframe title="신청자 안내 메일 미리보기" srcDoc={preview.html} sandbox="" className={`h-[520px] w-full rounded-lg border border-slate-200 bg-slate-100 ${mail.enabled ? "" : "opacity-40"}`} />
      </div>
    </div>
  );
}
