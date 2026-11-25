"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitContact, type ContactField, type ContactState } from "@/app/contact-actions";

// "문의하기" on the public service pages: a floating tab on the right edge and a modal form.
// Any <ContactOpenButton> (header menu, pricing contact band) opens the same modal.

const OPEN_EVENT = "leadstation:contact-open";
const PHONE = "02-2039-8430";

export function openContact() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function ContactOpenButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={openContact} className={className}>
      {children}
    </button>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function ContactWidget() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = () => {
      opener.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const close = () => {
    setOpen(false);
    opener.current?.focus?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={openContact}
        aria-haspopup="dialog"
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl bg-indigo-600 px-2 py-3 text-[13px] font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:gap-2 sm:px-3 sm:py-4 sm:text-[15px]"
      >
        <ChatIcon className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]" />
        <span className="tracking-[0.15em] [writing-mode:vertical-rl]">문의하기</span>
      </button>
      {open && (
        <ContactModal
          key={formKey}
          onClose={close}
          onDone={() => setFormKey((k) => k + 1)}
        />
      )}
    </>
  );
}

function ContactModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, {});
  const pathname = usePathname();
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialog.current) {
        const items = dialog.current.querySelectorAll<HTMLElement>("button, input, textarea, a[href]");
        const list = [...items].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
        if (!list.length) return;
        const [a, z] = [list[0], list[list.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const err = (k: ContactField) => state.fieldErrors?.[k];
  const input = (k: ContactField) =>
    `block w-full rounded-lg border px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
      err(k) ? "border-rose-400 focus:ring-rose-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100"
    }`;
  const label = "mb-1.5 block text-sm font-bold text-slate-700";
  const Err = ({ k }: { k: ContactField }) => (err(k) ? <p id={`contact-${k}-err`} className="mt-1 text-sm text-rose-600">{err(k)}</p> : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="contact-title" className="relative my-auto w-full max-w-[480px] rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 sm:right-5 sm:top-5">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13" /></svg>
        </button>

        {state.done ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
            </div>
            <h2 id="contact-title" className="text-xl font-bold text-slate-900">문의가 접수되었습니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              입력하신 연락처로 담당자가 연락드리겠습니다.
              <br />
              급하시면 대표전화 {PHONE}으로 전화 주세요.
            </p>
            <button
              type="button"
              onClick={() => { onDone(); onClose(); }}
              className="mt-6 h-11 w-full rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        ) : (
          <form action={action} noValidate>
            <div className="pr-10">
              <h2 id="contact-title" className="text-xl font-bold text-slate-900">도입 문의</h2>
              <p className="mt-1 text-sm text-slate-500">남겨 주시면 담당자가 빠르게 연락드립니다.</p>
            </div>
            <input type="hidden" name="page" value={pathname ?? ""} />
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>웹사이트<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="contact-name" className={label}>이름 <span className="text-rose-600">*</span></label>
                <input ref={first} id="contact-name" name="name" defaultValue={state.values?.name} autoComplete="name" placeholder="홍길동" maxLength={100} required aria-invalid={!!err("name")} aria-describedby={err("name") ? "contact-name-err" : undefined} className={input("name")} />
                <Err k="name" />
              </div>
              <div>
                <label htmlFor="contact-email" className={label}>이메일 <span className="text-rose-600">*</span></label>
                <input id="contact-email" name="email" defaultValue={state.values?.email} type="email" autoComplete="email" placeholder="name@company.com" maxLength={200} required aria-invalid={!!err("email")} aria-describedby={err("email") ? "contact-email-err" : undefined} className={input("email")} />
                <Err k="email" />
              </div>
              <div>
                <label htmlFor="contact-phone" className={label}>전화번호 <span className="text-rose-600">*</span></label>
                <input id="contact-phone" name="phone" defaultValue={state.values?.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" maxLength={50} required aria-invalid={!!err("phone")} aria-describedby={err("phone") ? "contact-phone-err" : undefined} className={input("phone")} />
                <Err k="phone" />
              </div>
              <div>
                <label htmlFor="contact-message" className={label}>문의내용 <span className="text-rose-600">*</span></label>
                <textarea id="contact-message" name="message" defaultValue={state.values?.message} rows={4} placeholder="궁금하신 점을 적어 주세요." maxLength={3000} required aria-invalid={!!err("message")} aria-describedby={err("message") ? "contact-message-err" : undefined} className={`${input("message")} resize-y`} />
                <Err k="message" />
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <input id="contact-agree" name="agree" type="checkbox" defaultChecked={state.values?.agree} className="h-4 w-4 rounded border-slate-400 accent-indigo-600" aria-invalid={!!err("agree")} />
                <label htmlFor="contact-agree">개인정보 수집·이용에 동의합니다</label>
                <button type="button" onClick={() => setShowTerms((v) => !v)} aria-expanded={showTerms} className="text-indigo-600 underline underline-offset-2">
                  {showTerms ? "접기" : "보기"}
                </button>
              </div>
              {showTerms && (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600">
                  수집 항목: 이름, 이메일, 전화번호, 문의내용
                  <br />
                  이용 목적: 도입 상담 및 문의 답변
                  <br />
                  보관 기간: 문의 접수일로부터 1년 후 파기
                  <br />
                  동의하지 않으실 수 있으며, 이 경우 문의를 접수할 수 없습니다. 대표전화 {PHONE}로도 문의하실 수 있습니다.
                </div>
              )}
              <Err k="agree" />
            </div>

            {state.error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{state.error}</p>}

            <button type="submit" disabled={pending} className="mt-5 h-12 w-full rounded-lg bg-indigo-600 text-[15px] font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              {pending ? "보내는 중…" : "신청하기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
