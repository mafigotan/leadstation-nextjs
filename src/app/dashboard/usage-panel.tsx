"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/visual-editor";
import { requestLimitIncrease } from "./actions";

export type UsageItem = { kind: "newsletter" | "text" | "image"; used: number; limit_value: number | null };

const META = {
  newsletter: { label: "뉴스레터 발송", unit: "건" },
  text: { label: "AI 본문 생성", unit: "토큰" },
  image: { label: "AI 이미지 생성", unit: "토큰" },
} as const;

const pctOf = (u: UsageItem) => (u.limit_value ? Math.min(100, Math.round((u.used / u.limit_value) * 100)) : null);

/** This month's usage against the site's limits, with the "이용 한도 늘리기" request. */
export function UsagePanel({ usage, pending }: { usage: UsageItem[]; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>({});
  const [busy, start] = useTransition();
  const hot = usage.filter((u) => (pctOf(u) ?? 0) >= 90);

  const openModal = () => {
    setPicked(hot.length ? hot.map((u) => u.kind) : usage.filter((u) => u.limit_value !== null).map((u) => u.kind));
    setResult({});
    setOpen(true);
  };

  return (
    <section className={`card p-5 ${hot.length ? "border-red-200" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">이번 달 이용량</h2>
        {pending || result.ok ? (
          <span className="text-sm text-slate-500">한도 증설을 요청했어요. 운영팀이 확인 중이에요.</span>
        ) : (
          <button type="button" onClick={openModal} className={hot.length ? "btn-primary px-3 py-1.5 text-sm" : "btn-secondary px-3 py-1.5 text-sm"}>
            이용 한도 늘리기
          </button>
        )}
      </div>
      {hot.length > 0 && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {hot.map((u) => META[u.kind].label).join(", ")} 사용량이 이번 달 한도의 90%를 넘었어요. 한도를 다 쓰면 해당 기능을 쓸 수 없어요.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {usage.map((u) => {
          const pct = pctOf(u);
          const m = META[u.kind];
          return (
            <div key={u.kind}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{m.label}</span>
                <span className={pct !== null && pct >= 90 ? "font-semibold text-red-600" : "text-slate-500"}>{pct === null ? "무제한" : `${pct}%`}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${pct === null ? "bg-slate-300" : pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500"}`}
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {u.used.toLocaleString()} {u.limit_value !== null && `/ ${u.limit_value.toLocaleString()}`} {m.unit}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-400">매달 1일에 사용량이 초기화돼요.</p>

      {open && (
        <Modal title="이용 한도 늘리기" onClose={() => setOpen(false)}>
          {result.ok ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">요청을 보냈어요. 운영팀이 확인한 뒤 한도를 늘려드릴게요.</p>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>닫기</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-500">늘리고 싶은 항목을 고르면 LEADstation 운영팀에게 이메일로 요청이 전달돼요.</p>
              <div className="space-y-2">
                {usage.map((u) => (
                  <label key={u.kind} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={picked.includes(u.kind)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, u.kind] : picked.filter((k) => k !== u.kind))}
                    />
                    {META[u.kind].label}
                    <span className="text-xs text-slate-400">
                      ({u.used.toLocaleString()}{u.limit_value !== null ? ` / ${u.limit_value.toLocaleString()}` : ""} {META[u.kind].unit})
                    </span>
                  </label>
                ))}
              </div>
              <div>
                <label className="label" htmlFor="limit-msg">메시지 (선택)</label>
                <textarea id="limit-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} className="input" placeholder="예: 이번 달 캠페인이 많아 발송량을 2배로 늘리고 싶어요." />
              </div>
              {result.error && <p className="text-red-600">{result.error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !picked.length}
                  className="btn-primary"
                  onClick={() => start(async () => setResult(await requestLimitIncrease(picked, message)))}
                >
                  {busy ? "보내는 중..." : "요청 보내기"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>취소</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
