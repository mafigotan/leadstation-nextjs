// Event element: a small AI-made game that runs in a sandboxed iframe on the promotion page.
// The game reports its outcome with reportResult(text); the lead form stores it in the "event" field.

export type EventGame = {
  css: string;
  html: string;
  js: string;
  /** Settings the game reads from window.GAME_CONFIG (prizes, texts, colors). */
  config?: Record<string, unknown>;
  /** Template the game was made from, if any. */
  template_id?: string;
};

export const EVENT_MESSAGE = "leadstation-event";
export const GAME_HEIGHT = 560;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export function sanitizeGame(v: unknown): EventGame | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const g: EventGame = { css: str(o.css, 60000), html: str(o.html, 60000), js: str(o.js, 150000) };
  if (o.config && typeof o.config === "object" && !Array.isArray(o.config) && JSON.stringify(o.config).length <= 20000) g.config = o.config as Record<string, unknown>;
  if (typeof o.template_id === "string" && /^[0-9a-f-]{36}$/.test(o.template_id)) g.template_id = o.template_id;
  return g.html || g.js ? g : undefined;
}

/**
 * Whole iframe document. The CSP blocks every network request, and the iframe is sandboxed
 * without same-origin, so the game cannot reach the page, cookies or other sites.
 */
export function gameDocument(g: EventGame): string {
  const css = g.css.replace(/<\/style/gi, "<\\/style");
  const js = g.js.replace(/<\/script/gi, "<\\/script");
  const config = JSON.stringify(g.config ?? {}).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;}*{box-sizing:border-box}${css}</style>
<script>window.GAME_CONFIG=${config};window.reportResult=function(t){try{parent.postMessage({type:${JSON.stringify(EVENT_MESSAGE)},result:String(t).slice(0,200)},"*")}catch(e){}};</script>
</head><body>${g.html}<script>${js}</script></body></html>`;
}
