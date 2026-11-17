"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { GAME_HEIGHT, gameDocument, type EventGame } from "@/lib/event-game";
import { buildConfig, getPath, setPath, type FieldColumn, type TemplateField } from "@/lib/event-fields";
import { fillEventFields, suggestEventText, type TemplateOption } from "../actions";

type Obj = Record<string, unknown>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const AI_BG = "border-amber-500 bg-amber-50";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Cell({ c, value, onChange }: { c: FieldColumn; value: unknown; onChange: (v: unknown) => void }) {
  const cls = "input h-9 py-1 text-sm";
  if (c.type === "boolean") return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" aria-label={c.label} />;
  if (c.type === "number")
    return <input type="number" value={typeof value === "number" ? value : ""} min={c.min} max={c.max} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={`${cls} w-24`} aria-label={c.label} />;
  if (c.type === "color") return <input type="color" value={typeof value === "string" ? value.slice(0, 7) : "#888888"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-slate-300" aria-label={c.label} />;
  if (c.type === "lines")
    return <textarea value={Array.isArray(value) ? value.join("\n") : ""} rows={Math.max(2, Array.isArray(value) ? value.length : 2)} onChange={(e) => onChange(e.target.value.split("\n"))} className="input py-1 text-sm" aria-label={c.label} placeholder="한 줄에 하나씩" />;
  return <input value={typeof value === "string" ? value : ""} maxLength={c.max_length} onChange={(e) => onChange(e.target.value)} className={`${cls} ${c.type === "emoji" ? "w-14 text-center" : "min-w-32"}`} aria-label={c.label} />;
}

function ItemsInput({ f, value, fallback, onChange }: { f: TemplateField; value: unknown; fallback: unknown; onChange: (v: unknown) => void }) {
  const rows = (Array.isArray(value) ? value : []) as Obj[];
  const cols = f.columns ?? [];
  const template = (Array.isArray(fallback) && fallback[0]) || rows[rows.length - 1] || {};
  const canAdd = f.max_items === undefined || rows.length < f.max_items;
  const canRemove = f.min_items === undefined || rows.length > f.min_items;
  const sum = f.sum_key ? rows.reduce((s, r) => s + (typeof r[f.sum_key!] === "number" ? (r[f.sum_key!] as number) : 0), 0) : 0;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              {cols.map((c) => (
                <th key={c.key} className="pb-1 pr-2 font-medium">{c.label}{f.sum_key === c.key && f.sum_total === 100 ? " (%)" : ""}</th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} className="py-1 pr-2 align-top">
                    <Cell c={c} value={r[c.key]} onChange={(v) => onChange(rows.map((x, xi) => (xi === i ? { ...x, [c.key]: v } : x)))} />
                  </td>
                ))}
                <td className="py-1 align-top">
                  <button type="button" disabled={!canRemove} onClick={() => onChange(rows.filter((_, xi) => xi !== i))} className="h-9 rounded px-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`${i + 1}번째 줄 빼기`}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" disabled={!canAdd} onClick={() => onChange([...rows, JSON.parse(JSON.stringify(template))])} className="btn-secondary py-1 text-xs">+ 줄 추가</button>
        <span className="text-slate-500">
          {f.min_items !== undefined || f.max_items !== undefined ? `${f.min_items ?? 0}~${f.max_items ?? "∞"}개 · ` : ""}
          {f.sum_key ? <span className={Math.abs(sum - (f.sum_total ?? 0)) > 0.01 ? "font-medium text-red-600" : "font-medium text-emerald-700"}>합계 {Math.round(sum * 100) / 100} / {f.sum_total}</span> : `${rows.length}개`}
        </span>
      </div>
    </div>
  );
}

function JsonInput({ value, onChange, label }: { value: unknown; onChange: (v: unknown) => void; label: string }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <div>
      <textarea
        value={text}
        rows={6}
        spellCheck={false}
        aria-label={label}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
        className="input font-mono text-xs"
      />
      {bad && <p className="mt-1 text-xs text-red-600">JSON 형식이 올바르지 않아요.</p>}
    </div>
  );
}

function FieldInput({ f, value, fallback, onChange, highlight }: { f: TemplateField; value: unknown; fallback: unknown; onChange: (v: unknown) => void; highlight: boolean }) {
  const id = `ev-${f.key}`;
  const cls = `input ${highlight ? AI_BG : ""}`;
  switch (f.type) {
    case "textarea":
      return <textarea id={id} value={typeof value === "string" ? value : ""} maxLength={f.max_length} rows={3} onChange={(e) => onChange(e.target.value)} className={cls} />;
    case "number":
      return <input id={id} type="number" value={typeof value === "number" ? value : ""} min={f.min} max={f.max} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={`${cls} w-40`} />;
    case "boolean":
      return (
        <label className="flex min-h-11 items-center gap-2">
          <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" /> 켜기
        </label>
      );
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input id={id} type="color" value={typeof value === "string" ? value.slice(0, 7) : "#888888"} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-slate-300" />
          <input value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={`${cls} w-32 font-mono text-xs`} aria-label={`${f.label} 색상 값`} />
        </div>
      );
    case "select":
      return (
        <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={`${cls} w-auto`}>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "lines":
      return <textarea id={id} value={Array.isArray(value) ? value.join("\n") : ""} rows={4} onChange={(e) => onChange(e.target.value.split("\n"))} className={cls} placeholder="한 줄에 하나씩" />;
    case "items":
      return (
        <div className={highlight ? `rounded-lg border p-2 ${AI_BG}` : ""}>
          <ItemsInput f={f} value={value} fallback={fallback} onChange={onChange} />
        </div>
      );
    case "json":
      return <JsonInput value={value} onChange={onChange} label={f.label} />;
    default:
      return <input id={id} value={typeof value === "string" ? value : ""} maxLength={f.max_length} onChange={(e) => onChange(e.target.value)} className={cls} />;
  }
}

function Rewrite({ template, f, value, context, onPick }: { template: TemplateOption; f: TemplateField; value: string; context: string; onPick: (v: string) => void }) {
  const [req, setReq] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <label className="label" htmlFor={`rw-${f.key}`}>이 칸만 어떻게 바꿀까요?</label>
      <div className="flex gap-2">
        <input id={`rw-${f.key}`} value={req} onChange={(e) => setReq(e.target.value)} maxLength={300} className="input" placeholder="예: 더 짧고 재밌게" />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await suggestEventText(template.id, f.key, value, req, context);
              if (r.options) setOptions(r.options);
              else setError(r.error ?? "제안을 만들지 못했어요.");
            })
          }
          className="btn-secondary shrink-0"
        >
          {pending ? "만드는 중..." : "제안 받기"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button key={o} type="button" onClick={() => onPick(o)} className="rounded-lg border border-slate-300 px-3 py-2 text-left text-sm hover:border-indigo-500 hover:bg-indigo-50">{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Settings form for one event template: only the template's editable fields, with AI help and live preview. */
export function EventTemplateEditor({ template, initial, context, onApply, onBack }: { template: TemplateOption; initial?: Obj; context: string; onApply: (g: EventGame) => void; onBack: () => void }) {
  const defaults = useMemo(() => (template.game.config ?? {}) as Obj, [template]);
  const fields = template.fields;
  const editable = useMemo(() => fields.filter((f) => f.user_edit), [fields]);
  const locked = fields.filter((f) => !f.user_edit);
  const [values, setValues] = useState<Obj>(() => buildConfig(fields, defaults, initial ?? defaults).config);
  const [snapshot, setSnapshot] = useState<Obj | null>(null);
  const [aiKeys, setAiKeys] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState("");
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const { config, errors } = useMemo(() => buildConfig(fields, defaults, values), [fields, defaults, values]);
  const previewConfig = useDebounced(config, 500);
  const errorCount = Object.keys(errors).length;
  const groups = useMemo(() => {
    const m = new Map<string, TemplateField[]>();
    for (const f of editable) m.set(f.group || "설정", [...(m.get(f.group || "설정") ?? []), f]);
    return [...m.entries()];
  }, [editable]);
  const canAi = editable.some((f) => f.ai_fill);

  const change = (key: string, v: unknown) => {
    setValues((cur) => setPath(cur, key, v));
    setAiKeys((s) => {
      if (!s.has(key)) return s;
      const n = new Set(s);
      n.delete(key);
      return n;
    });
  };
  const fill = () =>
    start(async () => {
      setError("");
      const r = await fillEventFields(template.id, request, context, values);
      if (!r.values) return setError(r.error ?? "AI로 채우지 못했어요.");
      setSnapshot(values);
      setAiKeys(new Set(editable.filter((f) => !same(getPath(values, f.key), getPath(r.values, f.key))).map((f) => f.key)));
      setValues(r.values);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">🎮 {template.name}</p>
        <button type="button" onClick={onBack} className="text-sm text-indigo-600 hover:underline">다른 템플릿 고르기</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {canAi && (
            <div className="space-y-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-4">
              <label className="label" htmlFor="ev-ai">AI로 한 번에 채우기 (선택)</label>
              <textarea id="ev-ai" value={request} onChange={(e) => setRequest(e.target.value)} rows={2} maxLength={1000} className="input" placeholder="예: 신규 가입 이벤트. 1등 무료 이용권 5%, 2등 30% 할인 25%, 나머지 10% 할인. 초록 계열로." />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600">AI는 아래 항목의 값만 채워요. 게임 동작과 디자인은 바뀌지 않아요.</p>
                <button type="button" disabled={pending} onClick={fill} className="btn-primary">{pending ? "AI가 채우는 중..." : "AI로 채우기"}</button>
              </div>
            </div>
          )}

          {snapshot && aiKeys.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span><b>AI가 {aiKeys.size}개 항목을 바꿨어요.</b> 노란 칸을 확인하고 필요하면 고쳐주세요.</span>
              <button type="button" onClick={() => { setValues(snapshot); setSnapshot(null); setAiKeys(new Set()); }} className="btn-secondary py-1 text-xs">모두 되돌리기</button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {groups.map(([group, list]) => (
            <section key={group} className="space-y-4 rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold">{group}</h3>
              {list.map((f) => {
                const v = getPath(values, f.key);
                const textual = (f.type === "text" || f.type === "textarea") && f.ai_fill;
                return (
                  <div key={f.key}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="label mb-0 flex items-center gap-2" htmlFor={`ev-${f.key}`}>
                        {f.label}
                        {f.max_length && (f.type === "text" || f.type === "textarea") && <span className="text-xs font-normal text-slate-500">최대 {f.max_length}자</span>}
                        {aiKeys.has(f.key) && <span className="rounded bg-amber-200 px-1.5 text-[11px] font-bold text-amber-900">AI</span>}
                      </label>
                      {textual && (
                        <button type="button" onClick={() => setRewriting((k) => (k === f.key ? null : f.key))} className="text-xs text-indigo-600 hover:underline">
                          {rewriting === f.key ? "닫기" : "AI로 다시 쓰기"}
                        </button>
                      )}
                    </div>
                    <FieldInput f={f} value={v} fallback={getPath(defaults, f.key)} onChange={(x) => change(f.key, x)} highlight={aiKeys.has(f.key)} />
                    {f.help && <p className="mt-1 text-xs text-slate-500">{f.help}</p>}
                    {errors[f.key] && <p className="mt-1 text-xs font-medium text-red-600">⚠ {errors[f.key]}</p>}
                    {rewriting === f.key && <Rewrite template={template} f={f} value={typeof v === "string" ? v : ""} context={context} onPick={(o) => { change(f.key, o); setRewriting(null); }} />}
                  </div>
                );
              })}
            </section>
          ))}

          {locked.length > 0 && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
              고정된 설정: {locked.map((f) => f.label).join(", ")}. 이 템플릿에서는 바꿀 수 없고 AI도 건드리지 않아요.
            </p>
          )}
        </div>

        <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
          <iframe key={JSON.stringify(previewConfig)} title="미리보기" srcDoc={gameDocument({ ...template.game, config: previewConfig })} sandbox="allow-scripts" className="w-full rounded-lg border border-slate-200" style={{ height: GAME_HEIGHT }} />
          <button type="button" disabled={errorCount > 0 || pending} onClick={() => onApply({ ...template.game, config, template_id: template.id })} className="btn-primary w-full">
            이벤트에 적용하기
          </button>
          <p className={`text-center text-xs ${errorCount ? "text-red-600" : "text-slate-500"}`}>
            {errorCount ? `빨간 안내 ${errorCount}곳을 고치면 적용할 수 있어요.` : "적용한 뒤 페이지를 저장해야 공개 페이지에 반영돼요."}
          </p>
        </div>
      </div>
    </div>
  );
}
