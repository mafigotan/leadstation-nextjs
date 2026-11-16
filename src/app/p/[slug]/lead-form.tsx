"use client";

import { useActionState, useEffect, useState } from "react";
import { submitLead, type LeadState } from "./actions";
import { THEME_CLASSES, type Theme } from "@/lib/types";
import { EVENT_MESSAGE } from "@/lib/event-game";
import { GENDERS, LEAD_FIELD_LABEL, formFields, type LeadField } from "@/lib/lead-fields";
import type { ShownTerm } from "@/lib/terms";

/** Read-only field that shows the game result reported by the event element. */
export function EventField({ value }: { value: string }) {
  return (
    <div>
      <span className="label">이벤트 *</span>
      <input type="hidden" name="event" value={value} />
      <div className={`rounded-lg border px-3 py-2 text-sm ${value ? "border-slate-300 bg-white font-medium" : "border-dashed border-slate-300 bg-slate-50 text-slate-400"}`}>
        {value || "위 이벤트에 참여하면 결과가 자동으로 입력돼요. (필수)"}
      </div>
    </div>
  );
}

export function LeadFormFields({ fields: chosen, required: chosenRequired, disabled }: { fields?: LeadField[]; required?: LeadField[]; disabled?: boolean }) {
  const { fields, required } = formFields(chosen, chosenRequired);
  const legacy = !chosen?.length;
  return (
    <>
      {fields.map((f) => {
        const req = required.includes(f);
        const label = (f === "message" && legacy ? "문의 내용" : f === "phone" && legacy ? "연락처" : LEAD_FIELD_LABEL[f]) + (req ? " *" : "");
        const common = { id: `lead-${f}`, name: f, required: req, disabled, className: "input" };
        return (
          <div key={f}>
            <label className="label" htmlFor={common.id}>{label}</label>
            {f === "name" && <input {...common} maxLength={100} autoComplete="name" />}
            {f === "email" && <input {...common} type="email" maxLength={200} autoComplete="email" />}
            {f === "phone" && <input {...common} type="tel" maxLength={50} autoComplete="tel" placeholder="010-0000-0000" />}
            {f === "address" && <input {...common} maxLength={300} autoComplete="street-address" />}
            {f === "gender" && (
              <select {...common} defaultValue="">
                <option value="" disabled={req}>선택해 주세요</option>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            )}
            {f === "age" && <input {...common} type="number" min={0} max={150} inputMode="numeric" />}
            {f === "nationality" && <input {...common} maxLength={100} placeholder="예: 대한민국" />}
            {f === "message" && <textarea {...common} rows={3} maxLength={2000} />}
          </div>
        );
      })}
    </>
  );
}

/** Checkboxes for the form's terms, with the full text of each in a sheet. */
function TermsConsent({ terms, agreeAll, accent }: { terms: ShownTerm[]; agreeAll: boolean; accent: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<ShownTerm | null>(null);
  const all = terms.every((t) => checked[t.version_id]);
  const set = (id: string, v: boolean) => setChecked((c) => ({ ...c, [id]: v }));
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600">
      <input type="hidden" name="terms_shown" value={terms.map((t) => t.version_id).join(",")} />
      {agreeAll && (
        <label className="flex min-h-11 items-center gap-2 border-b border-slate-100 font-semibold text-slate-800">
          <input type="checkbox" className="h-4 w-4" checked={all} onChange={(e) => setChecked(Object.fromEntries(terms.map((t) => [t.version_id, e.target.checked])))} />
          약관 전체 동의
        </label>
      )}
      {terms.map((t) => (
        <div key={t.version_id} className="flex min-h-11 items-center justify-between gap-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name={`term_${t.version_id}`}
              required={t.required}
              className="mt-1 h-4 w-4 shrink-0"
              checked={!!checked[t.version_id]}
              onChange={(e) => set(t.version_id, e.target.checked)}
            />
            <span>[{t.required ? "필수" : "선택"}] {t.label}</span>
          </label>
          {t.body && (
            <button type="button" className="shrink-0 py-2 text-xs text-slate-500 underline" onClick={() => setOpen(t)}>
              보기
            </button>
          )}
        </div>
      ))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center" role="dialog" aria-modal="true" aria-label={open.label} onClick={() => setOpen(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-900">{open.label}</p>
                <p className="text-xs text-slate-500">v{open.version}</p>
              </div>
              <button type="button" aria-label="닫기" className="px-2 text-xl text-slate-500" onClick={() => setOpen(null)}>✕</button>
            </div>
            <div className="overflow-y-auto whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-slate-700">{open.body}</div>
            <div className="border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                className={`w-full rounded-lg px-4 py-3 font-semibold text-white ${accent}`}
                onClick={() => {
                  set(open.version_id, true);
                  setOpen(null);
                }}
              >
                동의하고 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LeadForm({
  pageId,
  sectionId,
  fields,
  required,
  ctaLabel,
  theme,
  event,
  terms = [],
  agreeAll = false,
}: {
  pageId: string;
  sectionId?: string;
  fields?: LeadField[];
  required?: LeadField[];
  ctaLabel: string;
  theme: Theme;
  event?: boolean;
  terms?: ShownTerm[];
  agreeAll?: boolean;
}) {
  const [eventResult, setEventResult] = useState("");
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    if (!event) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; result?: unknown } | null;
      // Games run in sandboxed iframes, whose origin is "null".
      if (e.origin === "null" && d?.type === EVENT_MESSAGE && typeof d.result === "string") setEventResult((cur) => cur || d.result!.toString().slice(0, 200));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [event]);
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLead.bind(null, pageId, sectionId ?? ""), {});
  const t = THEME_CLASSES[theme] ?? THEME_CLASSES.indigo;
  const personal = formFields(fields).fields.filter((f) => f !== "message").map((f) => LEAD_FIELD_LABEL[f]);

  if (state.done) {
    return (
      <div className={`rounded-xl p-8 text-center ${t.soft}`}>
        <p className="text-lg font-semibold">신청이 완료되었어요!</p>
        <p className="mt-2 text-sm text-slate-600">곧 안내 드릴게요. 감사합니다.</p>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (event && !eventResult) {
          e.preventDefault();
          setLocalError("위 이벤트에 먼저 참여해 주세요.");
        } else setLocalError("");
      }}
      className="space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <LeadFormFields fields={fields} required={required} />
      {event && <EventField value={eventResult} />}
      {terms.length ? (
        <TermsConsent terms={terms} agreeAll={agreeAll} accent={t.bg} />
      ) : (
        <>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="privacy" required className="mt-1" />
            <span>[필수] 개인정보({personal.join(", ") || "입력한 정보"}) 수집 및 이용에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" name="marketing" className="mt-1" />
            <span>[선택] 이벤트 및 마케팅 정보 수신에 동의합니다.</span>
          </label>
        </>
      )}
      {(localError || state.error) && <p className="text-sm text-red-600">{localError || state.error}</p>}
      <button type="submit" disabled={pending} className={`w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-60 ${t.bg}`}>
        {pending ? "신청 중..." : ctaLabel}
      </button>
    </form>
  );
}
