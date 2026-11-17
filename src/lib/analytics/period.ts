/** Reporting periods in Korea time (yyyy-mm-dd, both ends inclusive). */

export const PRESETS = [7, 28, 90] as const;
export type Preset = (typeof PRESETS)[number];
export const MAX_DAYS = 366;

export type Period = { start: string; end: string; days: number; preset: Preset | null };

const DAY = 86400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today in Korea, or `offset` days before. */
export function kstToday(offset = 0): string {
  return new Date(Date.now() + 9 * 3600_000 - offset * DAY).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

export function presetPeriod(days: Preset): Period {
  const end = kstToday();
  return { start: addDays(end, -(days - 1)), end, days, preset: days };
}

function validDate(s: string | undefined): s is string {
  return !!s && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && addDays(s, 0) === s;
}

/** From ?range=7|28|90 or ?from=yyyy-mm-dd&to=yyyy-mm-dd. Custom ranges are clamped to today and MAX_DAYS. */
export function parsePeriod(sp: { range?: string; from?: string; to?: string }): Period {
  if (validDate(sp.from) && validDate(sp.to)) {
    const today = kstToday();
    let start = sp.from < sp.to ? sp.from : sp.to;
    let end = sp.from < sp.to ? sp.to : sp.from;
    if (end > today) end = today;
    if (start > end) start = end;
    if (start < "2020-01-01") start = "2020-01-01";
    if (diffDays(start, end) + 1 > MAX_DAYS) start = addDays(end, -(MAX_DAYS - 1));
    return { start, end, days: diffDays(start, end) + 1, preset: null };
  }
  const preset = PRESETS.find((p) => String(p) === sp.range) ?? 28;
  return presetPeriod(preset);
}

/** The same-length period right before. */
export function previousOf(p: Period): { start: string; end: string } {
  return { start: addDays(p.start, -p.days), end: addDays(p.start, -1) };
}

export function eachDay(p: Period): string[] {
  return Array.from({ length: p.days }, (_, i) => addDays(p.start, i));
}

export function periodQuery(p: Period): string {
  return p.preset ? `range=${p.preset}` : `from=${p.start}&to=${p.end}`;
}

export function periodLabel(p: Period): string {
  const f = (d: string) => d.replace(/-/g, ".");
  return `${f(p.start)} ~ ${f(p.end)} (${p.days}일)`;
}
