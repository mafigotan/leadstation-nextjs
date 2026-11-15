import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { addUsage } from "@/lib/usage";
import { GAME_HEIGHT, type EventGame } from "@/lib/event-game";

const client = new Anthropic();

const GameSchema = z.object({
  css: z.string().describe("CSS for the game"),
  html: z.string().describe("Markup placed inside <body>, no <script> or <style> tags"),
  js: z.string().describe("Plain JavaScript that runs after the markup"),
});

const SYSTEM = `You build small, polished browser mini-games for Korean marketing promotion pages (roulette, hidden-object, card matching, scratch card, quiz and so on).
The game runs inside an iframe that is 100% wide (320px to 900px) and ${GAME_HEIGHT}px tall, so fit everything in that box and make it work with touch and mouse.
Rules:
- Return CSS, body markup and JavaScript separately. Use only vanilla JS, CSS, inline SVG, canvas and emoji. No external files, fonts, images or network requests (they are blocked).
- All visible text in Korean. Bright, friendly, modern look.
- The game must be playable once to the end without errors. Keep the code compact.
- When the game ends, show the outcome on screen with a line like "아래 신청 폼을 작성하면 응모가 완료돼요", and call window.reportResult("<short Korean outcome>") exactly once, e.g. reportResult("룰렛 결과: 10% 할인 쿠폰") or reportResult("카드 맞추기 성공 (12초)").
- Do not let the player replay to change an outcome that has been reported.
- Do not use alert, confirm, prompt, localStorage or cookies.`;

export async function generateGame(description: string, context: string): Promise<EventGame> {
  const res = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 20000,
    output_config: { effort: "low", format: zodOutputFormat(GameSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `만들 게임: ${description}${context ? `\n\n프로모션 정보 (게임 문구와 경품에 참고):\n${context}` : ""}`,
      },
    ],
  });
  addUsage("text", res.usage.input_tokens + res.usage.output_tokens);
  if (res.stop_reason === "refusal") throw new Error("AI가 이 게임 생성을 거절했어요. 설명을 바꿔서 다시 시도해 주세요.");
  if (res.stop_reason === "max_tokens") throw new Error("AI가 만든 게임이 너무 길어서 끊겼어요. 더 단순한 게임으로 다시 시도해 주세요.");
  if (!res.parsed_output) throw new Error("AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
  return res.parsed_output;
}
