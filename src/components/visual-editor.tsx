"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Editable, focusEd } from "./editable";

/**
 * Shared visual editor: element palette on the left, near-final draft on the right.
 * Text in the draft is edited in place. Clicking an element shows its menu above it
 * (move, duplicate, delete and element options). Images open a modal.
 * Elements are added by dragging from the palette onto the blue lines.
 */

export type PaletteItem = { type: string; label: string; icon: string; hint?: string };
type Drag = { kind: "new"; type: string } | { kind: "move"; id: string } | null;

export type EdOpts = {
  as?: string;
  className?: string;
  placeholder?: string;
  rich?: boolean;
  single?: boolean;
  style?: React.CSSProperties;
  /** For string lists: Enter adds an item after this one, Backspace on empty removes it. */
  list?: boolean;
};
/** Renders an inline-editable text for a field path of the element, e.g. "text", "items.2", "rows.1.0", "items.0.title". */
export type Ed = (path: string, value: string, opts?: EdOpts) => ReactNode;

export type BlockCtx = { onImage: (key: string) => void; ed: Ed; selected: boolean };

type Ctx = { selected: string | null; select: (id: string | null, sub?: string | null) => void };
const SelCtx = createContext<Ctx>({ selected: null, select: () => {} });
export const useSelection = () => useContext(SelCtx);

function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = (o: unknown) => (Array.isArray(o) ? [...o] : { ...(o as object) });
  const root = clone(obj) as Record<string, unknown>;
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = clone(cur[keys[i]] ?? (/^\d+$/.test(keys[i + 1]) ? [] : {}));
    cur = cur[keys[i]] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return root as T;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? o : (o as Record<string, unknown>)[k]), obj);
}

/** Inline editor factory bound to one element. */
export function makeEd<B extends { id: string }>(b: B, onChange: (next: B) => void): Ed {
  return function edField(path, value, opts = {}) {
    const key = `${b.id}:${path}`;
    let onEnter: (() => void) | undefined;
    let onRemoveEmpty: (() => void) | undefined;
    if (opts.list) {
      const parts = path.split(".");
      const index = Number(parts.pop());
      const arrPath = parts.join(".");
      const arr = (getPath(b, arrPath) as string[]) ?? [];
      onEnter = () => {
        const next = [...arr];
        next.splice(index + 1, 0, "");
        onChange(setPath(b, arrPath, next));
        focusEd(`${b.id}:${arrPath}.${index + 1}`);
      };
      onRemoveEmpty = () => {
        if (arr.length <= 1) return;
        onChange(setPath(b, arrPath, arr.filter((_, i) => i !== index)));
        if (index > 0) focusEd(`${b.id}:${arrPath}.${index - 1}`);
      };
    }
    return (
      <Editable
        key={key}
        edKey={key}
        value={value}
        as={opts.as}
        className={opts.className}
        placeholder={opts.placeholder}
        rich={opts.rich}
        single={opts.single}
        style={opts.style}
        onEnter={onEnter}
        onRemoveEmpty={onRemoveEmpty}
        onChange={(v) => onChange(setPath(b, path, v))}
      />
    );
  };
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        data-ve-panel
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-left text-sm text-slate-800 shadow-2xl"
        style={{ fontFamily: "var(--font-sans)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="닫기">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function VisualEditor<B extends { id: string }>({
  blocks,
  onChange,
  palette,
  labels,
  create,
  renderBlock,
  renderTools,
  renderImage,
  settings,
  settingsLabel = "설정",
  top,
  bottom,
  canvasClassName = "",
  canvasStyle,
  emptyText = "왼쪽 요소를 끌어다 여기에 놓으세요.",
  initialTab = "blocks",
  selected,
  onSelect,
}: {
  blocks: B[];
  onChange: (blocks: B[]) => void;
  palette: PaletteItem[];
  /** Element name shown in its menu. */
  labels: (b: B) => string;
  create: (type: string) => B;
  renderBlock: (b: B, i: number, ctx: BlockCtx) => ReactNode;
  /** Extra controls in the element menu (style, rows, links ...). */
  renderTools?: (b: B, update: (patch: Partial<B>) => void, openImage: (key: string) => void) => ReactNode;
  /** Content of the image modal for image `key` of the element. */
  renderImage?: (b: B, key: string, update: (patch: Partial<B>) => void, close: () => void) => ReactNode;
  settings?: ReactNode;
  settingsLabel?: string;
  top?: ReactNode;
  bottom?: ReactNode;
  canvasClassName?: string;
  canvasStyle?: React.CSSProperties;
  emptyText?: string;
  initialTab?: "blocks" | "settings";
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<"blocks" | "settings">(initialTab);
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<number | null>(null);
  const [image, setImage] = useState<{ id: string; key: string } | null>(null);

  const insert = (index: number, d: NonNullable<Drag>) => {
    if (d.kind === "new") {
      const b = create(d.type);
      onChange([...blocks.slice(0, index), b, ...blocks.slice(index)]);
      onSelect(b.id);
    } else {
      const from = blocks.findIndex((b) => b.id === d.id);
      if (from < 0) return;
      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(index > from ? index - 1 : index, 0, moved);
      onChange(next);
    }
  };

  const replace = (next: B) => onChange(blocks.map((b) => (b.id === next.id ? next : b)));
  const update = (id: string, patch: Partial<B>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const addByClick = (type: string) => {
    const idx = blocks.findIndex((b) => b.id === selected);
    insert(idx >= 0 ? idx + 1 : blocks.length, { kind: "new", type });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !image) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        onSelect(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect, image]);

  // Clicking anywhere outside the elements and menus closes the menu (text edits stay).
  useEffect(() => {
    if (!selected) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.closest("[data-ve-frame],[data-ve-panel],[data-ve-aside]")) return;
      onSelect(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selected, onSelect]);

  const zone = (index: number) => (
    <DropZone
      key={`z${index}`}
      active={!!drag}
      over={over === index}
      onOver={() => setOver(index)}
      onLeave={() => setOver((o) => (o === index ? null : o))}
      onDrop={() => {
        if (drag) insert(index, drag);
        setDrag(null);
        setOver(null);
      }}
    />
  );

  const imgBlock = image ? blocks.find((b) => b.id === image.id) : undefined;

  return (
    <SelCtx.Provider value={{ selected, select: onSelect }}>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside data-ve-aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          {settings && (
            <div className="mb-3 flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
              {(["blocks", "settings"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 rounded-md py-1.5 font-medium ${tab === t ? "bg-slate-900 text-white" : "text-slate-600"}`}>
                  {t === "blocks" ? "요소" : settingsLabel}
                </button>
              ))}
            </div>
          )}
          {tab === "blocks" || !settings ? (
            <div className="card p-3">
              <p className="mb-2 px-1 text-xs text-slate-500">끌어서 본문의 파란 선에 놓거나, 눌러서 선택한 요소 아래에 추가해요.</p>
              <div className="space-y-1.5">
                {palette.map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", p.type);
                      e.dataTransfer.effectAllowed = "copy";
                      setDrag({ kind: "new", type: p.type });
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    onClick={() => addByClick(p.type)}
                    className="flex w-full cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50 active:cursor-grabbing"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm">{p.icon}</span>
                    <span className="min-w-0">
                      <span className="block font-medium">{p.label}</span>
                      {p.hint && <span className="block truncate text-xs text-slate-500">{p.hint}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">{settings}</div>
          )}
        </aside>

        <div
          className="min-w-0 pt-12"
          onClick={() => onSelect(null)}
          onClickCapture={(e) => {
            // Links in the draft do not navigate while editing.
            const t = e.target as HTMLElement;
            if (t.closest("a") && !t.closest("[data-ve-panel]")) e.preventDefault();
          }}
        >
          <div className={canvasClassName} style={canvasStyle}>
            {top}
            {zone(0)}
            {blocks.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">{emptyText}</div>
            )}
            {blocks.map((b, i) => {
              const openImage = (key: string) => {
                onSelect(b.id);
                setImage({ id: b.id, key });
              };
              return [
                <Frame
                  key={b.id}
                  id={b.id}
                  label={labels(b)}
                  onDragStart={() => setDrag({ kind: "move", id: b.id })}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                  actions={
                    <>
                      <ToolBtn label="위로" onClick={() => move(i, -1)}>↑</ToolBtn>
                      <ToolBtn label="아래로" onClick={() => move(i, 1)}>↓</ToolBtn>
                      <ToolBtn
                        label="복제"
                        onClick={() => {
                          const copy = { ...structuredClone(b), id: Math.random().toString(36).slice(2, 10) };
                          onChange([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
                        }}
                      >
                        ⧉ 복제
                      </ToolBtn>
                      <ToolBtn
                        label="삭제"
                        danger
                        onClick={() => {
                          onChange(blocks.filter((x) => x.id !== b.id));
                          onSelect(null);
                        }}
                      >
                        ✕ 삭제
                      </ToolBtn>
                    </>
                  }
                  tools={renderTools?.(b, (p) => update(b.id, p), openImage)}
                >
                  {renderBlock(b, i, { onImage: openImage, ed: makeEd(b, replace), selected: selected === b.id })}
                </Frame>,
                zone(i + 1),
              ];
            })}
            {bottom}
          </div>
        </div>
      </div>
      {image && imgBlock && renderImage && (
        <Modal title="이미지" onClose={() => setImage(null)}>
          {renderImage(imgBlock, image.key, (p) => update(imgBlock.id, p), () => setImage(null))}
        </Modal>
      )}
    </SelCtx.Provider>
  );
}

function DropZone({ active, over, onOver, onLeave, onDrop }: { active: boolean; over: boolean; onOver: () => void; onLeave: () => void; onDrop: () => void }) {
  return (
    <div
      onDragOver={(e) => {
        if (!active) return;
        e.preventDefault();
        onOver();
      }}
      onDragLeave={onLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`relative transition-all ${active ? "h-6" : "h-1"}`}
    >
      {active && (
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full transition-all ${over ? "h-1.5 bg-indigo-500" : "h-0.5 bg-indigo-200"}`}>
          {over && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">여기에 놓기</span>}
        </div>
      )}
    </div>
  );
}

export function ToolBtn({ label, onClick, children, danger, active }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-7 shrink-0 whitespace-nowrap rounded px-2 text-xs font-semibold ${danger ? "text-red-600 hover:bg-red-50" : active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

export const ToolSep = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />;

/** One element: outline on hover; when selected, its menu floats above it. */
function Frame({
  id,
  label,
  children,
  actions,
  tools,
  onDragStart,
  onDragEnd,
}: {
  id: string;
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  tools?: ReactNode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const { selected, select } = useSelection();
  const on = selected === id;
  return (
    <div
      data-ve-frame
      className={`relative rounded-md outline-offset-4 transition ${on ? "z-20 outline outline-2 outline-indigo-500" : "hover:outline hover:outline-1 hover:outline-indigo-300"}`}
      onClick={(e) => {
        e.stopPropagation();
        select(id);
      }}
    >
      {on && (
        <div
          data-ve-panel
          className="absolute bottom-full left-0 z-30 mb-2 flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 text-left text-slate-800 shadow-lg"
          style={{ fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.4 }}
          onClick={(e) => e.stopPropagation()}
        >
          {onDragStart && (
            <span
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart();
              }}
              onDragEnd={onDragEnd}
              title="끌어서 위치 옮기기"
              className="flex h-7 w-6 cursor-grab items-center justify-center rounded text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
            >
              ⋮⋮
            </span>
          )}
          <span className="px-1.5 text-xs font-bold text-indigo-600">{label}</span>
          {actions && (
            <>
              <ToolSep />
              {actions}
            </>
          )}
          {tools && (
            <>
              <ToolSep />
              {tools}
            </>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** A fixed (not movable) selectable area, e.g. the post title or the FAQ. */
export function Selectable({ id, label, children, tools }: { id: string; label: string; children: ReactNode; tools?: ReactNode }) {
  return (
    <Frame id={id} label={label} tools={tools}>
      {children}
    </Frame>
  );
}

/** Small text input inside an element menu. */
export function ToolInput({ value, onChange, placeholder, width = 160 }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{ width }}
      className="h-7 rounded border border-slate-300 px-2 text-xs focus:border-indigo-500 focus:outline-none"
    />
  );
}

/** Small select inside an element menu. */
export function ToolSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className="h-7 rounded border border-slate-300 bg-white px-1 text-xs"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
