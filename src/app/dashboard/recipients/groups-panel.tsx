"use client";

import { useState, useTransition } from "react";
import { createGroup, deleteGroup, importLeads, renameGroup } from "./actions";

export function GroupsPanel({ groups }: { groups: { id: string; name: string; count: number }[] }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">그룹</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createGroup(name);
            setMsg(r.error ? { kind: "error", text: r.error } : null);
            if (!r.error) setName("");
          });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 그룹 이름" className="input" />
        <button disabled={pending} className="btn-secondary shrink-0">만들기</button>
      </form>
      <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto text-sm">
        {groups.length === 0 && <li className="py-2 text-slate-500">그룹이 없어요.</li>}
        {groups.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="truncate">{g.name} <span className="text-slate-400">({g.count})</span></span>
            <span className="flex shrink-0 gap-2 text-xs">
              <button
                className="text-slate-500 hover:underline"
                onClick={() => {
                  const n = prompt("새 그룹 이름", g.name);
                  if (n) start(async () => void (await renameGroup(g.id, n)));
                }}
              >
                이름 변경
              </button>
              <button
                className="text-red-600 hover:underline"
                onClick={() => confirm(`'${g.name}' 그룹을 삭제할까요? 수신자는 지워지지 않아요.`) && start(async () => void (await deleteGroup(g.id)))}
              >
                삭제
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-100 pt-3">
        <p className="mb-2 text-xs text-slate-500">Lead Collector에서 마케팅 수신에 동의한 리드를 수신자로 가져와요. 이미 있는 주소는 건너뛰어요.</p>
        <button
          disabled={pending}
          className="btn-secondary w-full"
          onClick={() =>
            start(async () => {
              const r = await importLeads("리드");
              setMsg(r.error ? { kind: "error", text: r.error } : { kind: "ok", text: `리드 ${r.added}명을 '리드' 그룹으로 가져왔어요.` });
            })
          }
        >
          {pending ? "처리 중..." : "리드 가져오기"}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
