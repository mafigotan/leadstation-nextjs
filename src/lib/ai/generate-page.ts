import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PageContentSchema, type Brief, type PageContent } from "@/lib/types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You write Korean marketing copy for promotion landing pages whose goal is to collect sign-ups (leads).
Write natural, persuasive Korean that fits the requested tone. Be concrete about the product and the offer, and do not invent prices, dates, or guarantees the brief does not mention.
Keep the headline short and punchy. Benefits should be specific to this product, not generic.`;

export async function generatePageContent(brief: Brief): Promise<PageContent> {
  const prompt = [
    `상품/서비스: ${brief.product}`,
    `설명: ${brief.description}`,
    brief.audience && `타깃 고객: ${brief.audience}`,
    brief.offer && `프로모션/혜택: ${brief.offer}`,
    `톤: ${brief.tone || "신뢰감 있고 친근한"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(PageContentSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `다음 정보로 프로모션 랜딩 페이지 문구를 작성해 주세요.\n\n${prompt}` },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청에 대한 페이지 생성을 거절했어요. 입력 내용을 바꿔서 다시 시도해 주세요.");
  }
  if (!response.parsed_output) {
    throw new Error("AI 응답을 읽지 못했어요. 다시 시도해 주세요.");
  }
  return response.parsed_output;
}
