// Event template fields: the settings (GAME_CONFIG keys) a user may change when putting a template
// on a promotion. Super admins choose them per template; anything not listed stays at the template's default.

export const FIELD_TYPES = ["text", "textarea", "number", "boolean", "color", "select", "lines", "items", "json"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const COLUMN_TYPES = ["text", "number", "boolean", "color", "emoji", "lines"] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "글자",
  textarea: "긴 글자",
  number: "숫자",
  boolean: "켜기/끄기",
  color: "색상",
  select: "선택",
  lines: "줄 목록",
  items: "표",
  json: "고급(JSON)",
};

export type FieldColumn = { key: string; label: string; type: ColumnType; max_length?: number; min?: number; max?: number };

export type TemplateField = {
  /** Path into GAME_CONFIG, dots for nested objects (e.g. "colors.primary"). */
  key: string;
  label: string;
  type: FieldType;
  group?: string;
  help?: string;
  max_length?: number;
  min?: number;
  max?: number;
  options?: string[];
  columns?: FieldColumn[];
  min_items?: number;
  max_items?: number;
  /** For items: the column whose values must add up to sum_total (e.g. prize weights to 100). */
  sum_key?: string;
  sum_total?: number;
  user_edit: boolean;
  ai_fill: boolean;
};

type Obj = Record<string, unknown>;
const KEY_RE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const COL_RE = /^[A-Za-z_$][\w$]*$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

/** Copy of obj with path set to value (missing objects on the way are created). */
export function setPath<T extends Obj>(obj: T, path: string, value: unknown): T {
  const parts = path.split(".");
  const out: Obj = { ...obj };
  let cur = out;
  parts.forEach((k, i) => {
    if (i === parts.length - 1) cur[k] = value;
    else {
      cur[k] = isObj(cur[k]) ? { ...(cur[k] as Obj) } : {};
      cur = cur[k] as Obj;
    }
  });
  return out as T;
}

function sanitizeColumn(v: unknown): FieldColumn | null {
  if (!isObj(v) || typeof v.key !== "string" || !COL_RE.test(v.key)) return null;
  const type = (COLUMN_TYPES as readonly string[]).includes(v.type as string) ? (v.type as ColumnType) : "text";
  const c: FieldColumn = { key: v.key, label: str(v.label, 40) || v.key, type };
  const ml = num(v.max_length);
  if (ml !== undefined) c.max_length = Math.max(1, Math.min(500, Math.round(ml)));
  if (num(v.min) !== undefined) c.min = num(v.min);
  if (num(v.max) !== undefined) c.max = num(v.max);
  return c;
}

/** Cleans a field list from the database, the admin screen or AI. With a config, drops fields that point nowhere. */
export function sanitizeFields(v: unknown, config?: Obj): TemplateField[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: TemplateField[] = [];
  for (const raw of v.slice(0, 60)) {
    if (!isObj(raw) || typeof raw.key !== "string" || !KEY_RE.test(raw.key) || seen.has(raw.key)) continue;
    if (config && getPath(config, raw.key) === undefined) continue;
    const type = (FIELD_TYPES as readonly string[]).includes(raw.type as string) ? (raw.type as FieldType) : "text";
    const f: TemplateField = {
      key: raw.key,
      label: str(raw.label, 40) || raw.key,
      type,
      user_edit: raw.user_edit !== false,
      ai_fill: raw.ai_fill !== false,
    };
    const group = str(raw.group, 40);
    if (group) f.group = group;
    const help = str(raw.help, 200);
    if (help) f.help = help;
    const ml = num(raw.max_length);
    if (ml !== undefined && (type === "text" || type === "textarea")) f.max_length = Math.max(1, Math.min(2000, Math.round(ml)));
    if (type === "number") {
      if (num(raw.min) !== undefined) f.min = num(raw.min);
      if (num(raw.max) !== undefined) f.max = num(raw.max);
    }
    if (type === "select") {
      f.options = Array.isArray(raw.options) ? raw.options.map((o) => str(o, 60)).filter(Boolean).slice(0, 30) : [];
      if (!f.options.length) f.type = "text";
    }
    if (type === "items") {
      f.columns = Array.isArray(raw.columns) ? raw.columns.map(sanitizeColumn).filter((c): c is FieldColumn => !!c).slice(0, 10) : [];
      if (!f.columns.length) f.type = "json";
      const mi = num(raw.min_items);
      const ma = num(raw.max_items);
      if (mi !== undefined) f.min_items = Math.max(0, Math.min(100, Math.round(mi)));
      if (ma !== undefined) f.max_items = Math.max(1, Math.min(100, Math.round(ma)));
      const sk = typeof raw.sum_key === "string" ? raw.sum_key : "";
      const st = num(raw.sum_total);
      if (st !== undefined && st > 0 && f.columns.some((c) => c.key === sk && c.type === "number")) {
        f.sum_key = sk;
        f.sum_total = st;
      }
    }
    seen.add(f.key);
    out.push(f);
  }
  return out;
}

const isHex = (v: unknown) => typeof v === "string" && HEX_RE.test(v);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function inferColumn(key: string, v: unknown): FieldColumn | null {
  if (typeof v === "number") return { key, label: key, type: "number" };
  if (typeof v === "boolean") return { key, label: key, type: "boolean" };
  if (isHex(v)) return { key, label: key, type: "color" };
  if (typeof v === "string") return { key, label: key, type: key === "emoji" || key === "icon" ? "emoji" : "text" };
  if (isStrList(v)) return { key, label: key, type: "lines" };
  return null;
}

function inferOne(key: string, v: unknown, group?: string): TemplateField[] {
  const base = { key, label: key.split(".").pop() || key, user_edit: true, ai_fill: true, ...(group ? { group } : {}) };
  if (typeof v === "string") {
    if (isHex(v)) return [{ ...base, type: "color" }];
    return [{ ...base, type: v.length > 40 ? "textarea" : "text", max_length: Math.max(60, v.length * 2) }];
  }
  if (typeof v === "number") return [{ ...base, type: "number", ai_fill: false }];
  if (typeof v === "boolean") return [{ ...base, type: "boolean", ai_fill: false }];
  if (isStrList(v)) return [{ ...base, type: "lines" }];
  if (Array.isArray(v) && v.length && v.every(isObj)) {
    const first = v[0] as Obj;
    // Properties a column cannot show (nested objects) are kept from the default rows.
    const cols = Object.entries(first).map(([k, x]) => (COL_RE.test(k) ? inferColumn(k, x) : null)).filter((c): c is FieldColumn => !!c);
    if (cols.length) return [{ ...base, type: "items", columns: cols, min_items: 1, max_items: Math.max(10, v.length * 2) }];
    return [{ ...base, type: "json" }];
  }
  if (isObj(v) && Object.values(v).every((x) => !isObj(x) && !Array.isArray(x))) {
    return Object.entries(v).flatMap(([k, x]) => inferOne(`${key}.${k}`, x, key));
  }
  return [{ ...base, type: "json" }];
}

/** A starting field list worked out from a config alone (labels are the keys). */
export function inferFields(config: Obj): TemplateField[] {
  return sanitizeFields(Object.entries(config ?? {}).flatMap(([k, v]) => (COL_RE.test(k) ? inferOne(k, v) : [])), config);
}

/** The fields a template uses: its own list, or one worked out from its config when it has none. */
export function templateFields(fields: unknown, config: Obj): TemplateField[] {
  const own = sanitizeFields(fields, config);
  return own.length ? own : inferFields(config);
}

function cleanCell(c: FieldColumn, v: unknown, fallback: unknown): unknown {
  switch (c.type) {
    case "number": {
      let n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
      if (!Number.isFinite(n)) n = num(fallback) ?? 0;
      if (c.min !== undefined) n = Math.max(c.min, n);
      if (c.max !== undefined) n = Math.min(c.max, n);
      return n;
    }
    case "boolean":
      return typeof v === "boolean" ? v : !!fallback;
    case "color":
      return isHex(v) ? v : isHex(fallback) ? fallback : "#888888";
    case "lines":
      return isStrList(v) ? v.map((x) => x.slice(0, c.max_length ?? 200)).slice(0, 30) : isStrList(fallback) ? fallback : [];
    default:
      return typeof v === "string" ? v.slice(0, c.max_length ?? 200) : typeof fallback === "string" ? fallback : "";
  }
}

/** One field's value made safe; error says why it cannot be used as it is. */
export function cleanValue(f: TemplateField, v: unknown, fallback: unknown): { value: unknown; error?: string } {
  switch (f.type) {
    case "text":
    case "textarea": {
      if (typeof v !== "string") return { value: fallback };
      const max = f.max_length ?? 2000;
      return v.length > max ? { value: v.slice(0, max), error: `${max}자 이하로 줄여주세요.` } : { value: v };
    }
    case "number": {
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
      if (!Number.isFinite(n)) return { value: fallback, error: "숫자를 입력해 주세요." };
      if (f.min !== undefined && n < f.min) return { value: f.min, error: `${f.min} 이상이어야 해요.` };
      if (f.max !== undefined && n > f.max) return { value: f.max, error: `${f.max} 이하여야 해요.` };
      return { value: n };
    }
    case "boolean":
      return { value: typeof v === "boolean" ? v : fallback };
    case "color":
      return isHex(v) ? { value: v } : { value: fallback, error: "#RRGGBB 형식의 색상이어야 해요." };
    case "select":
      return typeof v === "string" && f.options?.includes(v) ? { value: v } : { value: fallback };
    case "lines":
      return isStrList(v) ? { value: v.map((x) => x.slice(0, 500)).slice(0, 50) } : { value: fallback };
    case "items": {
      if (!Array.isArray(v)) return { value: fallback };
      const defaults = Array.isArray(fallback) ? fallback : [];
      const rows = v.slice(0, f.max_items ?? 100).map((row, i) => {
        const base = isObj(defaults[i]) ? clone(defaults[i] as Obj) : isObj(defaults[0]) ? clone(defaults[0] as Obj) : {};
        const r = isObj(row) ? row : {};
        for (const c of f.columns ?? []) base[c.key] = cleanCell(c, r[c.key], base[c.key]);
        return base;
      });
      if (f.max_items !== undefined && v.length > f.max_items) return { value: rows, error: `최대 ${f.max_items}개까지 넣을 수 있어요.` };
      if (f.min_items !== undefined && rows.length < f.min_items) return { value: rows, error: `최소 ${f.min_items}개가 필요해요.` };
      if (f.sum_key && f.sum_total !== undefined) {
        const sum = rows.reduce((s, r) => s + (num(r[f.sum_key!]) ?? 0), 0);
        if (Math.abs(sum - f.sum_total) > 0.01) return { value: rows, error: `합계가 ${Math.round(sum * 100) / 100}이에요. ${f.sum_total}이 되도록 맞춰주세요.` };
      }
      return { value: rows };
    }
    case "json": {
      const same = Array.isArray(fallback) ? Array.isArray(v) : isObj(fallback) ? isObj(v) : typeof v === typeof fallback;
      if (!same) return { value: fallback, error: "형식이 기본값과 달라요." };
      return JSON.stringify(v).length > 15000 ? { value: fallback, error: "내용이 너무 길어요." } : { value: clone(v) };
    }
  }
}

/**
 * The config a promotion's game runs with: the template default, with each user-editable field taken from
 * values (cleaned). Locked fields and unlisted keys keep the default. errors is keyed by field key.
 */
export function buildConfig(fields: TemplateField[], defaults: Obj, values: unknown): { config: Obj; errors: Record<string, string> } {
  let config = clone(defaults ?? {});
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!f.user_edit) continue;
    const r = cleanValue(f, getPath(values, f.key), getPath(defaults, f.key));
    config = setPath(config, f.key, r.value);
    if (r.error) errors[f.key] = r.error;
  }
  return { config, errors };
}
