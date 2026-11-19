"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/visual-editor";
import { requestLimitIncrease } from "../actions";

const TEXT = {
  renewal: { button: "연장 문의", title: "이용 기간 연장 문의", placeholder: "예: 같은 요금제로 12개월 연장하고 싶어요." },
  plan_change: { button: "요금제 변경 문의", title: "요금제 변경 문의", placeholder: "예: 다음 달부터 PRO로 올리고 싶어요." },
} as const;

/** Sends a renewal or plan change request to the LEADstation team (same queue as limit requests). */
export function PlanRequestButton({ kind, primary, className = "" }: { kind: keyof typeof TEXT; primary?: boolean; className?: string }) {
  const t = TEXT[kind];
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>({});
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => { setResult({}); setOpen(true); }} className={`${primary ? "btn-primary" : "btn-secondary"} px-3 py-1.5 text-sm ${className}`}>
        {t.button}
      </button>
      {open && (
        <Modal title={t.title} onClose={() => setOpen(false)}>
          {result.ok ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">문의를 보냈어요. 운영팀이 연락드리고, 결제가 확인되면 바로 적용해드릴게요.</p>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>닫기</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-500">결제는 운영팀과 따로 진행해요. 원하는 요금제와 기간을 남겨주시면 운영팀이 연락드려요.</p>
              <div>
                <label className="label" htmlFor={`plan-msg-${kind}`}>메시지</label>
                <textarea id={`plan-msg-${kind}`} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} className="input" placeholder={t.placeholder} />
              </div>
              {result.error && <p className="text-red-600">{result.error}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="btn-primary" onClick={() => start(async () => setResult(await requestLimitIncrease([kind], message)))}>
                  {busy ? "보내는 중..." : "문의 보내기"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>취소</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
