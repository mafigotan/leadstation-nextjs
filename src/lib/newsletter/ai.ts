import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { addUsage } from "@/lib/usage";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BLOCK_TYPES, newBlockId, sanitizeBlocks, type Block, type Template, type Tone } from "./types";

/** What the AI returns (no ids, urls or images). */
export const AiNewsletterSchema = z.object({
  subject: z.string().describe("이메일 제목, 40자 안팎"),
  preheader: z.string().describe("받은편지함 미리보기 문장, 60자 안팎"),
  blocks: z.array(
    z.object({
      type: z.enum(BLOCK_TYPES),
      heading: z.string(),
      text: z.string(),
      image_keyword: z.string(),
      button_label: z.string(),
      button_url: z.string(),
      items: z.array(z.object({ title: z.string(), text: z.string(), image_keyword: z.string() })),
    }),
  ),
});
export type AiNewsletter = z.infer<typeof AiNewsletterSchema>;

const TONE_TEXT: Record<Tone, string> = {
  classic: "격식 있고 정중한 전통적인 문체",
  friendly: "따뜻하고 친근한 대화체",
  witty: "가볍고 재치 있는 문체(과하지 않게)",
  professional: "간결하고 신뢰감 있는 전문가 문체",
};

function systemPrompt(tone: Tone, template: Template, brand: string) {
  const images =
    template === "text"
      ? "이 뉴스레터는 텍스트 중심 템플릿이라 이미지가 표시되지 않습니다. image_keyword 는 빈 문자열로 두세요."
      : "hero, image 블록과 cards·thumbs 항목에는 어울리는 이미지를 찾을 검색 키워드를 image_keyword 에 짧게 적으세요.";
  let prompt =
    "당신은 기업 이메일 뉴스레터를 쓰는 전문 에디터입니다. 읽기 쉽고 보기 좋은 뉴스레터를 블록 단위로 작성합니다.\n\n" +
    "규칙:\n" +
    `- 문체: ${TONE_TEXT[tone] ?? TONE_TEXT.friendly}.\n` +
    "- 이메일 내용에 쓰인 언어로 작성하세요(기본 한국어).\n" +
    "- 블록은 보통 4~8개. 첫 블록은 hero(대표 제목 heading + 짧은 도입 text)로 시작하세요.\n" +
    "- 블록 type: hero, heading(소제목만), text(선택 heading + 본문), image, cards(2~3개 항목의 제품·소식 카드), thumbs(썸네일 리스트: 항목마다 작은 썸네일·제목·자세히 보기 버튼, 기사·자료·소식 목록에 적합, 항목은 title 과 image_keyword 만 쓰고 text 는 빈 문자열), button(행동 유도), divider.\n" +
    "- 뉴스레터의 모든 꾸밈과 구성은 위 블록 type 으로만 표현하세요. 블록에 없는 요소(표, 다단 배치, 색·글자 크기 지정, 인용 상자, 목차, 아이콘, 글머리 기호 목록 등)는 만들지 말고 가장 가까운 블록으로 바꿔 표현하세요.\n" +
    "- heading·text·title·button_label 은 일반 텍스트로만 쓰세요. 마크다운, HTML 태그, 이모지 꾸밈을 쓰지 마세요. 문단은 빈 줄로 나누세요.\n" +
    "- button_url 과 링크는 이메일 내용·명령 프롬프트에 실제 URL 이 있을 때만 넣고, 없으면 빈 문자열로 두세요. 사실이 아닌 수치·날짜·가격을 지어내지 마세요.\n" +
    `- ${images}\n` +
    "- 쓰지 않는 필드는 빈 문자열 또는 빈 배열로 두세요.\n" +
    "- subject 는 40자 안팎의 이메일 제목, preheader 는 받은편지함 미리보기에 보일 60자 안팎의 문장입니다.\n";
  if (brand.trim()) prompt += `\n브랜드 정보(참고용):\n${brand.trim()}\n`;
  return prompt;
}

function plainText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Keeps images and links from the current blocks when the AI rewrites them (same position, same type). */
function keepMedia(originals: Block[], next: Block[]): Block[] {
  return next.map((nb, k) => {
    const ob = originals[k];
    if (!ob || ob.type !== nb.type) return nb;
    return {
      ...nb,
      id: ob.id,
      image_url: ob.image_url,
      button_url: nb.button_url || ob.button_url,
      items: nb.items.map((it, j) => (ob.items[j] ? { ...it, image_url: ob.items[j].image_url, url: ob.items[j].url } : it)),
    };
  });
}

export type GenerateInput = {
  topic: string;
  prompt: string;
  tone: Tone;
  template: Template;
  greeting: boolean;
  brand: string;
  current: Block[];
};

const client = new Anthropic();

export async function generateNewsletter(input: GenerateInput) {
  let parts = `이메일 내용(주제·주요 내용):\n${input.topic}`;
  if (input.prompt.trim()) parts += `\n\n명령 프롬프트(디자인·구성·작성 방식 지시):\n${input.prompt}`;
  if (input.greeting) {
    parts +=
      "\n\n참고: 본문 맨 위에 '{수신자 이름}님 안녕하세요, {보내는 사람} 입니다.' 인사말이 자동으로 들어갑니다. 본문에는 인사말이나 자기소개를 쓰지 말고 바로 내용으로 시작하세요.";
  }

  let user: string;
  if (input.current.length) {
    const forAi = input.current.map((b) => ({
      type: b.type,
      heading: b.heading,
      text: b.text,
      image_keyword: b.image_keyword,
      button_label: b.button_label,
      button_url: b.button_url,
      items: b.items.map((it) => ({ title: it.title, text: it.text, image_keyword: it.image_keyword })),
    }));
    user =
      "아래 현재 뉴스레터를 이메일 내용과 명령 프롬프트에 맞게 수정해 주세요. 지시에 따라 필요한 부분은 고치거나 다시 쓰고, 지시와 관계없는 부분은 최대한 유지하세요. 수정한 뉴스레터 전체를 subject, preheader, blocks 로 돌려주세요.\n\n" +
      parts +
      "\n\n현재 뉴스레터 블록(JSON):\n" +
      JSON.stringify(forAi);
  } else {
    user = "아래 이메일 내용으로 이메일 뉴스레터 한 편을 작성해 주세요. 명령 프롬프트가 있으면 구성과 디자인을 그 지시에 맞추세요.\n\n" + parts;
  }

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(AiNewsletterSchema) },
    system: systemPrompt(input.tone, input.template, input.brand),
    messages: [{ role: "user", content: user }],
  });

  addUsage("text", response.usage.input_tokens + response.usage.output_tokens);
  if (response.stop_reason === "refusal") {
    throw new Error("AI가 이 요청에 대한 뉴스레터 작성을 거절했어요. 내용을 바꿔 다시 시도해 주세요.");
  }
  const data = response.parsed_output;
  if (!data || !data.blocks.length) {
    throw new Error("AI가 본문을 만들지 못했어요. 이메일 내용을 조금 더 구체적으로 적어 다시 시도해 주세요.");
  }

  let blocks = sanitizeBlocks(
    data.blocks.map((b) => ({
      ...b,
      id: newBlockId(),
      heading: plainText(b.heading),
      text: plainText(b.text),
      button_label: plainText(b.button_label),
      image_url: "",
      items: b.items.map((it) => ({ ...it, title: plainText(it.title), text: plainText(it.text), image_url: "", url: "" })),
    })),
  );
  if (input.current.length) blocks = keepMedia(input.current, blocks);

  return { subject: data.subject, preheader: data.preheader, blocks };
}
