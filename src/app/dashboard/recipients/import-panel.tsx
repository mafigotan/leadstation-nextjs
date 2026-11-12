"use client";

import { useState, useTransition } from "react";
import { parseCsv, readTextFile } from "@/lib/csv";
import { importRecipients, type RecipientInput } from "./actions";

const FIELDS: { key: keyof RecipientInput; label: string; guess: RegExp }[] = [
  { key: "email", label: "이메일", guess: /e-?mail|이메일|메일/i },
  { key: "name", label: "이름", guess: /^name$|이름|성명|고객명/i },
  { key: "phone", label: "연락처", guess: /phone|tel|mobile|연락처|전화|휴대/i },
  { key: "company", label: "회사", guess: /company|회사|소속|기업/i },
  { key: "group", label: "그룹", guess: /group|그룹/i },
  { key: "memo", label: "메모", guess: /memo|note|메모|비고/i },
];

export function ImportPanel({ groups }: { groups: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [groupId, setGroupId] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File) {
    setMsg(null);
    if (/\.xlsx?$/i.test(file.name)) {
      setMsg({ kind: "error", text: "엑셀 파일은 '다른 이름으로 저장 > CSV UTF-8'로 저장한 뒤 올려주세요." });
      return;
    }
    const parsed = parseCsv(await readTextFile(file));
    if (parsed.length < 2) return setMsg({ kind: "error", text: "첫 줄은 제목, 둘째 줄부터 데이터가 있는 CSV 파일이 필요해요." });
    const header = parsed[0];
    const m: Record<string, number> = {};
    for (const f of FIELDS) {
      const idx = header.findIndex((h) => f.guess.test(h.trim()));
      if (idx >= 0) m[f.key] = idx;
    }
    if (m.email === undefined) {
      const idx = parsed[1].findIndex((v) => /@/.test(v));
      if (idx >= 0) m.email = idx;
    }
    setMapping(m);
    setRows(parsed);
  }

  function submit() {
    if (!rows || mapping.email === undefined) return setMsg({ kind: "error", text: "이메일 열을 골라주세요." });
    const data: RecipientInput[] = rows.slice(1).map((r) => {
      const o: RecipientInput = { email: "" };
      for (const f of FIELDS) if (mapping[f.key] !== undefined) o[f.key] = r[mapping[f.key]] ?? "";
      return o;
    });
    start(async () => {
      const res = await importRecipients(data, groupId || null, overwrite);
      if (res.error) return setMsg({ kind: "error", text: res.error });
      setMsg({
        kind: "ok",
        text: `새로 추가 ${res.added}명${overwrite ? `, 정보 갱신 ${res.updated}명` : `, 이미 있어서 건너뜀 ${res.skipped}명`}${res.invalid ? `, 이메일 오류 ${res.invalid}줄` : ""}`,
      });
      setRows(null);
    });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">CSV로 가져오기</h2>
      {!rows ? (
        <>
          <p className="text-xs text-slate-500">첫 줄에 제목(이메일, 이름, 연락처, 회사, 그룹, 메모)이 있는 CSV 파일을 올려주세요. 엑셀은 CSV로 저장해서 올리면 돼요.</p>
          <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="block w-full text-sm" />
        </>
      ) : (
        <>
          <p className="text-sm">{rows.length - 1}줄을 읽었어요. 열을 확인해 주세요.</p>
          <div className="space-y-1.5 text-sm">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-2">
                <span className="w-14 shrink-0">{f.label}{f.key === "email" && " *"}</span>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? undefined! : Number(e.target.value) })}
                  className="input py-1"
                >
                  <option value="">사용 안 함</option>
                  {rows[0].map((h, i) => <option key={i} value={i}>{h || `${i + 1}번째 열`} (예: {rows[1]?.[i] ?? ""})</option>)}
                </select>
              </label>
            ))}
          </div>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="input">
            <option value="">추가할 그룹 (선택)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> 이미 있는 주소는 정보 덮어쓰기
          </label>
          <div className="flex gap-2">
            <button onClick={submit} disabled={pending} className="btn-primary flex-1">{pending ? "가져오는 중..." : "가져오기"}</button>
            <button onClick={() => setRows(null)} disabled={pending} className="btn-secondary">취소</button>
          </div>
        </>
      )}
      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
