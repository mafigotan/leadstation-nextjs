"use client";

import { useState, useTransition } from "react";
import { FIELD_TYPES, FIELD_TYPE_LABEL, inferFields, type FieldType, type TemplateField } from "@/lib/event-fields";
import { draftFields, updateTemplateFields, type TemplateState } from "./actions";

const numOrUndef = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

function NumBox({ label, value, onChange }: { label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-600">
      {label}
      <input type="number" value={value ?? ""} onChange={(e) => onChange(numOrUndef(e.target.value))} className="input h-8 w-20 py-1 text-xs" />
    </label>
  );
}

function Limits({ f, set }: { f: TemplateField; set: (p: Partial<TemplateField>) => void }) {
  if (f.type === "text" || f.type === "textarea") return <NumBox label="최대 글자" value={f.max_length} onChange={(v) => set({ max_length: v })} />;
  if (f.type === "number")
    return (
      <div className="flex flex-wrap gap-2">
        <NumBox label="최소" value={f.min} onChange={(v) => set({ min: v })} />
        <NumBox label="최대" value={f.max} onChange={(v) => set({ max: v })} />
      </div>
    );
  if (f.type === "select")
    return (
      <input
        value={(f.options ?? []).join(", ")}
        onChange={(e) => set({ options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
        className="input h-8 py-1 text-xs"
        placeholder="선택지를 쉼표로 구분"
        aria-label="선택지"
      />
    );
  if (f.type === "items")
    return (
      <div className="flex flex-wrap gap-2">
        <NumBox label="최소 개수" value={f.min_items} onChange={(v) => set({ min_items: v })} />
        <NumBox label="최대 개수" value={f.max_items} onChange={(v) => set({ max_items: v })} />
        <label className="flex items-center gap-1 text-xs text-slate-600">
          합계 열
          <select value={f.sum_key ?? ""} onChange={(e) => set({ sum_key: e.target.value || undefined, sum_total: e.target.value ? f.sum_total ?? 100 : undefined })} className="input h-8 w-auto py-1 text-xs">
            <option value="">없음</option>
            {(f.columns ?? []).filter((c) => c.type === "number").map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        {f.sum_key && <NumBox label="합계" value={f.sum_total} onChange={(v) => set({ sum_total: v })} />}
      </div>
    );
  return <span className="text-xs text-slate-400">-</span>;
}

/** Super admin: which settings users may change for this template, in which order, with which limits. */
export function FieldsEditor({ id, config, saved }: { id: string; config: Record<string, unknown>; saved: TemplateField[] }) {
  const inferred = inferFields(config);
  const [fields, setFields] = useState<TemplateField[]>(saved.length ? saved : inferred);
  const [isDraft, setIsDraft] = useState(!saved.length);
  const [msg, setMsg] = useState<TemplateState>({});
  const [adding, setAdding] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (key: string, p: Partial<TemplateField>) => setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f)));
  const move = (i: number, d: number) =>
    setFields((fs) => {
      const j = i + d;
      if (j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const unused = inferred.filter((f) => !fields.some((x) => x.key === f.key));

  const save = () =>
    start(async () => {
      const r = await updateTemplateFields(id, fields);
      setMsg(r);
      if (r.ok) setIsDraft(false);
    });
  const aiDraft = () =>
    start(async () => {
      setMsg({});
      const r = await draftFields(id);
      if (r.fields) {
        setFields(r.fields);
        setIsDraft(true);
        setMsg({ message: "AI 초안을 불러왔어요. 확인하고 저장해 주세요." });
      } else setMsg({ error: r.error });
    });

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">유저가 고칠 수 있는 항목</h2>
          <p className="mt-1 text-sm text-slate-500">
            유저 수정을 끈 항목은 유저 화면에 나오지 않고 기본값으로 고정돼요. AI 채우기를 끈 항목은 AI가 바꾸지 않아요. 목록에 없는 설정도 기본값 그대로예요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={aiDraft} className="btn-secondary text-sm">{pending ? "처리 중..." : "AI로 초안 만들기"}</button>
          <button type="button" disabled={pending} onClick={() => { setFields(inferred); setIsDraft(true); }} className="btn-secondary text-sm">설정에서 다시 만들기</button>
        </div>
      </div>
      {isDraft && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {saved.length ? "저장하지 않은 목록이에요." : "아직 저장된 항목이 없어서 설정에서 자동으로 만든 목록이에요. 유저 화면도 지금 이 목록을 써요."} 이름을 다듬고 저장해 주세요.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="w-16 pb-2 font-medium">순서</th>
              <th className="pb-2 font-medium">유저에게 보이는 이름</th>
              <th className="w-36 pb-2 font-medium">설정 키</th>
              <th className="w-28 pb-2 font-medium">형식</th>
              <th className="pb-2 font-medium">제한</th>
              <th className="w-32 pb-2 font-medium">묶음</th>
              <th className="w-16 pb-2 text-center font-medium">유저 수정</th>
              <th className="w-16 pb-2 text-center font-medium">AI 채우기</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <FieldRow key={f.key} f={f} i={i} count={fields.length} set={(p) => set(f.key, p)} move={move} remove={() => setFields((fs) => fs.filter((x) => x.key !== f.key))} open={open === f.key} toggle={() => setOpen((o) => (o === f.key ? null : f.key))} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <select value={adding} onChange={(e) => setAdding(e.target.value)} className="input h-9 w-auto py-1 text-sm" aria-label="추가할 설정">
            <option value="">목록에 없는 설정 ({unused.length})</option>
            {unused.map((f) => (
              <option key={f.key} value={f.key}>{f.key}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!adding}
            onClick={() => {
              const f = unused.find((x) => x.key === adding);
              if (f) setFields((fs) => [...fs, f]);
              setAdding("");
            }}
            className="btn-secondary text-sm"
          >
            + 항목 추가
          </button>
        </div>
        <div className="flex items-center gap-3">
          {msg.error ? <span className="text-sm text-red-600">{msg.error}</span> : msg.message ? <span className="text-sm text-emerald-700">{msg.message}</span> : null}
          <button type="button" disabled={pending} onClick={save} className="btn-primary">{pending ? "저장 중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ f, i, count, set, move, remove, open, toggle }: { f: TemplateField; i: number; count: number; set: (p: Partial<TemplateField>) => void; move: (i: number, d: number) => void; remove: () => void; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr className={`border-t border-slate-100 align-middle ${f.user_edit ? "" : "bg-slate-50 text-slate-500"}`}>
        <td className="py-2">
          <div className="flex gap-1">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-30" aria-label="위로">↑</button>
            <button type="button" disabled={i === count - 1} onClick={() => move(i, 1)} className="rounded border border-slate-200 px-1.5 text-xs disabled:opacity-30" aria-label="아래로">↓</button>
          </div>
        </td>
        <td className="py-2 pr-2">
          <input value={f.label} onChange={(e) => set({ label: e.target.value })} maxLength={40} className="input h-8 py-1 text-sm" aria-label="이름" />
          <input value={f.help ?? ""} onChange={(e) => set({ help: e.target.value || undefined })} maxLength={200} className="input mt-1 h-7 py-0.5 text-xs" placeholder="도움말 (선택)" aria-label="도움말" />
        </td>
        <td className="py-2 pr-2"><code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs">{f.key}</code></td>
        <td className="py-2 pr-2">
          <select value={f.type} onChange={(e) => set({ type: e.target.value as FieldType })} className="input h-8 py-1 text-xs" aria-label="형식">
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>
            ))}
          </select>
          {f.type === "items" && (
            <button type="button" onClick={toggle} className="mt-1 text-xs text-indigo-600 hover:underline">{open ? "열 닫기" : `열 ${f.columns?.length ?? 0}개 보기`}</button>
          )}
        </td>
        <td className="py-2 pr-2"><Limits f={f} set={set} /></td>
        <td className="py-2 pr-2"><input value={f.group ?? ""} onChange={(e) => set({ group: e.target.value || undefined })} maxLength={40} className="input h-8 py-1 text-xs" placeholder="예: 기본 문구" aria-label="묶음" /></td>
        <td className="py-2 text-center"><input type="checkbox" checked={f.user_edit} onChange={(e) => set({ user_edit: e.target.checked })} className="h-4 w-4" aria-label="유저 수정" /></td>
        <td className="py-2 text-center"><input type="checkbox" checked={f.ai_fill} disabled={!f.user_edit} onChange={(e) => set({ ai_fill: e.target.checked })} className="h-4 w-4" aria-label="AI 채우기" /></td>
        <td className="py-2 text-right"><button type="button" onClick={remove} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" aria-label="빼기">✕</button></td>
      </tr>
      {open && f.type === "items" && (
        <tr className="bg-slate-50">
          <td />
          <td colSpan={8} className="py-3 pr-2">
            <p className="mb-2 text-xs text-slate-500">표의 열 이름 (유저 화면의 머리글)</p>
            <div className="flex flex-wrap gap-3">
              {(f.columns ?? []).map((c, ci) => (
                <label key={c.key} className="flex items-center gap-1 text-xs">
                  <code className="rounded bg-white px-1">{c.key}</code>
                  <input
                    value={c.label}
                    maxLength={40}
                    onChange={(e) => set({ columns: f.columns!.map((x, xi) => (xi === ci ? { ...x, label: e.target.value } : x)) })}
                    className="input h-7 w-28 py-0.5 text-xs"
                  />
                  <button type="button" onClick={() => set({ columns: f.columns!.filter((_, xi) => xi !== ci) })} className="text-red-600" aria-label={`${c.key} 열 빼기`}>✕</button>
                </label>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
