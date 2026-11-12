"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cancelCampaign, continueSend, previewAudience, resendFailed, startSend, type SendRequest } from "../../actions";

type Campaign = {
  id: string;
  type: string;
  total: number;
  sent: number;
  failed: number;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }) : "-";

const STATUS: Record<string, string> = {
  scheduled: "예약됨",
  queued: "대기 중",
  sending: "발송 중",
  done: "완료",
  canceled: "취소됨",
};

export function SendPanel({
  newsletterId,
  hasBody,
  subscribed,
  groups,
  campaigns,
  failedLogs,
}: {
  newsletterId: string;
  hasBody: boolean;
  subscribed: number;
  groups: { id: string; name: string; count: number }[];
  campaigns: Campaign[];
  failedLogs: Record<string, { email: string; error: string }[]>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<SendRequest["mode"]>("all");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [emails, setEmails] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: string[]; skipped: number } | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ id: string; total: number; sent: number; failed: number } | null>(null);

  const request = (): SendRequest => ({
    mode,
    groupIds,
    emails,
    scheduledAt: when === "later" && scheduledLocal ? new Date(scheduledLocal).toISOString() : null,
  });

  useEffect(() => setPreview(null), [mode, groupIds, emails]);

  // Keep sending a campaign that is already in progress when the page is opened.
  useEffect(() => {
    const running = campaigns.find((c) => c.status === "queued" || c.status === "sending");
    if (running && !progress) void drive(running.id, running.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function drive(campaignId: string, total: number) {
    setProgress({ id: campaignId, total, sent: 0, failed: 0 });
    for (let i = 0; i < 500; i++) {
      const counts = await continueSend(campaignId);
      if (!counts) break;
      setProgress({ id: campaignId, total, sent: counts.sent, failed: counts.failed });
      if (counts.queued === 0) break;
    }
    setProgress(null);
    setMessage({ kind: "ok", text: "발송을 마쳤어요." });
    router.refresh();
  }

  async function check() {
    setBusy(true);
    setPreview(await previewAudience(request()));
    setBusy(false);
  }

  async function send() {
    const target = preview?.count ?? 0;
    const label = when === "later" ? `${new Date(scheduledLocal).toLocaleString("ko-KR")}에 예약` : "지금 발송";
    if (!confirm(`${target ? `${target}명에게 ` : ""}${label}할까요?`)) return;
    setBusy(true);
    setMessage(null);
    const res = await startSend(newsletterId, request());
    setBusy(false);
    if (res.error) return setMessage({ kind: "error", text: res.error });
    if (res.scheduled) {
      setMessage({ kind: "ok", text: `${res.total}명에게 예약했어요.` });
      router.refresh();
    } else {
      await drive(res.campaignId!, res.total!);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className={`rounded-lg px-4 py-2 text-sm ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      {progress && (
        <div className="card p-5">
          <p className="font-medium">발송 중이에요. 이 화면을 닫지 말아주세요.</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress.total ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {progress.sent + progress.failed} / {progress.total} (실패 {progress.failed})
          </p>
        </div>
      )}

      {!progress && (
        <section className="card space-y-5 p-6">
          <div>
            <h2 className="mb-3 font-semibold">받는 사람</h2>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /> 구독 중인 전체 수신자 ({subscribed}명)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "groups"} onChange={() => setMode("groups")} /> 그룹 선택
              </label>
              {mode === "groups" && (
                <div className="ml-6 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {groups.length === 0 && <p className="text-slate-500">그룹이 없어요. 수신자 메뉴에서 만들 수 있어요.</p>}
                  {groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={groupIds.includes(g.id)}
                        onChange={(e) => setGroupIds(e.target.checked ? [...groupIds, g.id] : groupIds.filter((x) => x !== g.id))}
                      />
                      {g.name} <span className="text-slate-400">({g.count})</span>
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "emails"} onChange={() => setMode("emails")} /> 직접 입력
              </label>
              {mode === "emails" && (
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  rows={4}
                  className="input ml-6 w-[calc(100%-1.5rem)]"
                  placeholder="이메일 주소를 쉼표, 줄바꿈, 공백으로 구분해 입력하세요. 입력한 주소는 수신자 목록에 저장돼요."
                />
              )}
            </div>
            <button type="button" onClick={check} disabled={busy} className="btn-secondary mt-3">발송 대상 확인</button>
            {preview && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium">실제 발송 대상 {preview.count}명{preview.skipped ? ` (수신거부 ${preview.skipped}명 제외)` : ""}</p>
                {preview.sample.length > 0 && (
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {preview.sample.join(", ")}
                    {preview.count > preview.sample.length ? " 외" : ""}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-semibold">발송 시점</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> 지금 보내기
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={when === "later"} onChange={() => setWhen("later")} /> 예약
              </label>
              {when === "later" && (
                <input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} className="input w-auto" />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={send}
            disabled={busy || !hasBody || (when === "later" && !scheduledLocal)}
            className="btn-primary w-full py-3"
          >
            {when === "later" ? "예약하기" : "지금 발송하기"}
          </button>
          {!hasBody && <p className="text-center text-sm text-red-600">본문이 비어 있어요. 먼저 뉴스레터를 작성해 주세요.</p>}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">발송 기록</h2>
        {campaigns.length === 0 ? (
          <p className="card p-6 text-center text-sm text-slate-500">아직 발송 기록이 없어요.</p>
        ) : (
          <div className="card divide-y divide-slate-100">
            {campaigns.map((c) => (
              <div key={c.id} className="px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{STATUS[c.status] ?? c.status}</span>
                    {c.type === "resend" && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs">재발송</span>}
                    <span className="ml-2 text-slate-500">
                      {c.status === "scheduled" ? `예약: ${fmt(c.scheduled_at)}` : `시작: ${fmt(c.started_at ?? c.created_at)}`}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    대상 {c.total} · 성공 <b className="text-emerald-700">{c.sent}</b> · 실패 <b className={c.failed ? "text-red-600" : ""}>{c.failed}</b>
                  </div>
                </div>
                <div className="mt-2 flex gap-3">
                  {c.status === "scheduled" && (
                    <button
                      className="text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm("예약을 취소할까요?")) return;
                        const r = await cancelCampaign(c.id);
                        if (r.error) setMessage({ kind: "error", text: r.error });
                        router.refresh();
                      }}
                    >
                      예약 취소
                    </button>
                  )}
                  {c.status === "done" && c.failed > 0 && (
                    <button
                      className="text-indigo-600 hover:underline"
                      onClick={async () => {
                        if (!confirm(`실패한 ${c.failed}명에게 다시 보낼까요?`)) return;
                        const r = await resendFailed(c.id);
                        if (r.error) return setMessage({ kind: "error", text: r.error });
                        await drive(r.campaignId!, r.total!);
                      }}
                    >
                      실패한 수신자에게 재발송
                    </button>
                  )}
                </div>
                {failedLogs[c.id]?.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-slate-500">실패 내역 보기</summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {failedLogs[c.id].map((l, i) => (
                        <li key={i}>
                          {l.email} — {l.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
