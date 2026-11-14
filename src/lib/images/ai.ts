import "server-only";
import sharp from "sharp";
import { addUsage } from "@/lib/usage";
import { IMAGE_RATIOS, IMAGE_STYLES, type ImageRatio, type ImageStyle } from "./options";

async function request(model: string, prompt: string, size: string) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size, quality: "medium", output_format: "png" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { b64_json?: string }[];
    error?: { message?: string; code?: string };
    usage?: { total_tokens?: number };
  };
  // Image tokens are counted for successful images (OpenAI reports them; estimate if it doesn't).
  if (res.status === 200) addUsage("image", json.usage?.total_tokens ?? (size === "1024x1024" ? 1100 : 1650));
  return { status: res.status, json };
}

/**
 * Generates an image with the OpenAI image API at the closest native size,
 * then center-crops it to the exact ratio. Returns JPEG bytes and the final size.
 */
export async function generateImage(description: string, style: ImageStyle | "", ratio: ImageRatio) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI 이미지 설정이 없어요. Vercel 환경 변수에 OPENAI_API_KEY를 넣고 Redeploy 해주세요.");
  }
  let prompt = description.trim().slice(0, 3000);
  if (!prompt) throw new Error("이미지 설명을 입력해 주세요.");
  const [, rw, rh] = IMAGE_RATIOS[ratio] ?? IMAGE_RATIOS["1:1"];
  if (style && IMAGE_STYLES[style]) prompt += `\n\n${IMAGE_STYLES[style][1]}`;
  if (rw / rh >= 2) prompt += `\nThe image will be cropped to a wide ${rw}:${rh} banner: keep the main subject in the vertical center with empty space above and below.`;
  prompt += "\nDo not include any text, letters, logos or watermarks in the image. Do not depict real people or trademarks.";

  const size = rw === rh ? "1024x1024" : rw > rh ? "1536x1024" : "1024x1536";
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
  return cropToRatio(Buffer.from(b64, "base64"), rw, rh);
}

export async function cropToRatio(input: Buffer, rw: number, rh: number) {
  const img = sharp(input);
  const meta = await img.metadata();
  const w = meta.width ?? 1024;
  const h = meta.height ?? 1024;
  let cw = w;
  let ch = Math.round((w * rh) / rw);
  if (ch > h) {
    ch = h;
    cw = Math.round((h * rw) / rh);
  }
  const bytes = await img
    .extract({ left: Math.floor((w - cw) / 2), top: Math.floor((h - ch) / 2), width: cw, height: ch })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return { bytes, width: cw, height: ch };
}
