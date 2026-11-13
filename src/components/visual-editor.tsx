"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shared visual editor: element palette on the left, near-final draft on the right.
 * Click an element to open its detail menu below it; drag elements from the palette
 * (or drag the ⋮⋮ handle of an element) onto the drop lines to add or move.
 */

export type PaletteItem = { type: string; label: string; icon: string; hint?: string };
type Drag = { kind: "new"; type: string } | { kind: "move"; id: string } | null;

type Ctx = {
  selected: string | null;
  select: (id: string | null, sub?: string | null) => void;
  sub: string | null;
};
const SelCtx = createContext<Ctx>({ selected: null, select: () => {}, sub: null });
export const useSelection = () => useContext(SelCtx);

export function VisualEditor<B extends { id: string }>({
  blocks,
  onChange,
  palette,
  create,
  renderBlock,
  renderPanel,
  settings,
  settingsLabel = "설정",
  top,
  bottom,
  canvasClassName = "",
  canvasStyle,
  emptyText = "왼쪽 요소를 끌어다 여기에 놓으세요.",
  initialTab = "blocks",
  selected,
  sub,
  onSelect,
}: {
  blocks: B[];
  onChange: (blocks: B[]) => void;
  palette: PaletteItem[];
  create: (type: string) => B;
  /** Renders one element as it will look. onImage(key) opens the image menu for that image. */
  renderBlock: (b: B, i: number, onImage: (key: string) => void) => ReactNode;
  /** Detail menu of the selected element. sub is the image key that was clicked, if any. */
  renderPanel: (b: B, i: number, sub: string | null, update: (patch: Partial<B>) => void, move: (d: -1 | 1) => void) => ReactNode;
  settings?: ReactNode;
  settingsLabel?: string;
  /** Fixed areas above and below the elements (title, footer ...). Use <Selectable> inside. */
  top?: ReactNode;
  bottom?: ReactNode;
  canvasClassName?: string;
  canvasStyle?: React.CSSProperties;
  emptyText?: string;
  initialTab?: "blocks" | "settings";
  selected: string | null;
  sub: string | null;
  onSelect: (id: string | null, sub?: string | null) => void;
}) {
  const [tab, setTab] = useState<"blocks" | "settings">(initialTab);
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<number | null>(null);

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

  // Esc closes the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onSelect(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

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

  return (
    <SelCtx.Provider value={{ selected, select: onSelect, sub }}>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
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
              <p className="mb-2 px-1 text-xs text-slate-500">끌어서 본문에 놓거나, 눌러서 선택한 요소 아래에 추가해요.</p>
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
          className="min-w-0"
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
            {blocks.map((b, i) => [
              <BlockFrame
                key={b.id}
                id={b.id}
                onDragStart={() => setDrag({ kind: "move", id: b.id })}
                onDragEnd={() => {
                  setDrag(null);
                  setOver(null);
                }}
                toolbar={
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
                      ⧉
                    </ToolBtn>
                    <ToolBtn
                      label="삭제"
                      danger
                      onClick={() => {
                        onChange(blocks.filter((x) => x.id !== b.id));
                        onSelect(null);
                      }}
                    >
                      ✕
                    </ToolBtn>
                  </>
                }
                panel={renderPanel(b, i, sub, (p) => update(b.id, p), (d) => move(i, d))}
              >
                {renderBlock(b, i, (key) => onSelect(b.id, key))}
              </BlockFrame>,
              zone(i + 1),
            ])}
            {bottom}
          </div>
        </div>
      </div>
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

function ToolBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-7 min-w-7 rounded px-1.5 text-xs font-semibold ${danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

/** Wraps one element: outline on hover, toolbar and detail menu when selected. */
function BlockFrame({
  id,
  children,
  toolbar,
  panel,
  onDragStart,
  onDragEnd,
}: {
  id: string;
  children: ReactNode;
  toolbar?: ReactNode;
  panel: ReactNode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const { selected, select } = useSelection();
  const on = selected === id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [on]);
  return (
    <div ref={ref} className="relative">
      <div
        onClick={(e) => {
          e.stopPropagation();
          select(id);
        }}
        className={`group relative cursor-pointer rounded-md outline-offset-4 transition ${on ? "outline-2 outline-indigo-500 outline" : "hover:outline hover:outline-1 hover:outline-indigo-300"}`}
      >
        {(toolbar || onDragStart) && (
          <div
            className={`absolute -top-9 right-0 z-20 items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md ${on ? "flex" : "hidden group-hover:flex"}`}
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
                className="flex h-7 w-7 cursor-grab items-center justify-center rounded text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
              >
                ⋮⋮
              </span>
            )}
            {toolbar}
          </div>
        )}
        {children}
      </div>
      {on && panel && (
        <div data-ve-panel className="relative z-10 mt-3 mb-4 cursor-auto rounded-xl border border-indigo-200 bg-white p-4 text-left text-sm text-slate-800 shadow-lg" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "var(--font-sans)" }}>
          {panel}
        </div>
      )}
    </div>
  );
}

/** A fixed (not movable) selectable area, e.g. the post title or the FAQ. */
export function Selectable({ id, children, panel }: { id: string; children: ReactNode; panel: ReactNode }) {
  return (
    <BlockFrame id={id} panel={panel}>
      {children}
    </BlockFrame>
  );
}

/** Clickable wrapper for an image inside an element. */
export function ImgHotspot({ onClick, children, className = "" }: { onClick?: () => void; children: ReactNode; className?: string }) {
  if (!onClick) return <>{children}</>;
  return (
    <div
      className={`group/img relative ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
      <span className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-[inherit] bg-indigo-900/30 text-xs font-semibold text-white group-hover/img:flex">
        이미지 편집
      </span>
    </div>
  );
}

export function PanelTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{children}</p>
      {right}
    </div>
  );
}
