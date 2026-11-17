import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { addUsage } from "@/lib/usage";
import { GAME_HEIGHT, type EventGame } from "@/lib/event-game";

const client = new Anthropic();
const MODEL = "claude-opus-5-5";

/** A generated game plus what the template screen shows about its settings. */
export type GeneratedGame = Required<Pick<EventGame, "css" | "html" | "js" | "config">> & { guide: string };

const DESIGN = `You are a senior game developer and visual designer who builds premium HTML5 mini-games for Korean marketing promotion pages (roulette, card matching, hidden-object, scratch card, quiz, slot machine, ladder game, gift box pick and so on). Your games look like polished commercial products, not demos.

Where the game runs:
- A sandboxed iframe, 100% wide (320px to 900px) and ${GAME_HEIGHT}px tall. Design for that box: no page scroll, responsive from phone to desktop, works with both touch and mouse (pointer events).
- Only vanilla JavaScript, CSS, inline SVG, canvas, Web Animations and emoji. Every network request is blocked: no external scripts, fonts, images or audio files. Sounds, if any, come from the Web Audio API and start only after a user tap.
- No alert, confirm, prompt, localStorage, sessionStorage or cookies.

Quality bar:
- A clear start screen (title, one-line rule, big start button), the game, and a result screen. Smooth 60fps animation (requestAnimationFrame or CSS transitions with easing), satisfying feedback on every interaction (press states, highlights, a small celebration such as confetti on a win).
- Modern look: soft gradients, rounded shapes, good spacing, readable large Korean type, consistent color palette taken from the config.
- Robust: no console errors, no layout break at 320px, no double counting on fast repeated taps, timers cleaned up.
- All visible text in Korean.

Settings:
- The page injects window.GAME_CONFIG (a plain JSON object) before your script runs. Read every text, prize, probability, count and color from it, so the same game can be reused for different promotions without code changes. Fall back to sensible defaults for any missing key.
- Prize lists use weights for probability, e.g. {"label": "10% 할인 쿠폰", "weight": 30}. Pick by weight in code.

Result:
- When the game ends, show the outcome on the result screen with the line "아래 신청 폼을 작성하면 응모가 완료돼요", and call window.reportResult("<short Korean outcome>") exactly once, e.g. reportResult("룰렛 결과: 10% 할인 쿠폰") or reportResult("카드 맞추기 성공 (12초)").
- After reporting, the player cannot play again to change the outcome.

Answer in exactly this format with these five markers and nothing else (no code fences):
===CSS===
(css)
===HTML===
(markup for inside <body>, without <script> or <style> tags)
===JS===
(javascript)
===CONFIG===
(the default GAME_CONFIG as JSON)
===GUIDE===
(Korean, one short line per config key: what it changes)`;

function parseGame(text: string): GeneratedGame {
  const part = (name: string) => {
    const m = text.match(new RegExp(`===${name}===\\s*([\\s\\S]*?)(?=\\n===(?:CSS|HTML|JS|CONFIG|GUIDE)===|$)`));
    return (m?.[1] ?? "").replace(/^```[a-z]*\n?|\n?```\s*$/g, "").trim();
  };
  const js = part("JS");
  const html = part("HTML");
  if (!js || !html) throw new Error("AI 응답에서 게임 코드를 찾지 못했어요. 다시 시도해 주세요.");
  let config: Record<string, unknown> = {};
  try {
    const c = JSON.parse(part("CONFIG") || "{}");
    if (c && typeof c === "object" && !Array.isArray(c)) config = c;
  } catch {
    throw new Error("AI가 만든 게임 설정(JSON)을 읽지 못했어요. 다시 시도해 주세요.");
  }
  return { css: part("CSS"), html, js, config, guide: part("GUIDE") };
}

const TEMPLATE_SYSTEM =
  DESIGN +
  "\n\nThis is a reusable template, so make the config cover every text, prize and color a marketer would want to change." +
  "\n\nKeep the code compact: CSS under 15,000 characters and JS under 40,000, no code comments, no unused code, and reuse helpers instead of repeating similar blocks. Plan briefly, then write the answer; do not draft the code twice.";

/**
 * Super admin template at the highest quality. It can take longer than a server request may run,
 * so it goes through the Message Batches API and is collected later with readTemplateJob().
 * With `previous`, revises that game.
 */
export async function startTemplateJob(prompt: string, previous?: { game: GeneratedGame; feedback: string }): Promise<string> {
  const user = previous
    ? `지금 템플릿 게임을 아래 요청대로 고쳐서 전체를 다시 보내주세요. 잘 되는 부분은 유지하세요.\n\n원래 요청: ${prompt}\n\n수정 요청: ${previous.feedback}\n\n지금 코드:\n===CSS===\n${previous.game.css}\n===HTML===\n${previous.game.html}\n===JS===\n${previous.game.js}\n===CONFIG===\n${JSON.stringify(previous.game.config, null, 2)}\n===GUIDE===\n${previous.game.guide}`
    : `여러 프로모션에서 재사용할 이벤트 게임 템플릿을 만들어 주세요.\n\n요청: ${prompt}`;
  const batch = await client.messages.batches.create({
    requests: [
      {
        custom_id: "template",
        params: {
          model: MODEL,
          // Thinking counts toward max_tokens, so give a long game the model's full 128K output.
          max_tokens: 128000,
          thinking: { type: "adaptive" },
          output_config: { effort: "high" },
          system: TEMPLATE_SYSTEM,
          messages: [{ role: "user", content: user }],
        },
      },
    ],
  });
  return batch.id;
}

/** null while the job is still running; otherwise the game or the reason it failed. */
export async function readTemplateJob(batchId: string): Promise<null | { game?: GeneratedGame; error?: string }> {
  const batch = await client.messages.batches.retrieve(batchId);
  if (batch.processing_status !== "ended") return null;
  for await (const r of await client.messages.batches.results(batchId)) {
    if (r.result.type !== "succeeded") {
      return { error: r.result.type === "errored" ? `AI 요청 오류: ${r.result.error.error.message}` : "AI 작업이 만료되거나 취소됐어요. 다시 시도해 주세요." };
    }
    const m = r.result.message;
    if (m.stop_reason === "refusal") return { error: "AI가 이 게임 생성을 거절했어요. 설명을 바꿔서 다시 시도해 주세요." };
    if (m.stop_reason === "max_tokens") return { error: "AI가 만든 게임이 너무 길어서 끊겼어요. 요청을 조금 단순하게 바꿔 주세요." };
    try {
      return { game: parseGame(m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { error: "AI 결과를 찾지 못했어요. 다시 시도해 주세요." };
}

const ConfigSchema = z.object({ config_json: z.string().describe("The complete GAME_CONFIG as a JSON object string") });

/** Fills a template's settings for one promotion (fast). */
export async function fillTemplateConfig(
  template: { name: string; config: Record<string, unknown>; config_guide: string },
  request: string,
  context: string,
): Promise<Record<string, unknown>> {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ConfigSchema) },
    system:
      "You customize the settings of a Korean marketing mini-game template. Return the full config with the same keys and value types as the default, changing only what the request and the promotion call for. Write Korean text. Keep prize weights as numbers.",
    messages: [
      {
        role: "user",
        content: `템플릿: ${template.name}\n\n설정 설명:\n${template.config_guide}\n\n기본 설정:\n${JSON.stringify(template.config, null, 2)}\n\n요청: ${request}${context ? `\n\n프로모션 정보:\n${context}` : ""}`,
      },
    ],
  });
  addUsage("text", res.usage.input_tokens + res.usage.output_tokens);
  if (res.stop_reason === "refusal") throw new Error("AI가 이 요청을 거절했어요. 내용을 바꿔서 다시 시도해 주세요.");
  try {
    const c = JSON.parse(res.parsed_output?.config_json ?? "");
    if (c && typeof c === "object" && !Array.isArray(c)) return c;
  } catch {}
  throw new Error("AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
}
