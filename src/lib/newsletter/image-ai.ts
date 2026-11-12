import "server-only";

export const IMAGE_STYLES = {
  photo: ["사진", "Style: realistic, high-quality editorial photograph with natural lighting."],
  illustration: ["일러스트", "Style: clean modern digital illustration, flat or soft-shaded, harmonious colors."],
  cartoon: ["만화", "Style: friendly cartoon / comic illustration with bold outlines and expressive characters."],
  infographic: ["인포그래픽", "Style: simple infographic layout with icons, charts and clear visual hierarchy; use minimal text."],
} as const;
export type ImageStyle = keyof typeof IMAGE_STYLES;

async function request(model: string, prompt: string, size: string) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size, quality: "medium", output_format: "jpeg" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    error?: { message?: string; code?: string };
  };
  return { status: res.status, json };
}

/** Generates a JPEG with the OpenAI image API. Returns the image bytes. */
export async function generateImage(description: string, style: ImageStyle | "", wide: boolean): Promise<Buffer> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI 이미지 설정이 없어요. Vercel 환경 변수에 OPENAI_API_KEY를 넣고 Redeploy 해주세요.");
  }
  let prompt = description.trim().slice(0, 3000);
  if (!prompt) throw new Error("이미지 설명을 입력해 주세요.");
  if (style && IMAGE_STYLES[style]) prompt += `\n\n${IMAGE_STYLES[style][1]}`;
  prompt += "\nDo not include any text, letters, logos or watermarks in the image. Do not depict real people or trademarks.";
  const size = wide ? "1536x1024" : "1024x1024";

  const preferred = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let { status, json } = await request(preferred, prompt, size);
  const detail = json.error?.message ?? "";
  if (status !== 200 && preferred !== "gpt-image-1" && (status === 404 || json.error?.code === "model_not_found" || /model/i.test(detail))) {
    ({ status, json } = await request("gpt-image-1", prompt, size));
  }
  if (status !== 200) {
    const msg = json.error?.message ?? `HTTP ${status}`;
    if (/verif/i.test(msg)) throw new Error("OpenAI 조직 인증이 필요해요. platform.openai.com > Settings > Organization에서 Verify Organization을 마친 뒤 다시 시도해 주세요.");
    if (json.error?.code === "moderation_blocked" || /safety/i.test(msg)) throw new Error("이미지 AI가 안전 정책 때문에 이 이미지를 만들지 않았어요. 설명을 바꿔 다시 시도해 주세요.");
    if (status === 401) throw new Error("OpenAI API 키가 올바르지 않아요.");
    if (status === 429) throw new Error("OpenAI 사용 한도에 도달했어요. 크레딧이나 요청 한도를 확인해 주세요.");
    throw new Error(`이미지 AI 오류: ${msg}`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("이미지 AI가 이미지를 돌려주지 않았어요. 다시 시도해 주세요.");
  return Buffer.from(b64, "base64");
}
