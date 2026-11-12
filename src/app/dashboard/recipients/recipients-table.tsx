"use client";

import { useState, useTransition } from "react";
import { bulkAction } from "./actions";

type Row = {
  id: string;
  email: string;
  name: string;
  phone: string;
  company: string;
  status: string;
  source: string;
  last_sent_at: string | null;
  created_at: string;
  groups: string[];
};

const SOURCE: Record<string, string> = { manual: "직접", import: "가져오기", lead: "리드" };

export function RecipientsTable({ recipients, groups, total }: { recipients: Row[]; groups: { id: string; name: string }[]; total: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [groupId, setGroupId] = useState("");
  const [pending, start] = useTransition();
  const all = recipients.length > 0 && selected.length === recipients.length;

  const act = (action: Parameters<typeof bulkAction>[1]) => {
    if (action === "delete" && !confirm(`${selected.length}명을 삭제할까요? 발송 기록의 주소는 남아요.`)) return;
    if ((action === "add-group" || action === "remove-group") && !groupId) return alert("그룹을 먼저 골라주세요.");
    start(async () => {
      await bulkAction(selected, action, groupId);
      setSelected([]);
    });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">총 {total}명{selected.length ? ` · ${selected.length}명 선택` : ""}</span>
        {selected.length > 0 && (
          <>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="input w-auto py-1">
              <option value="">그룹 선택</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button disabled={pending} onClick={() => act("add-group")} className="btn-secondary py-1">그룹에 추가</button>
            <button disabled={pending} onClick={() => act("remove-group")} className="btn-secondary py-1">그룹에서 빼기</button>
            <button disabled={pending} onClick={() => act("unsubscribe")} className="btn-secondary py-1">수신거부 처리</button>
            <button disabled={pending} onClick={() => act("resubscribe")} className="btn-secondary py-1">구독으로 변경</button>
            <button disabled={pending} onClick={() => act("delete")} className="btn-danger py-1">삭제</button>
          </>
        )}
      </div>
      {recipients.length === 0 ? (
        <div className="card p-12 text-center text-slate-600">수신자가 없어요. 위에서 추가하거나 CSV로 가져와 주세요.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={all} onChange={(e) => setSelected(e.target.checked ? recipients.map((r) => r.id) : [])} aria-label="전체 선택" />
                </th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">회사 / 연락처</th>
                <th className="px-4 py-3 font-medium">그룹</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">최근 발송</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))}
                      aria-label={`${r.email} 선택`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{r.email}<span className="ml-1 text-xs font-normal text-slate-400">{SOURCE[r.source]}</span></td>
                  <td className="px-4 py-3">{r.name || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{[r.company, r.phone].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.groups.join(", ") || "-"}</td>
                  <td className="px-4 py-3">
                    {r.status === "subscribed" ? (
                      <span className="text-emerald-700">구독</span>
                    ) : (
                      <span className="text-red-600">수신거부</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.last_sent_at ? new Date(r.last_sent_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
