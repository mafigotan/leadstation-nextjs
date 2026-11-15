"use client";

import { useActionState, useEffect, useState } from "react";
import { submitLead, type LeadState } from "./actions";
import { THEME_CLASSES, type Theme } from "@/lib/types";
import { EVENT_MESSAGE } from "@/lib/event-game";
import { GENDERS, LEAD_FIELD_LABEL, formFields, type LeadField } from "@/lib/lead-fields";

/** Read-only field that shows the game result reported by the event element. */
export function EventField({ value }: { value: string }) {
  return (
    <div>
      <span className="label">이벤트</span>
      <input type="hidden" name="event" value={value} />
      <div className={`rounded-lg border px-3 py-2 text-sm ${value ? "border-slate-300 bg-white font-medium" : "border-dashed border-slate-300 bg-slate-50 text-slate-400"}`}>
        {value || "위 이벤트에 참여하면 결과가 자동으로 입력돼요."}
      </div>
    </div>
  );
}

export function LeadFormFields({ fields: chosen, disabled }: { fields?: LeadField[]; disabled?: boolean }) {
  const { fields, required } = formFields(chosen);
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

export function LeadForm({ pageId, sectionId, fields, ctaLabel, theme, event }: { pageId: string; sectionId?: string; fields?: LeadField[]; ctaLabel: string; theme: Theme; event?: boolean }) {
  const [eventResult, setEventResult] = useState("");
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
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 p-6 shadow-sm">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <LeadFormFields fields={fields} />
      {event && <EventField value={eventResult} />}
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="privacy" required className="mt-1" />
        <span>[필수] 개인정보({personal.join(", ") || "입력한 정보"}) 수집 및 이용에 동의합니다.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="marketing" className="mt-1" />
        <span>[선택] 이벤트 및 마케팅 정보 수신에 동의합니다.</span>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={`w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-60 ${t.bg}`}>
        {pending ? "신청 중..." : ctaLabel}
      </button>
    </form>
  );
}
